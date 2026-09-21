// Preservation snapshot for the Trichology technology page, before the new
// photography goes in. Same shape as backup-laser-content.ts/backup-rf-content.ts.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUTPUT = join(process.cwd(), "content/backups/trichology-technology-original-page.json");
const force = process.argv.includes("--force");

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const technology = await prisma.technology.findUnique({
    where: { slug: "trichology" },
    include: { contents: { orderBy: { locale: "asc" } } },
  });
  if (!technology) throw new Error("trichology technology not found");

  const snapshot = {
    capturedAt: new Date().toISOString(),
    technology: {
      slug: technology.slug,
      images: technology.images,
      imageFocalX: technology.imageFocalX,
      imageFocalY: technology.imageFocalY,
      contents: technology.contents.map((content) => ({
        locale: content.locale,
        body: content.body,
      })),
    },
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ wrote: OUTPUT }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
