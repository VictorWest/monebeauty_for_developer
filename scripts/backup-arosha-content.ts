// Preservation snapshot for the Arosha page (a ContentPage, not a
// Technology/Service), before the new photography goes in.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUTPUT = join(process.cwd(), "content/backups/arosha-original-page.json");
const force = process.argv.includes("--force");

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const pages = await prisma.contentPage.findMany({ where: { slug: "arosha" } });
  if (!pages.length) throw new Error("arosha content pages not found");

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
