// One-off correction: the appointment buffer changed from 15 to 10 minutes.
// Changing the schema default only affects NEW rows going forward. Per the
// requirements doc, every already-booked FUTURE appointment must also be
// updated to the new 10-minute buffer (both the stored bufferMinutes value
// and the derived reservedUntil timestamp used for overlap checks). Past/
// completed/cancelled appointments are left untouched since re-tightening
// their buffer has no effect and only risks touching historical records.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NEW_BUFFER_MINUTES = 10;

async function main() {
  const candidates = await prisma.appointment.findMany({
    where: {
      start: { gt: new Date() },
      status: { not: "CANCELLED" },
      bufferEnforced: true,
      bufferMinutes: { not: NEW_BUFFER_MINUTES },
    },
    select: { id: true, end: true, bufferMinutes: true },
  });

  let updated = 0;
  for (const appointment of candidates) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        bufferMinutes: NEW_BUFFER_MINUTES,
        reservedUntil: new Date(
          appointment.end.getTime() + NEW_BUFFER_MINUTES * 60_000,
        ),
      },
    });
    updated += 1;
  }

  console.log(
    JSON.stringify({ candidatesFound: candidates.length, updated }, null, 2),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
