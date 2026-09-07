import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/content/site";
import { cn } from "@/lib/cn";

/** Real script logo from the live site (public/logo.svg). */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label={BRAND.name} className="inline-flex items-center">
      <Image
        src={BRAND.logo}
        alt={BRAND.name}
        width={150}
        height={77}
        priority
        unoptimized
        className={cn("h-[52px] w-auto", className)}
      />
    </Link>
  );
}
