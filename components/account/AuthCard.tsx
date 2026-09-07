import Link from "next/link";

export const authInputBase =
  "min-h-[48px] w-full rounded-[4px] border border-line-btn bg-page px-[13px] font-sans text-[16px] text-ink outline-none focus:border-accent";
export const authInput = `mt-[6px] ${authInputBase}`;

export const authButton =
  "min-h-[48px] w-full rounded-[4px] bg-accent px-[20px] font-sans text-[13px] font-medium tracking-[.12em] text-page uppercase hover:brightness-95";

export function AuthCard({
  eyebrow,
  title,
  intro,
  error,
  children,
  links = [],
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  error?: string | null;
  children: React.ReactNode;
  links?: Array<{ href: string; label: string }>;
}) {
  return (
    <section className="bg-page px-[20px] py-[clamp(48px,8vw,96px)]">
      <div className="mx-auto w-full max-w-[470px] rounded-[var(--radius)] border border-line-card bg-card p-[clamp(22px,4vw,38px)] shadow-card">
        <p className="font-sans text-[12px] tracking-[.16em] text-muted uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-[10px] font-display text-[clamp(34px,6vw,48px)] leading-[1.05] font-medium text-ink">
          {title}
        </h1>
        {intro ? (
          <p className="mt-[12px] font-sans text-[15px] leading-relaxed text-body">
            {intro}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-[16px] rounded-[4px] border border-[#c98383] bg-[#fff4f2] px-[12px] py-[10px] font-sans text-[14px] text-ink"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-[22px]">{children}</div>
        {links.length ? (
          <div className="mt-[20px] flex flex-wrap gap-x-[18px] gap-y-[8px] border-t border-line-hair pt-[16px] font-sans text-[13px] text-body">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="underline underline-offset-4 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AuthField({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block font-sans text-[13px] text-body">
      {label}
      <input
        className={authInput}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}
