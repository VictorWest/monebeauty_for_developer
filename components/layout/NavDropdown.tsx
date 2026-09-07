"use client";

import { useState, useRef, useEffect } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";

export function NavDropdown({
  label,
  href,
  items,
}: {
  label: string;
  /** When the item also has a page of its own, the label links to it. */
  href?: string;
  items: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Matches `.hr-nav a:not(.hr-btn)` in app/globals.css so the trigger is
          indistinguishable from its sibling links. Where the item has a page of
          its own, the label navigates and only the caret opens the submenu, so
          the index page stays reachable. */}
      <div className="flex items-center gap-[5px] whitespace-nowrap">
        {/* Size and tracking come from `.hr-nav a:not(.hr-btn), .hr-nav-label`
            in app/globals.css, so the trigger always matches its sibling links
            rather than pinning its own values. */}
        {href ? (
          <Link
            href={href}
            onClick={() => setOpen(false)}
            className="hr-nav-label font-sans transition-colors hover:text-accent"
          >
            {label}
          </Link>
        ) : (
          <span className="hr-nav-label font-sans">{label}</span>
        )}
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center text-nav transition-colors hover:text-accent"
        >
          <CaretDown size={12} weight="thin" />
        </button>
      </div>
      {/* Kept in the document and hidden with CSS rather than rendered on open,
          so the submenu links are crawlable and work without JavaScript, as they
          did on the previous site. */}
      <ul
        hidden={!open}
        className="absolute top-full left-0 z-[60] min-w-[240px] rounded-[8px] border border-line-header bg-page py-[8px] shadow-[var(--shadow-card)]"
      >
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              onClick={() => setOpen(false)}
              className="block px-[18px] py-[10px] font-sans text-[13px] text-nav transition-colors hover:bg-alt hover:text-accent"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
