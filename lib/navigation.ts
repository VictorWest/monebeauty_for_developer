import {
  PUBLIC_PATHS,
  SERVICE_PUBLIC_PATHS,
  TECHNOLOGY_PUBLIC_PATHS,
} from "@/lib/public-routes";

export type NavLink = { label: string; href: string };
export type NavItem = {
  label: string;
  /** Absent when the item only opens a submenu and has no page of its own. */
  href?: string;
  items?: NavLink[];
};

/**
 * The published site menu, mirroring the structure the clinic's previous site
 * used: About, Instrumental cosmetology, Trichology, Arosha, Services, Catalog.
 *
 * The header previously linked to five homepage anchors instead, so none of
 * these pages was reachable from the navigation. Labels come from the `Nav`
 * message namespace, which already carried the full menu in all three locales,
 * and every target resolves through `lib/public-routes`.
 *
 * "Instrumental cosmetology" has no page of its own — there is no
 * `/laitehoidot` index route — so it opens a submenu and nothing else.
 */
export function mainNavigation(t: (key: string) => string): NavItem[] {
  return [
    { label: t("about"), href: PUBLIC_PATHS.clinic },
    {
      label: t("instrumental"),
      items: [
        { label: t("endospheres"), href: TECHNOLOGY_PUBLIC_PATHS.endospheres },
        { label: t("laser"), href: TECHNOLOGY_PUBLIC_PATHS.laser },
        { label: t("rf"), href: TECHNOLOGY_PUBLIC_PATHS.rf },
      ],
    },
    { label: t("trichology"), href: PUBLIC_PATHS.trichology },
    { label: t("arosha"), href: PUBLIC_PATHS.arosha },
    {
      label: t("services"),
      href: PUBLIC_PATHS.services,
      items: [
        { label: t("face"), href: SERVICE_PUBLIC_PATHS.facial },
        { label: t("body"), href: SERVICE_PUBLIC_PATHS.body },
        { label: t("serviceTricho"), href: SERVICE_PUBLIC_PATHS.trichology },
        { label: t("serviceLaser"), href: SERVICE_PUBLIC_PATHS.laser },
        { label: t("serviceRf"), href: SERVICE_PUBLIC_PATHS.rf },
        { label: t("eyebrows"), href: SERVICE_PUBLIC_PATHS.brows },
        { label: t("packages"), href: SERVICE_PUBLIC_PATHS.packages },
        { label: t("giftCards"), href: SERVICE_PUBLIC_PATHS.giftCards },
        // Services the clinic added since the previous site. Without these the
        // injectable and consultation pages have no entry in the menu at all.
        { label: t("endospheres"), href: SERVICE_PUBLIC_PATHS.endospheres },
        { label: t("injectable"), href: SERVICE_PUBLIC_PATHS.injectable },
        { label: t("consultation"), href: SERVICE_PUBLIC_PATHS.consultation },
      ],
    },
    { label: t("catalog"), href: PUBLIC_PATHS.shop },
  ];
}
