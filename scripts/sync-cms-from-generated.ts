import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PrismaClient,
  type Locale,
  type ProductCategory,
  type ServiceCategory,
} from "@prisma/client";
import {
  SERVICE_PUBLIC_PATHS,
  TECHNOLOGY_PUBLIC_PATHS,
} from "../lib/public-routes";
import { SERVICE_SUMMARIES } from "../content/service-summaries";
import { SERVICE_OVERVIEWS } from "../content/service-overviews";
import { AUTHORED_PAGES } from "../content/authored-pages";
import { applyCancellationPolicyToAboutBody } from "../content/cancellation-policy";
import { STANDALONE_APPOINTMENT_OPTION_SEED } from "../content/treatment-option-migration";
import {
  ENDOSPHERES_BOOKING_FAMILY,
  ENDOSPHERES_PACKAGES,
  ENDOSPHERES_SERVICES,
} from "../content/endospheres";

const prisma = new PrismaClient();
const root = process.cwd();
const force = process.argv.includes("--force");
const forceImages = process.argv.includes("--force-images");
const laserArticleImages = [
  "/media/clinic/laser/laser-forearm-hair-removal.jpeg",
  "/media/clinic/laser/laser-face-hair-removal.jpeg",
  "/media/clinic/laser/laser-bikini-hair-removal.jpeg",
  "/media/clinic/laser/laser-full-leg-hair-removal.jpeg",
  "/media/clinic/laser/laser-neck-hair-removal.jpeg",
  "/media/clinic/laser/laser-underarm-hair-removal.jpeg",
  "/media/clinic/laser/laser-lower-body-hair-removal.jpeg",
  "/media/clinic/laser/laser-chin-hair-removal.jpeg",
  "/media/clinic/laser/laser-upper-body-hair-removal.jpeg",
];

type PageContent = { title: string; hero: string | null; body: string };
type ProductContent = { name: string; description: string };
type Product = {
  slug: string;
  category: ProductCategory;
  image: string | null;
  price: number | null;
  size: string | null;
  i18n: Partial<Record<Locale, ProductContent>>;
};

/**
 * `order` drives the published sequence on /palvelut (`lib/live-content.ts`
 * orders by `order` then `slug`). Without it every row defaults to 0 and the
 * page falls back to alphabetical slug order, which buried the clinic's
 * headline treatments below eyebrow care and consultations. Endospheres,
 * laser and microneedling RF lead by client instruction; the gaps of ten
 * leave room for the admin to re-rank without renumbering everything.
 */
const SERVICES: Array<{
  slug: string;
  page: string;
  publicPath: string;
  category: ServiceCategory;
  durationMin: number;
  bookable: boolean;
  order: number;
  images: string[];
}> = [
  {
    slug: "endospheres",
    page: "instrumental/endosphere",
    publicPath: SERVICE_PUBLIC_PATHS.endospheres,
    category: "DEVICE",
    durationMin: 45,
    bookable: true,
    order: 10,
    // Clinic-supplied Endospheres treatment photography.
    images: ["/media/clinic/endospheres/endospheres-treatment.png"],
  },
  {
    slug: "laser",
    page: "services/laser",
    publicPath: SERVICE_PUBLIC_PATHS.laser,
    category: "LASER",
    durationMin: 30,
    bookable: true,
    order: 20,
    images: ["/media/clinic/laser/laser-upper-arm-hair-removal.jpeg"],
  },
  {
    slug: "rf",
    page: "services/mikroneulanrf",
    publicPath: SERVICE_PUBLIC_PATHS.rf,
    category: "DEVICE",
    durationMin: 60,
    bookable: true,
    order: 30,
    images: ["/media/files/land/280/21b80358547be97456baf00ac6a98ac9.jpeg"],
  },
  {
    slug: "facial",
    page: "services/face",
    publicPath: SERVICE_PUBLIC_PATHS.facial,
    category: "FACE",
    durationMin: 60,
    bookable: true,
    order: 40,
    images: ["/media/home/facial.jpg"],
  },
  {
    slug: "body",
    page: "services/body",
    publicPath: SERVICE_PUBLIC_PATHS.body,
    category: "BODY",
    durationMin: 60,
    bookable: true,
    order: 50,
    // Clinic-supplied body-treatment photography.
    images: ["/media/clinic/body/body-treatment.png"],
  },
  {
    slug: "trichology",
    page: "services/tricho",
    publicPath: SERVICE_PUBLIC_PATHS.trichology,
    category: "HAIR",
    durationMin: 45,
    bookable: true,
    order: 60,
    images: ["/media/files/land/303/8b2e9288e47ba7705d700a8d7edb596e.jpeg"],
  },
  {
    slug: "brows",
    page: "services/eyebrows",
    publicPath: SERVICE_PUBLIC_PATHS.brows,
    category: "FACE",
    durationMin: 30,
    bookable: true,
    order: 70,
    images: ["/media/home/brows.jpg"],
  },
  {
    slug: "packages",
    page: "services/packages",
    publicPath: SERVICE_PUBLIC_PATHS.packages,
    category: "BODY",
    durationMin: 90,
    bookable: true,
    order: 80,
    images: ["/media/home/packages.jpg"],
  },
  {
    slug: "injectable",
    page: "services/injectable",
    publicPath: SERVICE_PUBLIC_PATHS.injectable,
    category: "INJECTABLE",
    durationMin: 45,
    bookable: true,
    order: 90,
    // Pexels stock: the service itself is still [CLINIC TO PROVIDE]; the photo only
    // illustrates the forthcoming card. https://www.pexels.com/photo/cosmetic-procedure-dermal-filler-injection-34775441/
    images: ["/media/stock/dermal-filler-pexels-34775441.jpg"],
  },
  {
    slug: "consultation",
    page: "services/consultation",
    publicPath: SERVICE_PUBLIC_PATHS.consultation,
    category: "CONSULTATION",
    durationMin: 30,
    bookable: true,
    order: 100,
    // Clinic-supplied photograph (Mone-branded uniform), not stock: see public/media/clinic.
    images: ["/media/clinic/medical-consultation-black-logo.png"],
  },
];

const TECHNOLOGIES = [
  {
    slug: "endospheres",
    page: "instrumental/endosphere",
    publicPath: TECHNOLOGY_PUBLIC_PATHS.endospheres,
    service: "endospheres",
    images: ["/media/clinic/endospheres/endospheres-treatment.png"],
  },
  {
    slug: "laser",
    page: "instrumental/laser",
    publicPath: TECHNOLOGY_PUBLIC_PATHS.laser,
    service: "laser",
    images: ["/media/clinic/laser/laser-forearm-hair-removal.jpeg"],
  },
  {
    slug: "rf",
    page: "instrumental/mikroneulanrf",
    publicPath: TECHNOLOGY_PUBLIC_PATHS.rf,
    service: "rf",
    images: ["/media/files/land/280/21b80358547be97456baf00ac6a98ac9.jpeg"],
  },
  {
    slug: "trichology",
    page: "trichology",
    publicPath: TECHNOLOGY_PUBLIC_PATHS.trichology,
    service: "trichology",
    images: ["/media/files/land/301/a214b208578ca13b2e31ba04ca3074f1.jpg"],
  },
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as T;
}
/** Plain text from markdown, cut on a word boundary so cards never end mid-word. */
function excerpt(markdown: string, max = 240) {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)|[#*_>`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function isSeoIndexable(markdown: string) {
  return !markdown.includes("[CLINIC TO PROVIDE]");
}

/** Replace only Markdown image sources so an image-only sync preserves edited article copy. */
function replaceMarkdownImages(markdown: string, images: string[]) {
  let imageIndex = 0;
  return markdown.replace(
    /(!\[[^\]]*\]\()\/(?:media\/)?[^)\s]+(\))/g,
    (match, opening: string, closing: string) => {
      const image = images[imageIndex++];
      return image ? `${opening}${image}${closing}` : match;
    },
  );
}

function markdownImages(markdown: string) {
  return [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(
    (match) => match[1],
  );
}

async function syncPages(
  pages: Record<string, Partial<Record<Locale, PageContent>>>,
) {
  let count = 0;
  for (const [slug, localized] of Object.entries(pages))
    for (const [locale, content] of Object.entries(localized) as [
      Locale,
      PageContent,
    ][]) {
      const existing = await prisma.contentPage.findUnique({
        where: { slug_locale: { slug, locale } },
        select: { id: true, hero: true, body: true },
      });
      if (!existing)
        await prisma.contentPage.create({
          data: {
            slug,
            locale,
            title: content.title,
            hero: content.hero,
            body: content.body,
            seoTitle: content.title,
            seoDescription: excerpt(content.body, 160),
            seoIndexable: isSeoIndexable(content.body),
            status: "PUBLISHED",
          },
        });
      else if (force || forceImages)
        await prisma.contentPage.update({
          where: { id: existing.id },
          data: {
            ...(force
              ? {
                  title: content.title,
                  body: replaceMarkdownImages(
                    content.body,
                    markdownImages(existing.body),
                  ),
                  seoTitle: content.title,
                  seoDescription: excerpt(content.body, 160),
                  seoIndexable: isSeoIndexable(content.body),
                  status: "PUBLISHED" as const,
                }
              : {}),
            ...(forceImages
              ? {
                  hero: content.hero,
                  body: replaceMarkdownImages(
                    force ? content.body : existing.body,
                    markdownImages(content.body),
                  ),
                }
              : {}),
          },
        });
      count += !existing || force || forceImages ? 1 : 0;
    }
  return count;
}

async function syncServices(
  pages: Record<string, Partial<Record<Locale, PageContent>>>,
) {
  let count = 0;
  for (const definition of SERVICES) {
    const existing = await prisma.service.findUnique({
      where: { slug: definition.slug },
    });
    const service = existing
      ? await prisma.service.update({
          where: { id: existing.id },
          data: {
            ...(force
              ? {
                  publicPath: definition.publicPath,
                  category: definition.category,
                  durationMin: definition.durationMin,
                  bookable: definition.bookable,
                  order: definition.order,
                  // `create` publishes; without this a row seeded unpublished (prisma/seed.ts
                  // sets `published: s.bookable`) stays invisible however often we re-sync.
                  published: true,
                }
              : {
                  publicPath: existing.publicPath ?? definition.publicPath,
                  // 0 is the schema default, i.e. nobody has ranked this service
                  // yet. Repair it on an ordinary sync so the fix reaches existing
                  // databases, but never overwrite an order set from the admin.
                  ...(existing.order === 0 ? { order: definition.order } : {}),
                }),
            ...(forceImages || !existing.images.length
              ? { images: definition.images }
              : {}),
          },
        })
      : await prisma.service.create({
          data: {
            slug: definition.slug,
            publicPath: definition.publicPath,
            category: definition.category,
            durationMin: definition.durationMin,
            bookable: definition.bookable,
            order: definition.order,
            images: definition.images,
            published: true,
          },
        });
    if (!definition.page) continue;
    for (const [locale, content] of Object.entries(
      pages[definition.page] ?? {},
    ) as [Locale, PageContent][]) {
      const localized = await prisma.treatmentContent.findUnique({
        where: { serviceId_locale: { serviceId: service.id, locale } },
        select: { id: true },
      });
      const summary =
        SERVICE_SUMMARIES[definition.slug]?.[locale] ?? excerpt(content.body);
      const data = {
        h1: content.title,
        shortDesc: summary,
        // The service page body is stored per procedure, not here: every one of
        // these pages is a stack of treatment cards with no prose of its own, so
        // `content.body` reaches the site through ServiceOptionContent instead.
        // See tests/procedure-source-copy.test.ts, which holds each card to the
        // archived wording.
        whatItIs: SERVICE_OVERVIEWS[definition.slug]?.[locale] ?? "",
        suitableFor: [],
        benefits: [],
        processSteps: [],
        safety: "",
        preCare: "",
        postCare: "",
        contraindications: [],
        sessions: "",
        results: "",
        faq: [],
        seoTitle: content.title,
        seoDescription: excerpt(summary, 160),
        imageAlt: content.title,
        seoIndexable: isSeoIndexable(content.body),
        status: "PUBLISHED" as const,
      };
      if (!localized)
        await prisma.treatmentContent.create({
          data: { serviceId: service.id, locale, ...data },
        });
      else if (force)
        await prisma.treatmentContent.update({
          where: { id: localized.id },
          data,
        });
    }
    count += !existing || force ? 1 : 0;
  }
  return count;
}

async function syncStandaloneAppointmentOptions() {
  let count = 0;
  for (const definition of STANDALONE_APPOINTMENT_OPTION_SEED) {
    const service = await prisma.service.findUnique({
      where: { slug: definition.serviceSlug },
      include: { contents: true },
    });
    if (!service) continue;
    const existing = await prisma.serviceOption.findUnique({
      where: {
        serviceId_key: { serviceId: service.id, key: definition.key },
      },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.serviceOption.create({
      data: {
        serviceId: service.id,
        key: definition.key,
        bookingDurationMin: definition.bookingDurationMin,
        image: service.images[0] ?? null,
        imageFocalX: service.imageFocalX,
        imageFocalY: service.imageFocalY,
        type: "APPOINTMENT",
        bookable: true,
        published: true,
        contents: {
          create: service.contents.map((content) => ({
            locale: content.locale,
            group: definition.groups[content.locale],
            name: content.h1,
            summary: content.shortDesc,
            description: content.whatItIs,
            imageAlt: content.imageAlt || content.h1,
            durationLabel: definition.durationLabels[content.locale],
            priceLabel: null,
            status: content.status,
          })),
        },
      },
    });
    count += 1;
  }
  return count;
}

async function syncTechnologies(
  pages: Record<string, Partial<Record<Locale, PageContent>>>,
) {
  let count = 0;
  for (const definition of TECHNOLOGIES) {
    const related = await prisma.service.findUnique({
      where: { slug: definition.service },
      select: { id: true },
    });
    const existing = await prisma.technology.findUnique({
      where: { slug: definition.slug },
    });
    const technology = existing
      ? force || forceImages
        ? await prisma.technology.update({
            where: { id: existing.id },
            data: {
              ...(force
                ? {
                    publicPath: definition.publicPath,
                    relatedServiceId: related?.id ?? null,
                  }
                : {}),
              ...(forceImages ? { images: definition.images } : {}),
            },
          })
        : existing
      : await prisma.technology.create({
          data: {
            slug: definition.slug,
            publicPath: definition.publicPath,
            images: definition.images,
            relatedServiceId: related?.id ?? null,
          },
        });
    for (const [locale, content] of Object.entries(
      pages[definition.page] ?? {},
    ) as [Locale, PageContent][]) {
      const localized = await prisma.technologyContent.findUnique({
        where: { technologyId_locale: { technologyId: technology.id, locale } },
        select: { id: true, body: true },
      });
      const data = {
        name: content.title,
        specification: null,
        summary: excerpt(content.body),
        body:
          localized && !forceImages
            ? replaceMarkdownImages(
                content.body,
                markdownImages(localized.body),
              )
            : content.body,
        imageAlt: content.title,
        seoTitle: content.title,
        seoDescription: excerpt(content.body, 160),
        seoIndexable: isSeoIndexable(content.body),
        status: "PUBLISHED" as const,
      };
      if (!localized)
        await prisma.technologyContent.create({
          data: { technologyId: technology.id, locale, ...data },
        });
      else if (force)
        await prisma.technologyContent.update({
          where: { id: localized.id },
          data,
        });
      else if (forceImages)
        await prisma.technologyContent.update({
          where: { id: localized.id },
          data: {
            body: replaceMarkdownImages(
              localized.body,
              definition.slug === "laser"
                ? laserArticleImages
                : markdownImages(content.body),
            ),
          },
        });
    }
    count += !existing || force || forceImages ? 1 : 0;
  }
  return count;
}

async function syncEndospheresBookingAndPricing() {
  const parent = await prisma.service.findUnique({
    where: { slug: ENDOSPHERES_BOOKING_FAMILY },
    include: {
      contents: true,
      capabilities: { include: { devices: true } },
      rooms: { select: { id: true } },
      devices: { select: { id: true } },
    },
  });
  if (!parent) return;

  await prisma.service.update({
    where: { id: parent.id },
    data: {
      bookingFamily: ENDOSPHERES_BOOKING_FAMILY,
      bookingPickerVisible: false,
    },
  });

  const saved = new Map<string, string>();
  for (const [index, definition] of ENDOSPHERES_SERVICES.entries()) {
    const service = await prisma.service.upsert({
      where: { slug: definition.key },
      update: {
        category: "DEVICE",
        durationMin: definition.durationMin,
        priceFrom: definition.price,
        priceMode: "FIXED",
        bookingFamily: ENDOSPHERES_BOOKING_FAMILY,
        bookingPickerVisible: true,
        offerRequiresAccount: definition.offer,
        bookable: true,
        published: true,
        archivedAt: null,
        images: parent.images,
        requiresDevice: parent.requiresDevice,
        rooms: { set: parent.rooms },
        devices: { set: parent.devices },
      },
      create: {
        slug: definition.key,
        category: "DEVICE",
        durationMin: definition.durationMin,
        priceFrom: definition.price,
        priceMode: "FIXED",
        bookingFamily: ENDOSPHERES_BOOKING_FAMILY,
        bookingPickerVisible: true,
        offerRequiresAccount: definition.offer,
        bookable: true,
        published: true,
        order: 300 + index,
        images: parent.images,
        requiresDevice: parent.requiresDevice,
        rooms: { connect: parent.rooms },
        devices: { connect: parent.devices },
      },
    });
    saved.set(definition.key, service.id);

    for (const content of parent.contents) {
      const label = definition.labels[content.locale];
      await prisma.treatmentContent.upsert({
        where: {
          serviceId_locale: { serviceId: service.id, locale: content.locale },
        },
        update: {
          h1: label,
          shortDesc: content.shortDesc,
          status: "PUBLISHED",
        },
        create: {
          serviceId: service.id,
          locale: content.locale,
          h1: label,
          shortDesc: content.shortDesc,
          whatItIs: content.whatItIs,
          suitableFor: content.suitableFor,
          benefits: content.benefits,
          processSteps: content.processSteps,
          safety: content.safety,
          preCare: content.preCare,
          postCare: content.postCare,
          contraindications: content.contraindications,
          sessions: content.sessions,
          results: content.results,
          faq: content.faq ?? [],
          seoTitle: `${label} | Mone Beauty Clinic`,
          seoDescription: content.seoDescription,
          ogImage: content.ogImage,
          imageAlt: content.imageAlt,
          status: "PUBLISHED",
        },
      });
    }

    for (const capability of parent.capabilities) {
      await prisma.practitionerServiceCapability.upsert({
        where: {
          practitionerId_serviceId_roomId: {
            practitionerId: capability.practitionerId,
            serviceId: service.id,
            roomId: capability.roomId,
          },
        },
        update: {},
        create: {
          practitionerId: capability.practitionerId,
          serviceId: service.id,
          roomId: capability.roomId,
          devices: {
            create: capability.devices.map(({ deviceId }) => ({ deviceId })),
          },
        },
      });
    }
  }

  const pricing = [
    ...ENDOSPHERES_SERVICES.map((item, index) => ({
      key: item.offer ? "intro-75" : `single-${item.durationMin}`,
      serviceId: saved.get(item.key),
      durationMin: item.durationMin,
      count: 1,
      amount: item.price,
      order: 300 + index,
      offer: item.offer,
    })),
    ...ENDOSPHERES_PACKAGES.flatMap((item, durationIndex) =>
      ([6, 12] as const).map((count, countIndex) => ({
        key: `package-${item.durationMin}-${count}`,
        serviceId: undefined,
        durationMin: item.durationMin,
        count,
        amount: count === 6 ? item.six : item.twelve,
        order: 305 + durationIndex * 2 + countIndex,
        offer: false,
      })),
    ),
  ];
  const localeCopy = {
    en: {
      min: "min",
      single: "Single treatment",
      package: "Package · pay at clinic",
      offer: "New clients · account required",
    },
    fi: {
      min: "min",
      single: "Yksittäinen hoito",
      package: "Hoitopaketti · maksu klinikalla",
      offer: "Uudet asiakkaat · asiakastili vaaditaan",
    },
    ru: {
      min: "мин",
      single: "Одна процедура",
      package: "Пакет · оплата в клинике",
      offer: "Для новых клиентов · требуется аккаунт",
    },
  } as const;
  for (const item of pricing) {
    const id = `pricing-endospheres-${item.key}`;
    await prisma.pricingItem.upsert({
      where: { id },
      update: {
        serviceId: item.serviceId,
        price: item.amount,
        order: item.order,
        archivedAt: null,
      },
      create: {
        id,
        serviceId: item.serviceId,
        category: "DEVICE",
        label: `Endospheres ${item.key}`,
        price: item.amount,
        order: item.order,
      },
    });
    for (const locale of ["en", "fi", "ru"] as const) {
      const copy = localeCopy[locale];
      const serviceDefinition = ENDOSPHERES_SERVICES.find(
        (service) =>
          service.durationMin === item.durationMin &&
          service.offer === item.offer,
      );
      const label =
        item.count === 1 && serviceDefinition
          ? serviceDefinition.labels[locale]
          : `Endospheres ${item.durationMin} ${copy.min} × ${item.count}`;
      await prisma.pricingContent.upsert({
        where: { pricingItemId_locale: { pricingItemId: id, locale } },
        update: {
          label,
          unit: item.offer
            ? copy.offer
            : item.count === 1
              ? copy.single
              : copy.package,
          status: "PUBLISHED",
        },
        create: {
          pricingItemId: id,
          locale,
          label,
          unit: item.offer
            ? copy.offer
            : item.count === 1
              ? copy.single
              : copy.package,
          status: "PUBLISHED",
        },
      });
    }
  }
}

async function syncProducts(products: Product[]) {
  let count = 0;
  for (const product of products) {
    const existing = await prisma.product.findUnique({
      where: { slug: product.slug },
    });
    const saved = existing
      ? force || forceImages
        ? await prisma.product.update({
            where: { id: existing.id },
            data: {
              ...(force
                ? {
                    category: product.category,
                    size: product.size,
                    price: product.price ?? 0,
                  }
                : {}),
              ...(forceImages
                ? { images: product.image ? [product.image] : [] }
                : {}),
            },
          })
        : existing
      : await prisma.product.create({
          data: {
            slug: product.slug,
            category: product.category,
            size: product.size,
            price: product.price ?? 0,
            images: product.image ? [product.image] : [],
            published: true,
          },
        });
    for (const [locale, content] of Object.entries(product.i18n) as [
      Locale,
      ProductContent,
    ][]) {
      const localized = await prisma.productContent.findUnique({
        where: { productId_locale: { productId: saved.id, locale } },
        select: { id: true, description: true },
      });
      const data = {
        name: content.name,
        description:
          localized && !forceImages
            ? replaceMarkdownImages(
                content.description,
                markdownImages(localized.description),
              )
            : content.description,
        shortDescription: excerpt(content.description),
        imageAlt: content.name,
        seoTitle: content.name,
        seoDescription: excerpt(content.description, 160),
        seoIndexable: true,
        status: "PUBLISHED" as const,
      };
      if (!localized)
        await prisma.productContent.create({
          data: { productId: saved.id, locale, ...data },
        });
      else if (
        !localized.description.trim() ||
        content.description.trim().startsWith(localized.description.trim())
      )
        // Repair descriptions the generator itself left short, without touching
        // edited ones. Reading only the first `## ` section published four
        // Russian products blank and truncated a fifth; an empty description is
        // never something the clinic wrote, and a stored description that the
        // new one merely extends is untouched generator output. Fixing these
        // with --force would have overwritten every edited product as well.
        await prisma.productContent.update({
          where: { id: localized.id },
          data,
        });
      else if (force || forceImages)
        await prisma.productContent.update({
          where: { id: localized.id },
          data: {
            ...(force ? data : {}),
            ...(forceImages
              ? {
                  description: replaceMarkdownImages(
                    force ? content.description : localized.description,
                    markdownImages(content.description),
                  ),
                }
              : {}),
          },
        });
    }
    count += !existing || force || forceImages ? 1 : 0;
  }
  return count;
}

async function main() {
  // Generated (scraped) copy, plus the hand-authored pages that have no scraped source.
  const pages: Record<string, Partial<Record<Locale, PageContent>>> = {
    ...readJson<Record<string, Partial<Record<Locale, PageContent>>>>(
      "content/generated/pages.json",
    ),
    ...AUTHORED_PAGES,
  };
  for (const locale of ["fi", "en", "ru"] as const) {
    const about = pages.about?.[locale];
    if (about)
      pages.about![locale] = {
        ...about,
        body: applyCancellationPolicyToAboutBody(about.body, locale),
      };
  }
  const products = readJson<Product[]>("content/generated/products.json");
  const pageCount = await syncPages(pages);
  const serviceCount = await syncServices(pages);
  const standaloneOptionCount = await syncStandaloneAppointmentOptions();
  await syncEndospheresBookingAndPricing();
  const technologyCount = await syncTechnologies(pages);
  const productCount = await syncProducts(products);
  console.log(
    `${force ? "Force-refreshed" : "Created missing"}: ${pageCount} pages, ${serviceCount} services, ${standaloneOptionCount} standalone appointment options, ${technologyCount} technologies, ${productCount} products.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
