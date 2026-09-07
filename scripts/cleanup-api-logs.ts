import { prisma } from "../lib/db";

async function main() {
  let removed = 0;
  for (;;) {
    const rows = await prisma.externalApiAttempt.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true },
      take: 500,
    });
    if (!rows.length) break;
    const result = await prisma.externalApiAttempt.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    removed += result.count;
  }
  console.log(JSON.stringify({ task: "api_logs_cleanup", removed }));
}

main().finally(() => prisma.$disconnect());
