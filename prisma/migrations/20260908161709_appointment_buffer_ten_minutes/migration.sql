-- DropIndex
DROP INDEX "Appointment_deviceId_start_end_idx";

-- DropIndex
DROP INDEX "Appointment_practitionerId_start_end_idx";

-- DropIndex
DROP INDEX "Appointment_roomId_start_end_idx";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "bufferMinutes" SET DEFAULT 10;

-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ArticleContent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConsultationForm" ALTER COLUMN "healthConsentWording" DROP DEFAULT,
ALTER COLUMN "accuracyWording" DROP DEFAULT,
ALTER COLUMN "requiredInformationWording" DROP DEFAULT,
ALTER COLUMN "procedureConsentWording" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Practitioner" ALTER COLUMN "daysOff" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PractitionerServiceCapability" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PricingItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductContent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TreatmentContent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "_DeviceToService" ADD CONSTRAINT "_DeviceToService_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DeviceToService_AB_unique";

-- AlterTable
ALTER TABLE "_RoomToService" ADD CONSTRAINT "_RoomToService_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_RoomToService_AB_unique";

-- RenameIndex
ALTER INDEX "PractitionerServiceCapability_practitionerId_serviceId_roomId_k" RENAME TO "PractitionerServiceCapability_practitionerId_serviceId_room_key";

-- RenameIndex
ALTER INDEX "PractitionerServiceOptionQualification_practitionerId_serviceOp" RENAME TO "PractitionerServiceOptionQualification_practitionerId_servi_key";

-- RenameIndex
ALTER INDEX "PractitionerServiceOptionQualification_serviceOptionId_practiti" RENAME TO "PractitionerServiceOptionQualification_serviceOptionId_prac_idx";
