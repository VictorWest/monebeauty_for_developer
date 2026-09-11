import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient, type ServiceCategory } from "@prisma/client";
import { INTERNAL_CALENDAR_SERVICES } from "../lib/internal-calendar-services";
import { workdaySlots } from "../lib/staff-schedule";

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);
const CALENDAR_STAFF = [
  { name: "Ilona Bagaturija", publicName: "Ilona", color: "#D5897E" },
  { name: "Irena", publicName: "Irena", color: "#9B9BEF" },
  { name: "Vladislava", publicName: "Vladislava", color: "#7F83D8" },
  { name: "Inna", publicName: "Inna", color: "#A9B88E" },
] as const;

// Keep in sync with content/booking-services.ts (kept inline so `prisma db seed` via tsx
// needs no path-alias resolution). The booking API also self-heals these rows if missing.
const SERVICES: {
  slug: string;
  category: ServiceCategory;
  bookable: boolean;
  durationMin?: number;
  priceFrom?: number;
  bookingFamily?: string;
  bookingPickerVisible?: boolean;
  offerRequiresAccount?: boolean;
  published?: boolean;
  multiProcedureBooking?: boolean;
}[] = [
  { slug: "facial", category: "FACE", bookable: true },
  { slug: "body", category: "BODY", bookable: true },
  {
    slug: "endospheres",
    category: "DEVICE",
    bookable: true,
    durationMin: 45,
    bookingFamily: "endospheres",
    bookingPickerVisible: false,
  },
  {
    slug: "endospheres-intro-75",
    category: "DEVICE",
    bookable: true,
    durationMin: 75,
    priceFrom: 99,
    bookingFamily: "endospheres",
    offerRequiresAccount: true,
    // Legacy per-duration shell: its real content now lives as an option
    // under the "endospheres" parent (see lib/endospheres-booking-options.ts).
    // Must stay hidden like the parent (dead-end picker card otherwise) and
    // unpublished (it has no real page, but a published row still feeds the
    // chatbot's knowledge base and, sitting at the lowest `order`, wins
    // scoring ties against genuinely relevant content).
    bookingPickerVisible: false,
    published: false,
  },
  {
    slug: "endospheres-30",
    category: "DEVICE",
    bookable: true,
    durationMin: 30,
    priceFrom: 65,
    bookingFamily: "endospheres",
    bookingPickerVisible: false,
    published: false,
  },
  {
    slug: "endospheres-45",
    category: "DEVICE",
    bookable: true,
    durationMin: 45,
    priceFrom: 85,
    bookingFamily: "endospheres",
    bookingPickerVisible: false,
    published: false,
  },
  {
    slug: "endospheres-60",
    category: "DEVICE",
    bookable: true,
    durationMin: 60,
    priceFrom: 105,
    bookingFamily: "endospheres",
    bookingPickerVisible: false,
    published: false,
  },
  {
    slug: "endospheres-75",
    category: "DEVICE",
    bookable: true,
    durationMin: 75,
    priceFrom: 125,
    bookingFamily: "endospheres",
    bookingPickerVisible: false,
    published: false,
  },
  {
    slug: "laser",
    category: "LASER",
    bookable: true,
    // The client's own example for combined bookings (arms + legs + neck in
    // one visit) — the first, and so far only, service enabled for it.
    multiProcedureBooking: true,
  },
  { slug: "rf", category: "DEVICE", bookable: true },
  { slug: "trichology", category: "HAIR", bookable: true },
  { slug: "brows", category: "FACE", bookable: true },
  { slug: "packages", category: "BODY", bookable: true },
  { slug: "injectable", category: "INJECTABLE", bookable: true },
  { slug: "consultation", category: "CONSULTATION", bookable: true },
];

const BUSINESS_HOURS = {
  openDays: [1, 2, 3, 4, 5, 6],
  startHour: 10,
  endHour: 19,
  stepMin: 30,
  daysAhead: 30,
};

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function main() {
  for (const template of INTERNAL_CALENDAR_SERVICES) {
    const data = {
      key: template.key,
      labelFi: template.labelFi,
      labelEn: template.labelEn,
      labelRu: template.labelRu,
      color: template.color,
      displayOrder: template.displayOrder,
      defaultDurationMin: template.defaultDurationMin,
      active: true,
    };
    await prisma.calendarBlockTemplate.upsert({
      where: { key: template.key },
      update: data,
      create: data,
    });
  }

  const practitioners: Array<{ id: string }> = [];
  for (const [displayOrder, staff] of CALENDAR_STAFF.entries()) {
    const aliases =
      staff.name === "Ilona Bagaturija"
        ? [staff.name, "Ilona"]
        : staff.name === "Irena"
          ? ["Irena", "Irene"]
          : [staff.name];
    const existing = await prisma.practitioner.findFirst({
      where: { name: { in: aliases, mode: "insensitive" } },
      orderBy: { id: "asc" },
    });
    practitioners.push(
      existing
        ? await prisma.practitioner.update({
            where: { id: existing.id },
            data: {
              name: staff.name,
              publicName: staff.publicName,
              active: true,
              role: "Specialist",
              displayOrder,
              calendarColor: staff.color,
            },
          })
        : await prisma.practitioner.create({
            data: {
              name: staff.name,
              publicName: staff.publicName,
              role: "Specialist",
              active: true,
              displayOrder,
              calendarColor: staff.color,
            },
          }),
    );
  }

  const serviceIds: string[] = [];
  const serviceDeviceById = new Map<string, string[]>();
  const treatmentRooms = [];
  for (let unitNumber = 1; unitNumber <= 4; unitNumber += 1) {
    treatmentRooms.push(
      await prisma.room.upsert({
        where: {
          poolKey_unitNumber: { poolKey: "treatment-room", unitNumber },
        },
        update: { active: true, name: `Treatment room ${unitNumber}` },
        create: {
          name: `Treatment room ${unitNumber}`,
          active: true,
          displayOrder: unitNumber,
          poolKey: "treatment-room",
          unitNumber,
        },
      }),
    );
  }
  const deviceByService = new Map<string, string[]>();
  for (const [slug, name, poolKey] of [
    ["endospheres", "Endospheres", "endospheres"],
    ["laser", "Laser", "laser"],
    ["rf", "MicroRF", "rf"],
  ] as const) {
    const deviceIds: string[] = [];
    for (let unitNumber = 1; unitNumber <= 4; unitNumber += 1) {
      const device = await prisma.device.upsert({
        where: { poolKey_unitNumber: { poolKey, unitNumber } },
        update: { active: true, name: `${name} ${unitNumber}` },
        create: {
          name: `${name} ${unitNumber}`,
          active: true,
          displayOrder: unitNumber,
          poolKey,
          unitNumber,
        },
      });
      deviceIds.push(device.id);
    }
    deviceByService.set(slug, deviceIds);
  }
  for (const s of SERVICES) {
    const deviceIds = deviceByService.get(
      s.slug.startsWith("endospheres-") ? "endospheres" : s.slug,
    );
    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        category: s.category,
        published: s.published ?? s.bookable,
        durationMin: s.durationMin,
        priceFrom: s.priceFrom,
        priceMode: s.priceFrom === undefined ? "FROM" : "FIXED",
        bookingFamily: s.bookingFamily,
        bookingPickerVisible: s.bookingPickerVisible ?? true,
        offerRequiresAccount: s.offerRequiresAccount ?? false,
        multiProcedureBooking: s.multiProcedureBooking ?? false,
        primaryPractitionerId: null,
        requiresDevice: Boolean(deviceIds),
        rooms: s.bookable
          ? { connect: treatmentRooms.map(({ id }) => ({ id })) }
          : undefined,
        devices: deviceIds
          ? { connect: deviceIds.map((id) => ({ id })) }
          : undefined,
      },
      create: {
        slug: s.slug,
        category: s.category,
        published: s.published ?? s.bookable,
        durationMin: s.durationMin,
        priceFrom: s.priceFrom,
        priceMode: s.priceFrom === undefined ? "FROM" : "FIXED",
        bookingFamily: s.bookingFamily,
        bookingPickerVisible: s.bookingPickerVisible ?? true,
        offerRequiresAccount: s.offerRequiresAccount ?? false,
        multiProcedureBooking: s.multiProcedureBooking ?? false,
        primaryPractitionerId: null,
        requiresDevice: Boolean(deviceIds),
        rooms: s.bookable
          ? { connect: treatmentRooms.map(({ id }) => ({ id })) }
          : undefined,
        devices: deviceIds
          ? { connect: deviceIds.map((id) => ({ id })) }
          : undefined,
      },
    });
    if (s.bookable) serviceIds.push(service.id);
    if (deviceIds) serviceDeviceById.set(service.id, deviceIds);
  }

  const seedDemoScheduling = process.env.SEED_DEMO_SCHEDULING === "true";
  if (seedDemoScheduling) {
    for (const practitioner of practitioners) {
      for (const serviceId of serviceIds) {
        const deviceIds = serviceDeviceById.get(serviceId) ?? [];
        for (const room of treatmentRooms) {
          await prisma.practitionerServiceCapability.upsert({
            where: {
              practitionerId_serviceId_roomId: {
                practitionerId: practitioner.id,
                serviceId,
                roomId: room.id,
              },
            },
            update: {
              devices: {
                deleteMany: {},
                create: deviceIds.map((deviceId) => ({ deviceId })),
              },
            },
            create: {
              practitionerId: practitioner.id,
              serviceId,
              roomId: room.id,
              ...(deviceIds.length
                ? {
                    devices: {
                      create: deviceIds.map((deviceId) => ({ deviceId })),
                    },
                  }
                : {}),
            },
          });
        }
      }
    }
  }

  for (const [index, amount] of [50, 100, 350, 650, 1000].entries()) {
    const product = await prisma.product.upsert({
      where: { slug: `gift-card-${amount}` },
      update: {},
      create: {
        slug: `gift-card-${amount}`,
        category: "GIFT_CARD",
        kind: "GIFT_CARD",
        voucherValidityDays: 365,
        price: amount,
        currency: "EUR",
        order: 1000 + index,
        images: ["/media/images/photo/5.jpg"],
        published: true,
      },
    });
    for (const content of [
      {
        locale: "fi" as const,
        name: `Lahjakortti ${amount} €`,
        description:
          "Lahjakortti Mone Beauty Clinicin valikoimaan. Koodi toimitetaan sähköpostitse maksun jälkeen.",
      },
      {
        locale: "en" as const,
        name: `Gift card €${amount}`,
        description:
          "A gift card for the Mone Beauty Clinic selection. The code is delivered by email after payment.",
      },
      {
        locale: "ru" as const,
        name: `Подарочная карта ${amount} €`,
        description:
          "Подарочная карта на услуги Mone Beauty Clinic. Код отправляется по электронной почте после оплаты.",
      },
    ]) {
      await prisma.productContent.upsert({
        where: {
          productId_locale: { productId: product.id, locale: content.locale },
        },
        update: {},
        create: {
          productId: product.id,
          locale: content.locale,
          name: content.name,
          description: content.description,
          status: "PUBLISHED",
          seoTitle: content.name,
          seoDescription: content.description,
          imageAlt: content.name,
        },
      });
    }
  }

  const stripeCheckoutTestProduct = await prisma.product.upsert({
    where: { slug: "stripe-checkout-test-item" },
    update: {
      order: -1,
      published: process.env.SEED_STRIPE_TEST_PRODUCT === "true",
    },
    create: {
      slug: "stripe-checkout-test-item",
      category: "OTHER",
      kind: "PHYSICAL",
      price: 1,
      currency: "EUR",
      order: -1,
      images: ["/media/images/photo/5.jpg"],
      published: process.env.SEED_STRIPE_TEST_PRODUCT === "true",
    },
  });
  for (const content of [
    {
      locale: "fi" as const,
      name: "Stripe-testituote 1 €",
      shortDescription:
        "Vain maksuprosessin testaamiseen. Ei varsinainen myyntituote.",
      description:
        "Vain Mone Beauty Clinicin koko maksuprosessin testaamiseen. Ei varsinainen myyntituote.",
    },
    {
      locale: "en" as const,
      name: "Stripe checkout test item €1",
      shortDescription:
        "For payment-flow testing only. Not a regular retail product.",
      description:
        "For testing the complete Mone Beauty Clinic payment flow only. Not a regular retail product.",
    },
    {
      locale: "ru" as const,
      name: "Тестовый товар Stripe за 1 €",
      shortDescription:
        "Только для проверки оплаты. Не является обычным товаром.",
      description:
        "Только для проверки полного процесса оплаты Mone Beauty Clinic. Не является товаром для обычной продажи.",
    },
  ]) {
    await prisma.productContent.upsert({
      where: {
        productId_locale: {
          productId: stripeCheckoutTestProduct.id,
          locale: content.locale,
        },
      },
      update: {},
      create: {
        productId: stripeCheckoutTestProduct.id,
        locale: content.locale,
        name: content.name,
        shortDescription: content.shortDescription,
        description: content.description,
        imageAlt: content.name,
        seoTitle: content.name,
        seoDescription: content.shortDescription,
        seoIndexable: false,
        status: "PUBLISHED",
      },
    });
  }

  if (seedDemoScheduling) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i <= BUSINESS_HOURS.daysAhead; i++) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() + i);
      if (!BUSINESS_HOURS.openDays.includes(date.getUTCDay())) continue;
      const dateStr = date.toISOString().slice(0, 10);
      for (const practitioner of practitioners) {
        await prisma.availability.upsert({
          where: {
            practitionerId_date: { practitionerId: practitioner.id, date },
          },
          update: {},
          create: {
            practitionerId: practitioner.id,
            date,
            slots: workdaySlots(
              dateStr,
              BUSINESS_HOURS.startHour * 60,
              BUSINESS_HOURS.endHour * 60,
            ),
          },
        });
      }
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: process.env.ADMIN_NAME?.trim() || "Mone Beauty Admin",
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
        status: "ACTIVE",
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
      create: {
        email: adminEmail,
        name: process.env.ADMIN_NAME?.trim() || "Mone Beauty Admin",
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
        status: "ACTIVE",
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
    });
    console.log(`Seeded admin user ${adminEmail}.`);
  }

  console.log(
    `Seeded ${practitioners.length} calendar employees + ${SERVICES.length} services + gift cards${seedDemoScheduling ? ` + ${BUSINESS_HOURS.daysAhead} days of demo availability` : " (scheduling assignments require admin configuration)"}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
