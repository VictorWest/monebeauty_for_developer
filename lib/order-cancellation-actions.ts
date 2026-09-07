"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditForUser, currentUser, isBackofficeRole } from "@/lib/auth";
import { accountHref } from "@/lib/account-routing";
import { adminHref } from "@/lib/admin-routing";
import { runExternalApiAttempt } from "@/lib/external-api";
import { reconcileCheckoutSession } from "@/lib/stripe-payments";
import {
  notifyOrderCancellation,
  notifyOrderCancellationRequest,
} from "@/lib/notifications";
import { eurosToMinor, minorToEuros, stripeClient } from "@/lib/stripe";
import type { Locale } from "@/i18n/routing";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function localeFrom(formData: FormData): Locale {
  const locale = text(formData, "locale");
  return locale === "en" || locale === "ru" ? locale : "fi";
}

function accountOrders(locale: Locale, notice?: string) {
  const query = new URLSearchParams({ view: "orders" });
  if (notice) query.set("notice", notice);
  return `${accountHref(locale)}?${query}`;
}

function adminReturn(formData: FormData, locale: Locale) {
  const value = text(formData, "returnTo");
  return /^\/(?:en\/|ru\/)?admin(?:\/|$)/.test(value)
    ? value
    : adminHref(locale, "orders");
}

const terminalOrderStatuses = ["SHIPPED", "FULFILLED", "CANCELLED"] as const;

export async function createOrderCancellationRequestAction(formData: FormData) {
  const locale = localeFrom(formData);
  const user = await currentUser("client");
  if (!user || user.role !== "CLIENT" || !user.emailVerifiedAt)
    redirect(accountHref(locale, "login"));
  const client = await prisma.client.findUnique({ where: { userId: user.id } });
  const orderId = text(formData, "orderId");
  const reason = text(formData, "reason").slice(0, 500);
  if (!client || reason.length < 3)
    redirect(accountOrders(locale, "cancellation_invalid"));
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      clientId: client.id,
      status: { notIn: [...terminalOrderStatuses] },
    },
  });
  if (!order) redirect(accountOrders(locale, "cancellation_unavailable"));
  let request;
  try {
    request = await prisma.orderCancellationRequest.create({
      data: { orderId: order.id, clientId: client.id, reason },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      redirect(accountOrders(locale, "cancellation_pending"));
    throw error;
  }
  await auditForUser(
    user,
    "order_cancellation_requested",
    "OrderCancellationRequest",
    request.id,
    {
      metadata: { orderId: order.id },
    },
  );
  await notifyOrderCancellationRequest(
    order,
    order.locale as Locale,
    "requested",
    reason,
    request.id,
    user.email,
  );
  revalidatePath(accountHref(locale));
  redirect(accountOrders(locale, "cancellation_requested"));
}

type ReviewOrder = Prisma.OrderGetPayload<{
  include: {
    payments: true;
    refunds: { include: { allocations: true } };
    items: {
      include: {
        vouchers: true;
        refundAllocations: { include: { refund: true } };
      };
    };
  };
}>;

function remainingRefund(order: ReviewOrder) {
  const payment = order.payments.find((candidate) =>
    ["PAID", "PARTIALLY_REFUNDED"].includes(candidate.status),
  );
  if (!payment?.stripePaymentIntentId) return null;
  const reserved = order.refunds
    .filter((refund) => ["PENDING", "SUCCEEDED"].includes(refund.status))
    .reduce((sum, refund) => sum + eurosToMinor(refund.amount), 0);
  const amount = eurosToMinor(payment.amount) - reserved;
  if (amount < 1) return null;

  let unallocated = amount;
  const allocations: Array<{
    orderItemId?: string;
    amount: string;
    shipping?: boolean;
  }> = [];
  for (const item of order.items) {
    const allocated = item.refundAllocations
      .filter((allocation) =>
        ["PENDING", "SUCCEEDED"].includes(allocation.refund.status),
      )
      .reduce((sum, allocation) => sum + eurosToMinor(allocation.amount), 0);
    const lineRemaining = eurosToMinor(item.unitPrice) * item.qty - allocated;
    const refundable =
      item.kind === "PHYSICAL"
        ? lineRemaining
        : Math.min(
            lineRemaining,
            item.vouchers.reduce(
              (sum, voucher) => sum + eurosToMinor(voucher.remainingValue),
              0,
            ),
          );
    const allocatedNow = Math.min(unallocated, refundable);
    if (allocatedNow > 0) {
      allocations.push({
        orderItemId: item.id,
        amount: minorToEuros(allocatedNow),
      });
      unallocated -= allocatedNow;
    }
  }
  const shippingAllocated = order.refunds
    .filter((refund) => ["PENDING", "SUCCEEDED"].includes(refund.status))
    .flatMap((refund) => refund.allocations)
    .filter((allocation) => allocation.shipping)
    .reduce((sum, allocation) => sum + eurosToMinor(allocation.amount), 0);
  const shipping = Math.min(
    unallocated,
    Math.max(0, eurosToMinor(order.shippingAmount) - shippingAllocated),
  );
  if (shipping > 0) {
    allocations.push({ amount: minorToEuros(shipping), shipping: true });
    unallocated -= shipping;
  }
  return unallocated === 0 && allocations.length
    ? { payment, amount, allocations }
    : null;
}

async function approvePaidRequest(
  requestId: string,
  order: ReviewOrder,
  reason: string,
  actor: string,
) {
  const remaining = remainingRefund(order);
  if (!remaining) throw new Error("not_refundable");
  const idempotencyKey = `order-cancellation:${requestId}`;
  const refund = await prisma.$transaction(async (tx) => {
    const existing = await tx.refund.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.status !== "FAILED") throw new Error("already_processing");
      await tx.refund.update({
        where: { id: existing.id },
        data: { status: "PENDING", failureReason: null },
      });
      await tx.voucher.updateMany({
        where: {
          orderItemId: {
            in: remaining.allocations
              .map((allocation) => allocation.orderItemId)
              .filter((id): id is string => Boolean(id)),
          },
          status: { in: ["ACTIVE", "PARTIALLY_REDEEMED"] },
        },
        data: { status: "REFUND_PENDING" },
      });
      return existing;
    }
    const created = await tx.refund.create({
      data: {
        orderId: order.id,
        paymentAttemptId: remaining.payment.id,
        idempotencyKey,
        amount: minorToEuros(remaining.amount),
        currency: order.currency,
        reason,
        actor,
        allocations: { create: remaining.allocations },
      },
    });
    await tx.voucher.updateMany({
      where: {
        orderItemId: {
          in: remaining.allocations
            .map((allocation) => allocation.orderItemId)
            .filter((id): id is string => Boolean(id)),
        },
        status: { in: ["ACTIVE", "PARTIALLY_REDEEMED"] },
      },
      data: { status: "REFUND_PENDING" },
    });
    return created;
  });
  try {
    const { value } = await runExternalApiAttempt({
      provider: "stripe",
      operation: "refunds.create",
      context: { orderId: order.id, correlationId: idempotencyKey },
      requestMetadata: { amount: remaining.amount, currency: order.currency },
      run: () =>
        stripeClient().refunds.create(
          {
            payment_intent: remaining.payment.stripePaymentIntentId!,
            amount: remaining.amount,
            reason: "requested_by_customer",
            metadata: {
              source: "website",
              orderId: order.id,
              refundId: refund.id,
              cancellationRequestId: requestId,
            },
          },
          { idempotencyKey },
        ),
      responseMetadata: (value) => ({ id: value.id, status: value.status }),
    });
    await prisma.refund.update({
      where: { id: refund.id },
      data: { stripeRefundId: value.id },
    });
  } catch (error) {
    await prisma.$transaction([
      prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: "FAILED",
          failureReason:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "stripe_error",
        },
      }),
      prisma.voucher.updateMany({
        where: {
          orderItemId: {
            in: remaining.allocations
              .map((allocation) => allocation.orderItemId)
              .filter((id): id is string => Boolean(id)),
          },
          status: "REFUND_PENDING",
        },
        data: { status: "ACTIVE" },
      }),
    ]);
    throw error;
  }
}

export async function reviewOrderCancellationRequestAction(formData: FormData) {
  const locale = localeFrom(formData);
  const returnTo = adminReturn(formData, locale);
  const user = await currentUser("backoffice");
  if (!user || !isBackofficeRole(user.role))
    redirect(adminHref(locale, "login"));
  const requestId = text(formData, "requestId");
  const intent = text(formData, "intent");
  const decisionReason = text(formData, "decisionReason").slice(0, 500);
  if (
    !requestId ||
    !["approve", "reject"].includes(intent) ||
    (intent === "reject" && decisionReason.length < 3)
  )
    redirect(`${returnTo}?error=validation`);
  const request = await prisma.orderCancellationRequest.findFirst({
    where: { id: requestId, status: "PENDING" },
    include: {
      order: {
        include: {
          payments: { orderBy: { createdAt: "desc" } },
          refunds: { include: { allocations: true } },
          items: {
            include: {
              vouchers: true,
              refundAllocations: { include: { refund: true } },
            },
          },
        },
      },
    },
  });
  if (!request || terminalOrderStatuses.includes(request.order.status as never))
    redirect(`${returnTo}?error=stale_request`);

  if (intent === "reject") {
    const changed = await prisma.orderCancellationRequest.updateMany({
      where: { id: request.id, status: "PENDING", reviewedById: null },
      data: {
        status: "REJECTED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        decisionReason,
      },
    });
    if (!changed.count) redirect(`${returnTo}?error=stale_request`);
  } else {
    const order = request.order;
    const claimed = await prisma.orderCancellationRequest.updateMany({
      where: { id: request.id, status: "PENDING", reviewedById: null },
      data: { reviewedById: user.id },
    });
    if (!claimed.count) redirect(`${returnTo}?error=stale_request`);
    try {
      if (
        order.source === "LEGACY_REQUEST" &&
        order.paymentStatus === "UNPAID"
      ) {
        await prisma.$transaction(async (tx) => {
          const changed = await tx.order.updateMany({
            where: {
              id: order.id,
              status: { notIn: [...terminalOrderStatuses] },
              paymentStatus: "UNPAID",
            },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancellationReason: request.reason,
            },
          });
          if (!changed.count) throw new Error("stale_request");
          const decided = await tx.orderCancellationRequest.updateMany({
            where: {
              id: request.id,
              status: "PENDING",
              reviewedById: user.id,
            },
            data: {
              status: "APPROVED",
              reviewedAt: new Date(),
              decisionReason: decisionReason || null,
            },
          });
          if (!decided.count) throw new Error("stale_request");
        });
        await notifyOrderCancellation(
          order,
          order.locale as Locale,
          request.reason,
          user.email,
        );
      } else if (
        order.source === "WEBSITE_STRIPE" &&
        ["UNPAID", "PROCESSING"].includes(order.paymentStatus)
      ) {
        const payment = order.payments.find((candidate) =>
          ["UNPAID", "PROCESSING"].includes(candidate.status),
        );
        if (!payment?.stripeCheckoutSessionId)
          throw new Error("checkout_missing");
        const claimed = await prisma.paymentAttempt.updateMany({
          where: {
            id: payment.id,
            status: { in: ["UNPAID", "PROCESSING"] },
            cancelRequestedAt: null,
          },
          data: { cancelRequestedAt: new Date() },
        });
        if (!claimed.count) throw new Error("stale_request");
        try {
          const { value: session } = await runExternalApiAttempt({
            provider: "stripe",
            operation: "checkout.sessions.retrieve",
            context: { orderId: order.id, correlationId: request.id },
            run: () =>
              stripeClient().checkout.sessions.retrieve(
                payment.stripeCheckoutSessionId!,
              ),
            responseMetadata: (value) => ({
              id: value.id,
              status: value.status,
            }),
          });
          if (session.status === "complete") {
            await reconcileCheckoutSession(session);
            throw new Error("payment_state_changed");
          }
          if (session.status === "open") {
            await runExternalApiAttempt({
              provider: "stripe",
              operation: "checkout.sessions.expire",
              context: { orderId: order.id, correlationId: request.id },
              run: () => stripeClient().checkout.sessions.expire(session.id),
              responseMetadata: (value) => ({
                id: value.id,
                status: value.status,
              }),
            });
          }
        } catch (error) {
          await prisma.paymentAttempt.updateMany({
            where: { id: payment.id, status: { in: ["UNPAID", "PROCESSING"] } },
            data: { cancelRequestedAt: null },
          });
          throw error;
        }
        const decided = await prisma.orderCancellationRequest.updateMany({
          where: {
            id: request.id,
            status: "PENDING",
            reviewedById: user.id,
          },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            decisionReason: decisionReason || null,
          },
        });
        if (!decided.count) throw new Error("stale_request");
      } else if (
        order.source === "WEBSITE_STRIPE" &&
        ["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus)
      ) {
        await approvePaidRequest(request.id, order, request.reason, user.email);
        const decided = await prisma.orderCancellationRequest.updateMany({
          where: {
            id: request.id,
            status: "PENDING",
            reviewedById: user.id,
          },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            decisionReason: decisionReason || null,
          },
        });
        if (!decided.count) throw new Error("stale_request");
      } else {
        throw new Error("stale_request");
      }
    } catch (error) {
      await prisma.orderCancellationRequest.updateMany({
        where: {
          id: request.id,
          status: "PENDING",
          reviewedById: user.id,
        },
        data: { reviewedById: null },
      });
      await auditForUser(
        user,
        "order_cancellation_review_failed",
        "OrderCancellationRequest",
        request.id,
        {
          outcome: "FAILURE",
          metadata: {
            orderId: order.id,
            reason:
              error instanceof Error ? error.message.slice(0, 80) : "unknown",
          },
        },
      );
      redirect(`${returnTo}?error=review_failed`);
    }
  }

  await auditForUser(
    user,
    `order_cancellation_${intent === "approve" ? "approved" : "rejected"}`,
    "OrderCancellationRequest",
    request.id,
    {
      metadata: { orderId: request.order.id },
    },
  );
  await notifyOrderCancellationRequest(
    request.order,
    request.order.locale as Locale,
    intent === "approve" ? "approved" : "rejected",
    decisionReason || request.reason,
    `${request.id}:${intent}`,
    user.email,
  );
  revalidatePath(returnTo);
  redirect(`${returnTo}?saved=1`);
}
