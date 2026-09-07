"use client";

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { useRouter } from "@/i18n/navigation";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { ThemedSelect } from "@/components/ui/ThemedSelect";

export function ServicePicker({
  services,
  labels,
}: {
  services: { key: string; title: string }[];
  labels: { placeholder: string; cta: string };
}) {
  const router = useRouter();
  const [service, setService] = useState(services[0]?.key ?? "");
  return (
    <div className="flex w-full flex-col gap-[12px] sm:flex-row">
      <label className="sr-only" htmlFor="home-service-picker">
        {labels.placeholder}
      </label>
      <ThemedSelect
        id="home-service-picker"
        value={service}
        onValueChange={setService}
        options={services.map((item) => ({
          value: item.key,
          label: item.title,
        }))}
        placeholder={labels.placeholder}
        className="min-h-[52px] flex-1 [&_button[data-trigger]]:min-h-[52px] [&_button[data-trigger]]:bg-card"
      />
      <button
        type="button"
        onClick={() =>
          router.push(`${PUBLIC_PATHS.booking}?service=${service}`)
        }
        className="inline-flex min-h-[52px] items-center justify-center gap-[10px] rounded-[4px] bg-accent px-[26px] font-sans text-[12px] font-medium tracking-[.16em] text-page uppercase transition-transform hover:-translate-y-px"
      >
        {labels.cta}
        <ArrowRight size={17} weight="thin" />
      </button>
    </div>
  );
}
