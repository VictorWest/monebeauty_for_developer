import { Prisma, PrismaClient } from "@prisma/client";
import { PROCEDURE_MEDIA_SEED } from "../content/procedure-media";
import {
  buildProcedureMediaRollbackTargets,
  runProcedureMediaRollback,
} from "../lib/procedure-media-rollback";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const unknownArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--apply");

async function main() {
  if (unknownArguments.length)
    throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);

  const serviceSlugs = [
    ...new Set(PROCEDURE_MEDIA_SEED.map((item) => item.serviceSlug)),
  ];
  const services = await prisma.service.findMany({
    where: { slug: { in: serviceSlugs } },
    select: { id: true, slug: true },
  });
  const { targets, missingServices } = buildProcedureMediaRollbackTargets(
    services,
    PROCEDURE_MEDIA_SEED,
  );
  const where: Prisma.ProcedureMediaWhereInput = targets.length
    ? {
        OR: targets.map((target) => ({
          serviceId: target.serviceId,
          key: { in: target.keys },
        })),
      }
    : { id: "__no_procedure_media_rollback_targets__" };

  const result = await runProcedureMediaRollback(
    {
      inspect: async () => ({
        matched: await prisma.procedureMedia.count({ where }),
        remaining: await prisma.procedureMedia.count(),
      }),
      apply: () =>
        prisma.$transaction(async (transaction) => {
          const matched = await transaction.procedureMedia.count({ where });
          const deletion = await transaction.procedureMedia.deleteMany({
            where,
          });
          const remaining = await transaction.procedureMedia.count();
          return { matched, deleted: deletion.count, remaining };
        }),
    },
    apply,
  );

  if (missingServices.length)
    console.warn(`Missing services: ${missingServices.join(", ")}`);
  if (!apply) {
    console.log(
      `Dry run: ${result.matched} registry-owned procedure media record(s) would be deleted; ${result.remaining - result.matched} unrelated record(s) would remain.`,
    );
    console.log(
      "No changes made. Re-run with --apply to perform the transactional rollback.",
    );
    return;
  }
  console.log(
    `Procedure media rollback complete: ${result.deleted} deleted, ${result.remaining} record(s) remain.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
