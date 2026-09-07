"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";

export function AdminPasswordField({
  name,
  placeholder,
  showLabel,
  hideLabel,
  autoComplete = "new-password",
  className = "",
  wrapperClassName = "",
}: {
  name: string;
  placeholder?: string;
  showLabel: string;
  hideLabel: string;
  autoComplete?: "current-password" | "new-password";
  className?: string;
  wrapperClassName?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        className={`${className} pr-[46px]`}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        maxLength={128}
        placeholder={placeholder}
        required
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 grid w-[44px] place-items-center rounded-r-[4px] text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
        aria-pressed={visible}
      >
        {visible ? <EyeSlash size={19} /> : <Eye size={19} />}
      </button>
    </div>
  );
}
