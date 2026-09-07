import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { routing, type Locale } from "@/i18n/routing";
import { localizedPath, siteUrl } from "@/lib/seo";
import { orderPath, PUBLIC_PATHS } from "@/lib/public-routes";
import { checkoutCancelTokenHash, stripeClient } from "@/lib/stripe";
import { reconcileCheckoutSession } from "@/lib/stripe-payments";
import { runExternalApiAttempt } from "@/lib/external-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localeOf(value: string): Locale {
  return routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
}

function checkoutRedirect(locale: Locale, payment: string) {
  const url = new URL(localizedPath(PUBLIC_PATHS.checkout, locale), siteUrl());
  url.searchParams.set("payment", payment);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function orderRedirect(locale: Locale, orderId: string, sessionId: string) {
  const url = new URL(localizedPath(orderPath(orderId), locale), siteUrl());
  url.searchParams.set("session_id", sessionId);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return checkoutRedirect(routing.defaultLocale, "cancel_error");
  }

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { checkoutCancelTokenHash: checkoutCancelTokenHash(token) },
    include: { order: true },
  });
  if (!attempt || attempt.order.source !== "WEBSITE_STRIPE") {
    return checkoutRedirect(routing.defaultLocale, "cancel_error");
  }

  const locale = localeOf(attempt.order.locale);
  if (!attempt.stripeCheckoutSessionId) {
    return checkoutRedirect(locale, "cancel_error");
  }

  let session;
  try {
    session = (await runExternalApiAttempt({ provider: "stripe", operation: "checkout.sessions.retrieve", context: { orderId: attempt.orderId, correlationId: attempt.id }, run: () => stripeClient().checkout.sessions.retrieve(attempt.stripeCheckoutSessionId!), responseMetadata: (value) => ({ id: value.id, status: value.status }) })).value;
  } catch {
    return checkoutRedirect(locale, "cancel_error");
  }
  if (session.status === "complete") {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { checkoutCancelTokenHash: null },
    });
    await reconcileCheckoutSession(session);
    return orderRedirect(locale, attempt.orderId, session.id);
  }
  if (session.status === "expired") {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { checkoutCancelTokenHash: null },
    });
    return checkoutRedirect(locale, "cancelled");
  }

  const claimed = await prisma.paymentAttempt.updateMany({
    where: {
      id: attempt.id,
      status: { in: ["UNPAID", "PROCESSING"] },
      cancelRequestedAt: null,
    },
    data: {
      cancelRequestedAt: new Date(),
      checkoutCancelTokenHash: null,
    },
  });
  if (!claimed.count) return checkoutRedirect(locale, "cancel_error");

  try {
    await runExternalApiAttempt({ provider: "stripe", operation: "checkout.sessions.expire", context: { orderId: attempt.orderId, correlationId: attempt.id }, run: () => stripeClient().checkout.sessions.expire(session.id), responseMetadata: (value) => ({ id: value.id, status: value.status }) });
    return checkoutRedirect(locale, "cancelled");
  } catch {
    let current;
    try {
      current = (await runExternalApiAttempt({ provider: "stripe", operation: "checkout.sessions.retrieve", context: { orderId: attempt.orderId, correlationId: attempt.id, retryNumber: 1 }, run: () => stripeClient().checkout.sessions.retrieve(session.id), responseMetadata: (value) => ({ id: value.id, status: value.status }) })).value;
    } catch {
      return checkoutRedirect(locale, "cancel_error");
    }
    if (current.status === "complete") {
      await reconcileCheckoutSession(current);
      return orderRedirect(locale, attempt.orderId, current.id);
    }
    return checkoutRedirect(
      locale,
      current.status === "expired" ? "cancelled" : "cancel_error",
    );
  }
}
