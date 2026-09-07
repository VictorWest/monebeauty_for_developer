import { PrismaClient } from "@prisma/client";

// Singleton Prisma client (avoids exhausting connections during dev HMR).
// Connects to the DATABASE_URL Postgres and backs live writes — e.g. the booking API
// (app/api/booking) persists Appointment/Client/Consent rows through this client.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
