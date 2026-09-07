import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  availabilityMatchesWeeklySchedule,
  dateFromYmd,
} from "../lib/staff-schedule";
import { clinicDateFromInstant } from "../lib/clinic-time";

const apply = process.argv.includes("--apply");

function ymd(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function main() {
  const today = dateFromYmd(clinicDateFromInstant(new Date()))!;
  const { rows, targets, removed } = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.availability.findMany({
        where: { date: { gte: today } },
        orderBy: [{ date: "asc" }, { practitioner: { displayOrder: "asc" } }],
        select: {
          id: true,
          date: true,
          slots: true,
          practitioner: {
            select: { id: true, name: true, workingHours: true },
          },
        },
      });
      const targets = rows.filter((row) =>
        availabilityMatchesWeeklySchedule(
          ymd(row.date),
          row.slots,
          row.practitioner.workingHours,
        ),
      );
      const removed = apply
        ? await tx.availability.deleteMany({
            where: { id: { in: targets.map((row) => row.id) } },
          })
        : { count: 0 };
      return { rows, targets, removed: removed.count };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    },
  );

  console.log(
    JSON.stringify(
      {
        task: "cleanup_default_availability",
        mode: apply ? "apply" : "dry-run",
        scanned: rows.length,
        matched: targets.length,
        removed,
        targets: targets.map((row) => ({
          id: row.id,
          date: ymd(row.date),
          practitionerId: row.practitioner.id,
          practitionerName: row.practitioner.name,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
