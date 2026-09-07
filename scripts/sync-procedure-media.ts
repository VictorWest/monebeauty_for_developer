import { Prisma, PrismaClient } from "@prisma/client";
import { PROCEDURE_MEDIA_SEED } from "../content/procedure-media";

const prisma = new PrismaClient();
const argumentsList = process.argv.slice(2);
const force = argumentsList.includes("--force");
const serviceFilters = new Set(
  argumentsList
    .filter((argument) => argument.startsWith("--service="))
    .map((argument) => argument.slice("--service=".length))
    .filter(Boolean),
);
const unknownArguments = argumentsList.filter(
  (argument) => argument !== "--force" && !argument.startsWith("--service="),
);

async function main() {
  if (unknownArguments.length)
    throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
  const availableServices = new Set(
    PROCEDURE_MEDIA_SEED.map((item) => item.serviceSlug),
  );
  const unknownServices = [...serviceFilters].filter(
    (service) => !availableServices.has(service),
  );
  if (unknownServices.length)
    throw new Error(`Unknown service(s): ${unknownServices.join(", ")}`);
  const selectedItems = serviceFilters.size
    ? PROCEDURE_MEDIA_SEED.filter((item) =>
        serviceFilters.has(item.serviceSlug),
      )
    : PROCEDURE_MEDIA_SEED;

  let created = 0;
  let updated = 0;
  let deleted = 0;
  const serviceIds = new Map<string, string>();
  for (const item of selectedItems) {
    const service = await prisma.service.findUnique({
      where: { slug: item.serviceSlug },
      select: { id: true },
    });
    if (!service) throw new Error(`Missing service ${item.serviceSlug}`);
    serviceIds.set(item.serviceSlug, service.id);
    const existing = await prisma.procedureMedia.findUnique({
      where: { serviceId_key: { serviceId: service.id, key: item.key } },
      select: { id: true },
    });
    const data = {
      image: item.image,
      identities: item.identities as Prisma.InputJsonValue,
      sourceUrl: item.sourceUrl,
      sourceLicense: item.sourceLicense,
    };
    if (!existing) {
      await prisma.procedureMedia.create({
        data: { serviceId: service.id, key: item.key, ...data },
      });
      created++;
    } else if (force) {
      await prisma.procedureMedia.update({ where: { id: existing.id }, data });
      updated++;
    }
  }
  if (force)
    for (const serviceSlug of new Set(
      selectedItems.map((item) => item.serviceSlug),
    )) {
      const serviceId = serviceIds.get(serviceSlug);
      if (!serviceId) continue;
      const keys = selectedItems
        .filter((item) => item.serviceSlug === serviceSlug)
        .map((item) => item.key);
      const result = await prisma.procedureMedia.deleteMany({
        where: {
          serviceId,
          key: { startsWith: `${serviceSlug}-concept-`, notIn: keys },
        },
      });
      deleted += result.count;
    }
  console.log(
    `Procedure media synchronized: ${created} created, ${updated} updated, ${deleted} stale deleted, ${selectedItems.length} selected.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
