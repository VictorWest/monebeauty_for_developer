"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import type { Locale } from "@/i18n/routing";
import { authInputBase } from "@/components/account/AuthCard";

const visibility = {
  fi: { show: "Näytä salasana", hide: "Piilota salasana" },
  en: { show: "Show password", hide: "Hide password" },
  ru: { show: "Показать пароль", hide: "Скрыть пароль" },
} satisfies Record<Locale, { show: string; hide: string }>;

export function AuthPasswordField({
  locale,
  label,
  name,
  autoComplete,
}: {
  locale: Locale;
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  const copy = visibility[locale];

  return (
    <label className="block font-sans text-[13px] text-body">
      {label}
      <div className="relative mt-[6px]">
        <input
          className={`${authInputBase} pr-[48px]`}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 grid w-[46px] place-items-center rounded-r-[4px] text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          aria-label={visible ? copy.hide : copy.show}
          title={visible ? copy.hide : copy.show}
          aria-pressed={visible}
        >
          {visible ? <EyeSlash size={19} /> : <Eye size={19} />}
        </button>
      </div>
    </label>
  );
}
