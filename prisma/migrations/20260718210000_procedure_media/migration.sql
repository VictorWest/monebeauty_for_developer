CREATE TABLE "ProcedureMedia" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "identities" JSONB NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceLicense" TEXT NOT NULL DEFAULT 'CLINIC_ARCHIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcedureMedia_serviceId_key_key" ON "ProcedureMedia"("serviceId", "key");
CREATE INDEX "ProcedureMedia_serviceId_idx" ON "ProcedureMedia"("serviceId");

ALTER TABLE "ProcedureMedia" ADD CONSTRAINT "ProcedureMedia_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
