// Phase 1 of the booking-wizard UX fix: the client's complaint was that only
// laser gets the "+"-cart flow (select → checkmark stays in place → sticky
// Continue bar at the bottom); every other service auto-advances on click
// with no visible selection state or Continue button. Facial, RF and
// Trichology all list several genuinely combinable stand-alone procedures
// (same shape as laser's zones), so they get the same cart flow.
//
// Left as single-select on purpose: body, endospheres, packages, brows —
// these mix in mutually-exclusive tiers/quantities (e.g. a 6-session vs.
// 12-session package, or a 30 vs. 75 min Endospheres session) that must
// never be combinable in one cart. consultation/injectable have one option
// each, so multi-select wouldn't apply anyway.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUGS = ["facial", "rf", "trichology"];

async function main() {
  const result = await prisma.service.updateMany({
    where: { slug: { in: SLUGS } },
    data: { multiProcedureBooking: true },
  });
  console.log(`Updated ${result.count} services:`, SLUGS.join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
