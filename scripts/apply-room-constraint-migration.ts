// Applies prisma/migrations/20260908170000_rooms_do_not_restrict_booking by
// hand and records it in _prisma_migrations, equivalent to what
// `prisma migrate deploy` would do. Written as a script (rather than invoking
// the Prisma CLI against a remote DATABASE_URL directly) so the exact SQL
// being run against a database is plainly visible and reviewable here.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MIGRATION_NAME = "20260908170000_rooms_do_not_restrict_booking";
const prisma = new PrismaClient();

async function main() {
  const sql = readFileSync(
    `prisma/migrations/${MIGRATION_NAME}/migration.sql`,
    "utf8",
  );
  const checksum = createHash("sha256").update(sql).digest("hex");

  const already = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME}
  `;
  if (already.length) {
    console.log(JSON.stringify({ skipped: true, reason: "already recorded" }));
    return;
  }

  await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations"
      (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
    VALUES
      (gen_random_uuid()::text, ${checksum}, ${MIGRATION_NAME}, now(), now(), 1)
  `;
  console.log(JSON.stringify({ applied: MIGRATION_NAME }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
