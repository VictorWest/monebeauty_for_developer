ALTER TABLE "ServiceOption" ADD COLUMN "bookingServiceId" TEXT;

CREATE INDEX "ServiceOption_bookingServiceId_idx" ON "ServiceOption"("bookingServiceId");

ALTER TABLE "ServiceOption"
ADD CONSTRAINT "ServiceOption_bookingServiceId_fkey"
FOREIGN KEY ("bookingServiceId") REFERENCES "Service"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
