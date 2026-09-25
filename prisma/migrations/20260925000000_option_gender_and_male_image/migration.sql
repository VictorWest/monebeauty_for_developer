-- AlterTable
ALTER TABLE "ServiceOption" ADD COLUMN     "targetGender" "ServiceGender" NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "maleImage" TEXT;
