import { setRequestLocale } from "next-intl/server";
import { HomeReference } from "@/components/home/HomeReference";
import { JsonLd } from "@/components/JsonLd";
import { medicalClinicJsonLd } from "@/lib/seo";
import {
  getLiveProducts,
  getPublishedServices,
  getPublishedTechnologies,
} from "@/lib/live-content";
import type { Locale } from "@/i18n/routing";
import { getSiteMediaMap } from "@/lib/site-media";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const currentLocale = locale as Locale;
  const [serviceRows, technologyRows, products, siteMedia] = await Promise.all([
    getPublishedServices(currentLocale),
    getPublishedTechnologies(currentLocale),
    getLiveProducts(currentLocale),
    getSiteMediaMap(
      [
        "home.hero-poster",
        "home.area.face",
        "home.area.body",
        "home.area.hair",
        "home.area.men",
        "site.default-social",
      ],
      currentLocale,
    ),
  ]);
  const services = serviceRows
    .filter((service) => service.bookable && service.publicPath)
    .map((service) => ({
      key: service.slug,
      name: service.content.h1,
      description: service.content.shortDesc,
      durationMin: service.durationMin,
      image: service.images[0] ?? null,
      imageFocalX: service.imageFocalX,
      imageFocalY: service.imageFocalY,
      href: service.publicPath!,
    }));
  const technologies = technologyRows.map((technology) => ({
    key: technology.slug,
    name: technology.content.name,
    specification: technology.content.specification,
    body: technology.content.summary || technology.content.body,
    image: technology.images[0] ?? null,
    imageFocalX: technology.imageFocalX,
    imageFocalY: technology.imageFocalY,
    href: technology.publicPath,
    bookingKey: technology.relatedService?.bookable
      ? technology.relatedService.slug
      : null,
  }));

  return (
    <>
      <JsonLd
        data={medicalClinicJsonLd(
          siteMedia["site.default-social"].image ??
            siteMedia["home.hero-poster"].image ??
            undefined,
        )}
      />
      <HomeReference
        services={services}
        technologies={technologies}
        productCatalog={products}
        siteMedia={siteMedia}
      />
    </>
  );
}
