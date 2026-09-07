ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'GIFT_CARD';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'TREATMENT';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'OTHER';

CREATE TYPE "ProductKind" AS ENUM ('PHYSICAL', 'GIFT_CARD', 'TREATMENT_VOUCHER');
CREATE TYPE "OrderSource" AS ENUM ('LEGACY_REQUEST', 'WEBSITE_STRIPE');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PROCESSING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'EXPIRED');
CREATE TYPE "FulfillmentMethod" AS ENUM ('PICKUP', 'SHIPPING', 'DIGITAL');
CREATE TYPE "StripeEventStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "VoucherKind" AS ENUM ('GIFT_BALANCE', 'TREATMENT_SINGLE_USE');
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'PARTIALLY_REDEEMED', 'REDEEMED', 'REFUND_PENDING', 'VOID', 'EXPIRED');

ALTER TYPE "OutboundMessageKind" ADD VALUE IF NOT EXISTS 'ORDER_PAYMENT_FAILED';
ALTER TYPE "OutboundMessageKind" ADD VALUE IF NOT EXISTS 'ORDER_READY_FOR_PICKUP';
ALTER TYPE "OutboundMessageKind" ADD VALUE IF NOT EXISTS 'ORDER_SHIPPED';
ALTER TYPE "OutboundMessageKind" ADD VALUE IF NOT EXISTS 'ORDER_FULFILLED';
ALTER TYPE "OutboundMessageKind" ADD VALUE IF NOT EXISTS 'ORDER_REFUND';
ALTER TYPE "OutboundMessageKind" ADD VALUE IF NOT EXISTS 'ORDER_REFUND_FAILED';

ALTER TABLE "Order" ADD COLUMN "_legacyWasPaid" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Order" SET "_legacyWasPaid" = true WHERE "status"::text = 'PAID';
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'SHIPPED', 'FULFILLED', 'CANCELLED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus"
  USING (CASE WHEN "status"::text = 'PAID' THEN 'CONFIRMED' ELSE "status"::text END)::"OrderStatus";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "OrderStatus_old";

ALTER TABLE "Product"
  ADD COLUMN "kind" "ProductKind" NOT NULL DEFAULT 'PHYSICAL',
  ADD COLUMN "serviceId" TEXT,
  ADD COLUMN "voucherValidityDays" INTEGER;

ALTER TABLE "Order"
  ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'LEGACY_REQUEST',
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "fulfillmentMethod" "FulfillmentMethod",
  ADD COLUMN "shippingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "shippingAddress" JSONB,
  ADD COLUMN "readyAt" TIMESTAMP(3),
  ADD COLUMN "shippedAt" TIMESTAMP(3);

UPDATE "Order" SET "paymentStatus" = 'PAID' WHERE "_legacyWasPaid" = true;
ALTER TABLE "Order" DROP COLUMN "_legacyWasPaid";

ALTER TABLE "OrderItem"
  ADD COLUMN "kind" "ProductKind" NOT NULL DEFAULT 'PHYSICAL',
  ADD COLUMN "voucherValidityDays" INTEGER;

CREATE TABLE "PaymentAttempt" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "idempotencyKey" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "amount" DECIMAL(65,30) NOT NULL,
  "amountRefunded" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "objectId" TEXT,
  "status" "StripeEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentAttemptId" TEXT NOT NULL,
  "stripeRefundId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "reason" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefundAllocation" (
  "id" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "orderItemId" TEXT,
  "amount" DECIMAL(65,30) NOT NULL,
  "shipping" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RefundAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Voucher" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" "VoucherKind" NOT NULL,
  "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
  "initialValue" DECIMAL(65,30) NOT NULL,
  "remainingValue" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "redeemedAt" TIMESTAMP(3),
  CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoucherRedemption" (
  "id" TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "actor" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoucherRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentAttempt_stripeCheckoutSessionId_key" ON "PaymentAttempt"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "PaymentAttempt_stripePaymentIntentId_key" ON "PaymentAttempt"("stripePaymentIntentId");
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx" ON "PaymentAttempt"("orderId", "createdAt");
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");
CREATE INDEX "StripeWebhookEvent_status_createdAt_idx" ON "StripeWebhookEvent"("status", "createdAt");
CREATE INDEX "StripeWebhookEvent_type_objectId_idx" ON "StripeWebhookEvent"("type", "objectId");
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId", "createdAt");
CREATE INDEX "Refund_paymentAttemptId_status_idx" ON "Refund"("paymentAttemptId", "status");
CREATE INDEX "RefundAllocation_refundId_idx" ON "RefundAllocation"("refundId");
CREATE INDEX "RefundAllocation_orderItemId_idx" ON "RefundAllocation"("orderItemId");
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");
CREATE INDEX "Voucher_status_expiresAt_idx" ON "Voucher"("status", "expiresAt");
CREATE INDEX "Voucher_orderItemId_idx" ON "Voucher"("orderItemId");
CREATE INDEX "VoucherRedemption_voucherId_createdAt_idx" ON "VoucherRedemption"("voucherId", "createdAt");
CREATE INDEX "Product_kind_published_archivedAt_idx" ON "Product"("kind", "published", "archivedAt");
CREATE INDEX "Product_serviceId_idx" ON "Product"("serviceId");
CREATE INDEX "Order_source_paymentStatus_createdAt_idx" ON "Order"("source", "paymentStatus", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

ALTER TABLE "Product" ADD CONSTRAINT "Product_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
