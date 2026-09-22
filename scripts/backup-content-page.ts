// Preservation snapshot for an arbitrary ContentPage slug, e.g.:
//   tsx backup-content-page.ts --slug=arosha --out=arosha-round2
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const force = process.argv.includes("--force");
const slug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
const outArg = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1];
if (!slug || !outArg) {
  throw new Error("Usage: backup-content-page.ts --slug=<slug> --out=filename-stem");
}
const OUTPUT = join(process.cwd(), `content/backups/${outArg}-original.json`);

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const pages = await prisma.contentPage.findMany({ where: { slug } });
  if (!pages.length) throw new Error(`content page ${slug} not found`);

  const snapshot = {
    capturedAt: new Date().toISOString(),
    pages: pages.map((page) => ({ locale: page.locale, body: page.body })),
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ wrote: OUTPUT, pages: snapshot.pages.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
