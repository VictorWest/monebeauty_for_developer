import { FlowerLotus, User } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";
import { NavDropdown } from "./NavDropdown";
import { mainNavigation } from "@/lib/navigation";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { HeaderCartLink } from "@/components/shop/HeaderCartLink";

export async function Header() {
  const t = await getTranslations("HomeReference");
  const th = await getTranslations("Header");
  const tn = await getTranslations("Nav");
  const links = mainNavigation((key) => tn(key));

  return (
    <header className="hr-header">
      <div className="hr-container hr-header-inner">
        <Link className="hr-brand" href="/#top" aria-label="Mone Beauty Clinic">
          <FlowerLotus weight="thin" />
          <b>MONE</b>
          <span>Beauty Clinic</span>
        </Link>

        <nav className="hr-nav hr-right" aria-label={t("nav.menu")}>
          {links.map((link) =>
            link.items ? (
              <NavDropdown
                key={link.label}
                label={link.label}
                href={link.href}
                items={link.items}
              />
            ) : (
              <Link key={link.label} href={link.href!}>
                {link.label}
              </Link>
            ),
          )}
          <Link className="hr-btn dark small" href={PUBLIC_PATHS.booking}>
            {t("common.bookOnline")}
          </Link>
          <HeaderCartLink />
          {/* An icon beside the cart rather than a label: the six-item menu
              needs the width, and the previous site had no account link in its
              bar at all. The name moves to aria-label so it is still announced. */}
          <Link
            href={PUBLIC_PATHS.account}
            aria-label={th("account")}
            className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-[4px] text-nav transition-colors hover:bg-alt hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <User size={22} weight="thin" />
          </Link>
          <LanguageSwitcher />
        </nav>

        <MobileMenu
          links={links}
          bookOnline={t("common.bookOnline")}
          openLabel={th("openMenu")}
          closeLabel={th("closeMenu")}
          accountLabel={th("account")}
        />
      </div>
    </header>
  );
}
