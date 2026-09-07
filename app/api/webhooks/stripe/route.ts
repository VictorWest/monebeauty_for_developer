import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripeClient, stripeWebhookSecret } from "@/lib/stripe";
import {
  markCheckoutSessionEnded,
  reconcileCheckoutSession,
  reconcileStripeRefund,
} from "@/lib/stripe-payments";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(
      await req.text(),
      signature,
      stripeWebhookSecret(),
    );
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
  });
  if (existing?.status === "COMPLETED") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  await prisma.stripeWebhookEvent.upsert({
    where: { id: event.id },
    update: { status: "PROCESSING", error: null },
    create: {
      id: event.id,
      type: event.type,
      objectId: "id" in event.data.object ? event.data.object.id : null,
    },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await reconcileCheckoutSession(event.data.object);
        break;
      case "checkout.session.async_payment_failed":
        await markCheckoutSessionEnded(event.data.object, "FAILED");
        break;
      case "checkout.session.expired":
        await markCheckoutSessionEnded(event.data.object, "EXPIRED");
        break;
      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        await reconcileStripeRefund(event.data.object);
        break;
    }
    await prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { status: "COMPLETED", processedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    await prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        error: (error instanceof Error ? error.message : "unknown_error").slice(
          0,
          500,
        ),
      },
    });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
