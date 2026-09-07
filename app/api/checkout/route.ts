import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeQty } from "@/lib/cart";
import { routing, type Locale } from "@/i18n/routing";
import { normalizeCheckoutPhone } from "@/lib/phone";
import { normalizeContactEmail } from "@/lib/contact-normalization";
import { localizedPath, siteUrl } from "@/lib/seo";
import { orderPath } from "@/lib/public-routes";
import { currentUser } from "@/lib/auth";
import { runExternalApiAttempt } from "@/lib/external-api";
import {
  eurosToMinor,
  createCheckoutCancelToken,
  minorToEuros,
  stripeClient,
  stripeShippingRateId,
} from "@/lib/stripe";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function absoluteImage(path: string) {
  if (/^https:\/\//i.test(path)) return path;
  const origin = siteUrl();
  if (!origin.startsWith("https://")) return undefined;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const user = await currentUser("client");
  const accountClient =
    user?.role === "CLIENT"
      ? await prisma.client.findUnique({ where: { userId: user.id } })
      : null;
  const fullName = String(accountClient?.fullName ?? payload.fullName ?? "")
    .trim()
    .slice(0, 180);
  const phone = normalizeCheckoutPhone(String(payload.phone ?? ""));
  const email = String(accountClient?.email ?? payload.email ?? "")
    .trim()
    .toLowerCase();
  const notes = payload.notes ? String(payload.notes).slice(0, 2000) : null;
  const locale = routing.locales.includes(payload.locale as Locale)
    ? (payload.locale as Locale)
    : routing.defaultLocale;
  const consentGdpr = payload.consentGdpr === true;
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const requestedFulfillment = String(
    payload.fulfillmentMethod ?? "",
  ).toUpperCase();

  if (!fullName) return bad("name_required");
  if (!phone) return bad("phone_invalid");
  if (!EMAIL_RE.test(email)) return bad("email_required");
  if (!consentGdpr) return bad("consent_required");

  const qtyBySlug = new Map<string, number>();
  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const slug = String((item as { slug?: unknown }).slug ?? "");
    if (!slug) continue;
    const qty = normalizeQty(Number((item as { qty?: unknown }).qty));
    qtyBySlug.set(slug, normalizeQty((qtyBySlug.get(slug) ?? 0) + qty));
  }
  if (!qtyBySlug.size) return bad("empty_cart");

  const products = await prisma.product.findMany({
    where: {
      slug: { in: [...qtyBySlug.keys()] },
      published: true,
      archivedAt: null,
    },
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
    },
  });
  if (products.length !== qtyBySlug.size) return bad("product_unavailable");
  if (products.some((product) => product.currency.toUpperCase() !== "EUR")) {
    return bad("currency_unavailable");
  }
  if (products.some((product) => !product.contents[0])) {
    return bad("product_unavailable");
  }

  const hasPhysical = products.some((product) => product.kind === "PHYSICAL");
  const fulfillmentMethod = hasPhysical
    ? requestedFulfillment === "SHIPPING"
      ? "SHIPPING"
      : requestedFulfillment === "PICKUP"
        ? "PICKUP"
        : null
    : "DIGITAL";
  if (!fulfillmentMethod) return bad("fulfillment_required");

  const requestedAddressId = String(payload.savedAddressId ?? "");
  const savedAddress =
    fulfillmentMethod === "SHIPPING" && accountClient && requestedAddressId
      ? await prisma.savedAddress.findFirst({
          where: { id: requestedAddressId, clientId: accountClient.id },
        })
      : null;
  const rawAddress =
    payload.shippingAddress && typeof payload.shippingAddress === "object"
      ? (payload.shippingAddress as Record<string, unknown>)
      : null;
  const oneOffAddress = rawAddress
    ? {
        label: String(rawAddress.label ?? "Home")
          .trim()
          .slice(0, 60),
        recipientName: String(rawAddress.recipientName ?? "")
          .trim()
          .slice(0, 160),
        phone,
        line1: String(rawAddress.line1 ?? "")
          .trim()
          .slice(0, 180),
        line2:
          String(rawAddress.line2 ?? "")
            .trim()
            .slice(0, 180) || null,
        postalCode: String(rawAddress.postalCode ?? "").trim(),
        city: String(rawAddress.city ?? "")
          .trim()
          .slice(0, 100),
        country: "FI",
      }
    : null;
  if (fulfillmentMethod === "SHIPPING" && requestedAddressId && !savedAddress)
    return bad("address_invalid");
  if (
    fulfillmentMethod === "SHIPPING" &&
    !savedAddress &&
    (!oneOffAddress ||
      !oneOffAddress.recipientName ||
      !oneOffAddress.phone ||
      !oneOffAddress.line1 ||
      !/^\d{5}$/.test(oneOffAddress.postalCode) ||
      !oneOffAddress.city)
  )
    return bad("address_invalid");
  const selectedAddress = savedAddress ?? oneOffAddress;

  const lineItems = products.map((product) => ({
    quantity: qtyBySlug.get(product.slug)!,
    price_data: {
      currency: "eur",
      unit_amount: eurosToMinor(product.price),
      product_data: {
        name: product.contents[0].name,
        ...(product.contents[0].shortDescription
          ? { description: product.contents[0].shortDescription.slice(0, 500) }
          : {}),
        ...(() => {
          const image = product.images[0] && absoluteImage(product.images[0]);
          return image ? { images: [image] } : {};
        })(),
        metadata: { productId: product.id, productKind: product.kind },
      },
    },
  }));
  const subtotalMinor = lineItems.reduce(
    (sum, item) =>
      sum +
      Number(item.price_data?.unit_amount ?? 0) * Number(item.quantity ?? 1),
    0,
  );

  let orderId: string | undefined;
  try {
    const cancellation = createCheckoutCancelToken();
    const existing =
      accountClient ??
      (await prisma.client.findFirst({ where: { email, userId: null } }));
    const client =
      accountClient ??
      (existing
        ? await prisma.client.update({
            where: { id: existing.id },
            data: { fullName, phone, consentGdpr: true },
          })
        : await prisma.client.create({
            data: { fullName, phone, email, consentGdpr: true },
          }));
    let selectedSavedAddressId = savedAddress?.id ?? null;
    if (
      fulfillmentMethod === "SHIPPING" &&
      !savedAddress &&
      oneOffAddress &&
      payload.saveAddress === true &&
      accountClient
    ) {
      const count = await prisma.savedAddress.count({
        where: { clientId: accountClient.id },
      });
      if (count < 10) {
        const created = await prisma.savedAddress.create({
          data: {
            ...oneOffAddress,
            clientId: accountClient.id,
            isDefault: count === 0,
          },
        });
        selectedSavedAddressId = created.id;
      }
    }

    let stripeCustomerId = accountClient?.stripeCustomerId ?? null;
    if (accountClient) {
      const address = selectedAddress
        ? {
            line1: selectedAddress.line1,
            line2: selectedAddress.line2 ?? undefined,
            postal_code: selectedAddress.postalCode,
            city: selectedAddress.city,
            country: "FI" as const,
          }
        : undefined;
      const shipping =
        address && selectedAddress
          ? { name: selectedAddress.recipientName, phone, address }
          : undefined;
      if (stripeCustomerId) {
        await runExternalApiAttempt({
          provider: "stripe",
          operation: "customers.update",
          context: { correlationId: accountClient.id },
          requestMetadata: { hasAddress: Boolean(address) },
          run: () =>
            stripeClient().customers.update(stripeCustomerId!, {
              name: fullName,
              email,
              phone,
              ...(address ? { address, shipping } : {}),
            }),
          responseMetadata: (value) => ({ id: value.id }),
        });
      } else {
        const { value: customer } = await runExternalApiAttempt({
          provider: "stripe",
          operation: "customers.create",
          context: { correlationId: accountClient.id },
          requestMetadata: { hasAddress: Boolean(address) },
          run: () =>
            stripeClient().customers.create({
              name: fullName,
              email,
              phone,
              ...(address ? { address, shipping } : {}),
              metadata: { clientId: accountClient.id },
            }),
          responseMetadata: (value) => ({ id: value.id }),
        });
        stripeCustomerId = customer.id;
        await prisma.client.update({
          where: { id: accountClient.id },
          data: { stripeCustomerId },
        });
      }
    }

    const order = await prisma.order.create({
      data: {
        clientId: client.id,
        savedAddressId: selectedSavedAddressId,
        locale,
        source: "WEBSITE_STRIPE",
        paymentStatus: "UNPAID",
        fulfillmentMethod,
        shippingAddress: selectedAddress
          ? {
              recipientName: selectedAddress.recipientName,
              phone,
              line1: selectedAddress.line1,
              line2: selectedAddress.line2,
              postalCode: selectedAddress.postalCode,
              city: selectedAddress.city,
              country: "FI",
            }
          : undefined,
        subtotal: minorToEuros(subtotalMinor),
        total: minorToEuros(subtotalMinor),
        currency: "EUR",
        email,
        phone,
        normalizedEmail: normalizeContactEmail(email),
        normalizedPhone: phone,
        notes,
        consentGdpr: true,
        items: {
          create: products.map((product) => ({
            productId: product.id,
            name: product.contents[0].name,
            unitPrice: product.price,
            qty: qtyBySlug.get(product.slug)!,
            kind: product.kind,
            voucherValidityDays: product.voucherValidityDays,
          })),
        },
        payments: {
          create: {
            idempotencyKey: `checkout:${crypto.randomUUID()}`,
            amount: minorToEuros(subtotalMinor),
            currency: "EUR",
            checkoutCancelTokenHash: cancellation.hash,
          },
        },
      },
      include: { payments: true },
    });
    orderId = order.id;
    const attempt = order.payments[0];
    const successUrl = `${siteUrl()}${localizedPath(orderPath(order.id), locale)}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = new URL("/api/checkout/cancel", siteUrl());
    cancelUrl.searchParams.set("token", cancellation.token);
    const metadata = {
      source: "website",
      orderId: order.id,
      locale,
      fulfillmentMethod,
    };
    const { value: session } = await runExternalApiAttempt({
      provider: "stripe",
      operation: "checkout.sessions.create",
      context: { orderId: order.id, correlationId: attempt.idempotencyKey },
      requestMetadata: {
        fulfillmentMethod,
        itemCount: lineItems.length,
        currency: "EUR",
      },
      run: () =>
        stripeClient().checkout.sessions.create(
          {
            mode: "payment",
            locale,
            client_reference_id: order.id,
            ...(stripeCustomerId
              ? { customer: stripeCustomerId }
              : { customer_email: email }),
            line_items: lineItems,
            success_url: successUrl,
            cancel_url: cancelUrl.toString(),
            metadata,
            payment_intent_data: { metadata },
            ...(fulfillmentMethod === "SHIPPING"
              ? {
                  shipping_address_collection: { allowed_countries: ["FI"] },
                  shipping_options: [{ shipping_rate: stripeShippingRateId() }],
                  ...(stripeCustomerId
                    ? { customer_update: { shipping: "auto" as const } }
                    : {}),
                }
              : {}),
          },
          { idempotencyKey: attempt.idempotencyKey },
        ),
      responseMetadata: (value) => ({
        id: value.id,
        status: value.status,
        paymentStatus: value.payment_status,
        amountTotal: value.amount_total,
      }),
    });
    if (!session.url || session.amount_total == null) {
      throw new Error("stripe_session_incomplete");
    }
    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          stripeCheckoutSessionId: session.id,
          amount: minorToEuros(session.amount_total),
          expiresAt: new Date(session.expires_at * 1000),
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          total: minorToEuros(session.amount_total),
          shippingAmount: minorToEuros(
            session.total_details?.amount_shipping ?? 0,
          ),
        },
      }),
      prisma.consent.create({
        data: { clientId: client.id, type: "gdpr_checkout", granted: true },
      }),
      ...(selectedSavedAddressId
        ? [
            prisma.savedAddress.update({
              where: { id: selectedSavedAddressId },
              data: { lastUsedAt: new Date() },
            }),
          ]
        : []),
    ]);
    return NextResponse.json({ orderId: order.id, checkoutUrl: session.url });
  } catch {
    if (orderId) {
      await prisma.order
        .update({
          where: { id: orderId },
          data: {
            paymentStatus: "FAILED",
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "stripe_session_creation_failed",
          },
        })
        .catch(() => undefined);
    }
    return NextResponse.json({ error: "payment_unavailable" }, { status: 503 });
  }
}
