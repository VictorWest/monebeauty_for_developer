import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { Prisma, type Locale, type PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  notifyOrderPaymentUpdate,
  notifyOrderReceipt,
} from "@/lib/notifications";
import { minorToEuros, stripeClient, stripeObjectId } from "@/lib/stripe";
import { runExternalApiAttempt } from "@/lib/external-api";

const orderNotificationInclude = {
  items: true,
  client: { select: { fullName: true, email: true, phone: true } },
} as const;

function voucherCode() {
  const value = randomBytes(9).toString("hex").toUpperCase();
  return `MONE-${value.slice(0, 6)}-${value.slice(6, 12)}-${value.slice(12)}`;
}

function expiresAfter(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function shippingAddress(session: Stripe.Checkout.Session) {
  const shipping = session.collected_information?.shipping_details;
  return shipping ? JSON.parse(JSON.stringify(shipping)) : undefined;
}

function paidStatus(session: Stripe.Checkout.Session) {
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"
  );
}

export async function reconcileCheckoutSession(
  sessionOrId: Stripe.Checkout.Session | string,
) {
  const session =
    typeof sessionOrId === "string"
      ? (await runExternalApiAttempt({ provider: "stripe", operation: "checkout.sessions.retrieve", context: { correlationId: sessionOrId }, run: () => stripeClient().checkout.sessions.retrieve(sessionOrId), responseMetadata: (value) => ({ id: value.id, status: value.status, paymentStatus: value.payment_status }) })).value
      : sessionOrId;
  const orderId = session.metadata?.orderId;
  if (session.metadata?.source !== "website" || !orderId) return null;

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    include: { order: { include: orderNotificationInclude } },
  });
  if (
    !attempt ||
    attempt.orderId !== orderId ||
    attempt.order.source !== "WEBSITE_STRIPE"
  ) {
    return null;
  }

  const amountTotal = session.amount_total;
  if (
    amountTotal == null ||
    session.currency?.toUpperCase() !== attempt.currency
  ) {
    throw new Error("stripe_session_currency_or_total_missing");
  }
  if (minorToEuros(amountTotal) !== Number(attempt.amount).toFixed(2)) {
    throw new Error("stripe_session_amount_mismatch");
  }

  const paymentIntentId = stripeObjectId(session.payment_intent);
  if (!paidStatus(session)) {
    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "PROCESSING",
          stripePaymentIntentId: paymentIntentId,
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PROCESSING" },
      }),
    ]);
    return prisma.order.findUnique({ where: { id: orderId } });
  }

  const now = new Date();
  let didFulfill = false;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentAttempt.updateMany({
      where: {
        id: attempt.id,
        status: { in: ["UNPAID", "PROCESSING", "FAILED"] },
      },
      data: {
        status: "PAID",
        stripePaymentIntentId: paymentIntentId,
        paidAt: attempt.paidAt ?? now,
        cancelRequestedAt: null,
      },
    });
    if (!claimed.count) return;
    didFulfill = true;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { vouchers: true } } },
    });
    if (!order || order.source !== "WEBSITE_STRIPE") {
      throw new Error("website_order_not_found");
    }

    for (const item of order.items) {
      if (item.kind === "PHYSICAL" || item.vouchers.length >= item.qty)
        continue;
      const validityDays = item.voucherValidityDays;
      if (!validityDays || validityDays < 1 || validityDays > 3650) {
        throw new Error("voucher_validity_missing");
      }
      const missing = item.qty - item.vouchers.length;
      for (let index = 0; index < missing; index += 1) {
        await tx.voucher.create({
          data: {
            orderItemId: item.id,
            code: voucherCode(),
            kind:
              item.kind === "GIFT_CARD"
                ? "GIFT_BALANCE"
                : "TREATMENT_SINGLE_USE",
            initialValue: item.unitPrice,
            remainingValue: item.unitPrice,
            currency: order.currency,
            expiresAt: expiresAfter(validityDays),
          },
        });
      }
    }

    const hasPhysical = order.items.some((item) => item.kind === "PHYSICAL");
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        status: hasPhysical ? "CONFIRMED" : "FULFILLED",
        confirmedAt: order.confirmedAt ?? now,
        fulfilledAt: hasPhysical
          ? order.fulfilledAt
          : (order.fulfilledAt ?? now),
        cancelledAt: null,
        cancellationReason: null,
        total: minorToEuros(amountTotal),
        shippingAmount: minorToEuros(
          session.total_details?.amount_shipping ?? 0,
        ),
        shippingAddress: shippingAddress(session) ?? Prisma.DbNull,
      },
    });
  });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      ...orderNotificationInclude,
      items: { include: { vouchers: true } },
    },
  });
  if (order && didFulfill) {
    await notifyOrderReceipt(order, order.locale as Locale);
  }
  return order;
}

export async function markCheckoutSessionEnded(
  session: Stripe.Checkout.Session,
  status: Extract<PaymentStatus, "FAILED" | "EXPIRED">,
) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    include: { order: true },
  });
  if (!attempt || attempt.order.source !== "WEBSITE_STRIPE") return null;
  if (["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(attempt.status)) {
    return attempt.order;
  }
  const nextStatus =
    status === "EXPIRED" && attempt.cancelRequestedAt ? "CANCELLED" : status;
  const now = new Date();
  const changed = await prisma.$transaction(async (tx) => {
    const claim = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["UNPAID", "PROCESSING"] } },
      data: { status: nextStatus, failedAt: now },
    });
    if (!claim.count) return false;
    await tx.order.update({
      where: { id: attempt.orderId },
      data: {
        paymentStatus: nextStatus,
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason:
          nextStatus === "CANCELLED"
            ? "customer_cancelled_stripe_checkout"
            : nextStatus === "EXPIRED"
              ? "stripe_checkout_expired"
              : "stripe_payment_failed",
      },
    });
    return true;
  });
  const order = await prisma.order.findUnique({
    where: { id: attempt.orderId },
    include: orderNotificationInclude,
  });
  if (order && changed && nextStatus === "FAILED") {
    await notifyOrderPaymentUpdate(
      order,
      order.locale as Locale,
      "payment_failed",
      undefined,
      `payment_failed:${session.id}`,
    );
  }
  return order;
}

export async function reconcileStripeRefund(
  refundOrId: Stripe.Refund | string,
) {
  const refund =
    typeof refundOrId === "string"
      ? (await runExternalApiAttempt({ provider: "stripe", operation: "refunds.retrieve", context: { correlationId: refundOrId }, run: () => stripeClient().refunds.retrieve(refundOrId), responseMetadata: (value) => ({ id: value.id, status: value.status }) })).value
      : refundOrId;
  const paymentIntentId = stripeObjectId(refund.payment_intent);
  if (!paymentIntentId) return null;
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { order: true },
  });
  if (!attempt || attempt.order.source !== "WEBSITE_STRIPE") return null;

  const stored = await prisma.refund.findFirst({
    where: {
      OR: [
        { stripeRefundId: refund.id },
        { id: refund.metadata?.refundId || "__missing__" },
      ],
    },
    include: { allocations: { include: { orderItem: true } } },
  });
  if (!stored) return null;

  const nextStatus =
    refund.status === "succeeded"
      ? "SUCCEEDED"
      : refund.status === "failed"
        ? "FAILED"
        : refund.status === "canceled"
          ? "CANCELLED"
          : "PENDING";
  let transitioned = false;
  await prisma.$transaction(async (tx) => {
    const changed = await tx.refund.updateMany({
      where: {
        id: stored.id,
        ...(nextStatus === "PENDING" ? {} : { status: "PENDING" }),
      },
      data: {
        stripeRefundId: refund.id,
        status: nextStatus,
        failureReason: refund.failure_reason ?? null,
        completedAt: nextStatus === "SUCCEEDED" ? new Date() : null,
      },
    });
    transitioned = changed.count > 0;
    if (!transitioned && nextStatus !== "PENDING") return;
    if (nextStatus === "FAILED" || nextStatus === "CANCELLED") {
      const voucherItemIds = stored.allocations
        .map((allocation) => allocation.orderItemId)
        .filter((id): id is string => Boolean(id));
      if (voucherItemIds.length) {
        await tx.voucher.updateMany({
          where: {
            orderItemId: { in: voucherItemIds },
            status: "REFUND_PENDING",
          },
          data: { status: "ACTIVE" },
        });
      }
      return;
    }
    if (nextStatus !== "SUCCEEDED") return;

    for (const allocation of stored.allocations) {
      if (!allocation.orderItemId || allocation.orderItem?.kind === "PHYSICAL")
        continue;
      const vouchers = await tx.voucher.findMany({
        where: { orderItemId: allocation.orderItemId },
        orderBy: { createdAt: "asc" },
      });
      let remaining = Number(allocation.amount);
      for (const voucher of vouchers) {
        if (remaining <= 0) break;
        const available = Number(voucher.remainingValue);
        const reduction = Math.min(available, remaining);
        const next = available - reduction;
        await tx.voucher.update({
          where: { id: voucher.id },
          data: {
            remainingValue: next.toFixed(2),
            status: next === 0 ? "VOID" : "ACTIVE",
          },
        });
        remaining -= reduction;
      }
    }

    const successful = await tx.refund.aggregate({
      where: { paymentAttemptId: attempt.id, status: "SUCCEEDED" },
      _sum: { amount: true },
    });
    const refunded = successful._sum.amount ?? new Prisma.Decimal(0);
    const full = refunded.greaterThanOrEqualTo(attempt.amount);
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        amountRefunded: refunded,
        status: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });
    await tx.order.update({
      where: { id: attempt.orderId },
      data: {
        paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
        ...(full && attempt.order.status !== "FULFILLED"
          ? { status: "CANCELLED", cancelledAt: new Date() }
          : {}),
      },
    });
  });
  const updatedRefund = await prisma.refund.findUnique({
    where: { id: stored.id },
  });
  const order = await prisma.order.findUnique({
    where: { id: attempt.orderId },
    include: orderNotificationInclude,
  });
  if (
    order &&
    transitioned &&
    (nextStatus === "SUCCEEDED" || nextStatus === "FAILED")
  ) {
    await notifyOrderPaymentUpdate(
      order,
      order.locale as Locale,
      nextStatus === "SUCCEEDED" ? "refund" : "refund_failed",
      `${Number(stored.amount).toFixed(2)} ${stored.currency}`,
      `refund:${stored.id}:${nextStatus.toLowerCase()}`,
    );
  }
  return updatedRefund;
}
