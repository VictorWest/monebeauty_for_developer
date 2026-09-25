// Client feedback: the men's booking flow showed women's photos and options
// were never actually separated by gender. Laser is the only service whose
// option list mixes gendered zones (e.g. "Chest" vs "Male Chest"), so this
// tags all 36 zones. Convention, confirmed with the client (2026-09-25):
//   - explicit "Male ___" options -> MEN
//   - their unprefixed counterpart (Front/Back of Neck, Chest, Back, Abdomen)
//     -> WOMEN, since a separate "Male" SKU exists for the larger male area
//   - female-specific zones (Areolas, Bikini Line, Deep Bikini, Brazilian
//     Bikini, and any combo built from them) -> WOMEN
//   - everything else (facial zones, limbs, torso zones with no gendered
//     pair) -> BOTH, the schema default, so left untouched
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MEN: string[] = [
  "Male Front of Neck",
  "Male Back of Neck",
  "Male Chest",
  "Male Back",
  "Male Abdomen",
];

const WOMEN: string[] = [
  "Front of Neck",
  "Back of Neck",
  "Chest",
  "Back",
  "Abdomen",
  "Areolas",
  "Bikini Line",
  "Deep Bikini",
  "Brazilian Bikini",
  "Underarms + Bikini Line",
  "Underarms + Brazilian Bikini",
  "Brazilian Bikini + Full Legs",
  "Underarms + Brazilian Bikini + Full Legs",
];

async function setGender(names: string[], gender: "MEN" | "WOMEN", results: Record<string, boolean>) {
  for (const name of names) {
    const content = await prisma.serviceOptionContent.findFirst({
      where: { locale: "en", name, option: { service: { slug: "laser" } } },
      select: { optionId: true },
    });
    if (!content) throw new Error(`Laser option not found: "${name}"`);
    const before = await prisma.serviceOption.findUniqueOrThrow({
      where: { id: content.optionId },
      select: { targetGender: true },
    });
    if (before.targetGender !== gender) {
      await prisma.serviceOption.update({
        where: { id: content.optionId },
        data: { targetGender: gender },
      });
    }
    results[name] = before.targetGender !== gender;
  }
}

async function main() {
  const results: Record<string, boolean> = {};
  await setGender(MEN, "MEN", results);
  await setGender(WOMEN, "WOMEN", results);
  console.log(JSON.stringify(results, null, 2));
  console.log(`${MEN.length} tagged MEN, ${WOMEN.length} tagged WOMEN, rest stay BOTH.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
