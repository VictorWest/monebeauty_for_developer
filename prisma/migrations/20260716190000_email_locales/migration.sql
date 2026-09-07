-- Persist the locale used for customer transactional emails.
-- The defaults assign all existing appointments and orders to Finnish.
ALTER TABLE "Appointment"
  ADD COLUMN "locale" "Locale" NOT NULL DEFAULT 'fi';

ALTER TABLE "Order"
  ADD COLUMN "locale" "Locale" NOT NULL DEFAULT 'fi';
