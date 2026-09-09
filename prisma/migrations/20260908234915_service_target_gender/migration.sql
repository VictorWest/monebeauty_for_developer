-- CreateEnum
CREATE TYPE "ServiceGender" AS ENUM ('WOMEN', 'MEN', 'BOTH');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "targetGender" "ServiceGender" NOT NULL DEFAULT 'BOTH';
