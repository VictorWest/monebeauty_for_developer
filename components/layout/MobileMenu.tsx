"use client";

import { useEffect, useRef, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { HeaderCartLink } from "@/components/shop/HeaderCartLink";
import { cormorant } from "@/lib/fonts";
import type { NavItem } from "@/lib/navigation";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export function MobileMenu({
  links,
  bookOnline,
  openLabel,
  closeLabel,
  accountLabel,
}: {
  links: NavItem[];
  bookOnline: string;
  openLabel: string;
  closeLabel: string;
  accountLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const previousOverflow = useRef("");

  useEffect(() => {
    if (open) {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow.current;
    }

    return () => {
      document.body.style.overflow = previousOverflow.current;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="hr-mobile">
      <HeaderCartLink />
      <LanguageSwitcher />
      <button
        type="button"
        aria-label={open ? closeLabel : openLabel}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <X size={22} weight="thin" />
        ) : (
          <List size={22} weight="thin" />
        )}
      </button>

      {open ? (
        <nav className="hr-menu" aria-label={openLabel}>
          {links.map((link, index) => (
            <div key={link.label}>
              {link.href ? (
                <Link href={link.href} onClick={close}>
                  {link.label}
                  <span className={cormorant.className}>0{index + 1}</span>
                </Link>
              ) : (
                // "Instrumental cosmetology" has no page of its own, so it is a
                // heading for the group beneath it rather than a link.
                <p className="hr-menu-group">
                  {link.label}
                  <span className={cormorant.className}>0{index + 1}</span>
                </p>
              )}
              {link.items ? (
                <div className="hr-menu-sub">
                  {link.items.map((item) => (
                    <Link key={item.href} href={item.href} onClick={close}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          <Link
            href={PUBLIC_PATHS.booking}
            className="hr-btn dark"
            onClick={close}
          >
            {bookOnline}
          </Link>
          <Link href={PUBLIC_PATHS.account} onClick={close}>
            {accountLabel}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
