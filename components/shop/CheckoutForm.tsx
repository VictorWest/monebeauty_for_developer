"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/shop/CartProvider";
import { ButtonAction } from "@/components/ui/Button";
import { formatPrice } from "@/content/products";
import { cn } from "@/lib/cn";
import {
  firstCheckoutValidationError,
  validateCheckoutFields,
  type CheckoutValidationError,
  type CheckoutValidationErrors,
  type CheckoutValidationField,
} from "@/lib/checkout-validation";
import { normalizeCheckoutPhone } from "@/lib/phone";
import { PUBLIC_PATHS } from "@/lib/public-routes";

type CheckoutAddress = {
  id: string;
  label: string;
  recipientName: string;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  isDefault: boolean;
};

export function CheckoutForm({
  initialDetails,
  addresses = [],
  verifiedEmail = false,
}: {
  initialDetails?: { fullName: string; phone: string; email: string };
  addresses?: CheckoutAddress[];
  verifiedEmail?: boolean;
}) {
  const t = useTranslations("Checkout");
  const tb = useTranslations("Basket");
  const locale = useLocale();
  const cart = useCart();
  const [form, setForm] = useState({
    fullName: initialDetails?.fullName ?? "",
    phone: initialDetails?.phone ?? "",
    email: initialDetails?.email ?? "",
    notes: "",
  });
  const defaultAddress = addresses.find((address) => address.isDefault);
  const [addressId, setAddressId] = useState(defaultAddress?.id ?? "new");
  const [saveAddress, setSaveAddress] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    recipientName: initialDetails?.fullName ?? "",
    line1: "",
    line2: "",
    postalCode: "",
    city: "",
  });
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CheckoutValidationErrors>({});
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "PICKUP" | "SHIPPING"
  >("PICKUP");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const hasPhysical = cart.lines.some(
    (line) => (line.product.kind ?? "PHYSICAL") === "PHYSICAL",
  );

  function fieldError(field: CheckoutValidationField) {
    const key = fieldErrors[field];
    return key ? t(`errors.${key}`) : null;
  }

  function clearFieldError(field: CheckoutValidationField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function revealField(field: CheckoutValidationField) {
    window.requestAnimationFrame(() => {
      const control = formRef.current?.querySelector<HTMLElement>(
        `[data-checkout-field="${field}"]`,
      );
      if (!control) return;
      control.focus({ preventScroll: true });
      control.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    });
  }

  function revealFormError() {
    window.requestAnimationFrame(() => {
      formErrorRef.current?.focus({ preventScroll: true });
      formErrorRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    });
  }

  function showServerFieldError(
    field: CheckoutValidationField,
    key: CheckoutValidationError,
  ) {
    setFieldErrors((current) => ({ ...current, [field]: key }));
    revealField(field);
  }

  async function submit() {
    setError(null);
    const nextErrors = validateCheckoutFields({
      ...form,
      consent,
      shippingAddress:
        hasPhysical && fulfillmentMethod === "SHIPPING" && addressId === "new"
          ? shippingAddress
          : undefined,
    });
    setFieldErrors(nextErrors);
    const firstInvalidField = firstCheckoutValidationError(nextErrors);
    if (firstInvalidField) {
      revealField(firstInvalidField);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          locale,
          consentGdpr: consent,
          fulfillmentMethod: hasPhysical ? fulfillmentMethod : "DIGITAL",
          ...(hasPhysical && fulfillmentMethod === "SHIPPING"
            ? {
                savedAddressId: addressId === "new" ? null : addressId,
                shippingAddress:
                  addressId === "new" ? shippingAddress : undefined,
                saveAddress: addressId === "new" && saveAddress,
              }
            : {}),
          items: cart.items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key = String(data?.error ?? "generic");
        const message = t.has(`errors.${key}`)
          ? t(`errors.${key}`)
          : t("errors.generic");
        switch (key) {
          case "name_required":
            showServerFieldError("fullName", key);
            break;
          case "phone_required":
          case "phone_invalid":
            showServerFieldError("phone", key);
            break;
          case "email_required":
            showServerFieldError("email", key);
            break;
          case "consent_required":
            showServerFieldError("consent", key);
            break;
          default:
            setError(message);
            revealFormError();
        }
        return;
      }
      if (!data.checkoutUrl) {
        setError(t("errors.generic"));
        revealFormError();
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setError(t("errors.generic"));
      revealFormError();
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-[480px] rounded-[var(--radius)] border border-line-card bg-card p-[clamp(24px,4vw,40px)] text-center">
        <p className="font-sans text-[15px] text-body">{tb("empty")}</p>
        <Link
          href={PUBLIC_PATHS.shop}
          className="mt-[22px] inline-flex min-h-[44px] items-center rounded-[4px] bg-accent px-[24px] font-sans text-[12px] font-medium tracking-[.16em] text-page uppercase"
        >
          {tb("browse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-[clamp(24px,4vw,48px)] lg:grid-cols-[1fr_360px]">
      <form
        ref={formRef}
        noValidate
        className="rounded-[var(--radius)] border border-line-card bg-card p-[clamp(22px,3vw,36px)]"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {error ? (
          <p
            ref={formErrorRef}
            role="alert"
            tabIndex={-1}
            className="mb-[18px] rounded-[4px] border border-line-btn bg-btn-fill px-[14px] py-[10px] font-sans text-[14px] text-ink"
          >
            {error}
          </p>
        ) : null}
        <div className="grid gap-[14px]">
          <Field
            label={t("fields.name")}
            required
            error={fieldError("fullName")}
            errorId="checkout-name-error"
          >
            <input
              required
              autoComplete="name"
              data-checkout-field="fullName"
              value={form.fullName}
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={
                fieldErrors.fullName ? "checkout-name-error" : undefined
              }
              onChange={(e) => {
                setForm({ ...form, fullName: e.target.value });
                clearFieldError("fullName");
              }}
              className={cn(inputCls, fieldErrors.fullName && "border-accent")}
            />
          </Field>
          <Field
            label={t("fields.phone")}
            required
            error={fieldError("phone")}
            errorId="checkout-contact-phone-error"
          >
            <input
              required
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={32}
              placeholder="+358 40 123 4567"
              data-checkout-field="phone"
              value={form.phone}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={
                fieldErrors.phone ? "checkout-contact-phone-error" : undefined
              }
              onBlur={() => {
                if (!form.phone.trim()) {
                  setFieldErrors((current) => ({
                    ...current,
                    phone: "phone_required",
                  }));
                } else if (!normalizeCheckoutPhone(form.phone)) {
                  setFieldErrors((current) => ({
                    ...current,
                    phone: "phone_invalid",
                  }));
                }
              }}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                clearFieldError("phone");
              }}
              className={cn(inputCls, fieldErrors.phone && "border-accent")}
            />
          </Field>
          <Field
            label={t("fields.email")}
            required
            error={fieldError("email")}
            errorId="checkout-email-error"
          >
            <input
              required
              type="email"
              autoComplete="email"
              readOnly={verifiedEmail}
              data-checkout-field="email"
              value={form.email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? "checkout-email-error" : undefined
              }
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                clearFieldError("email");
              }}
              className={cn(inputCls, fieldErrors.email && "border-accent")}
            />
          </Field>
          <Field label={t("fields.notes")}>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={cn(inputCls, "resize-y")}
            />
          </Field>
        </div>

        {hasPhysical ? (
          <fieldset className="mt-[20px]">
            <legend className="font-sans text-label tracking-[.04em] text-muted uppercase">
              {t("fulfillment.heading")}
            </legend>
            <div className="mt-[9px] grid gap-[10px] sm:grid-cols-2">
              {(["PICKUP", "SHIPPING"] as const).map((method) => (
                <label
                  key={method}
                  className={cn(
                    "flex min-h-[54px] cursor-pointer items-center gap-[10px] rounded-[4px] border px-[14px] font-sans text-[14px]",
                    fulfillmentMethod === method
                      ? "border-accent bg-btn-fill text-ink"
                      : "border-line-btn bg-page text-body",
                  )}
                >
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value={method}
                    checked={fulfillmentMethod === method}
                    onChange={() => setFulfillmentMethod(method)}
                    className="h-[18px] w-[18px] accent-[var(--accent)]"
                  />
                  <span>{t(`fulfillment.${method.toLowerCase()}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {hasPhysical && fulfillmentMethod === "SHIPPING" ? (
          <fieldset className="mt-[20px] border-t border-line-hair pt-[18px]">
            <legend className="font-sans text-label tracking-[.04em] text-muted uppercase">
              {t("address.heading")}
            </legend>
            {addresses.length ? (
              <div className="mt-3 grid gap-2">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className="flex cursor-pointer items-start gap-3 rounded border border-line-btn bg-page p-3 font-sans text-sm"
                  >
                    <input
                      type="radio"
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id)}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <span>
                      <strong>{address.recipientName}</strong>
                      {address.isDefault ? ` · ${t("address.default")}` : ""}
                      <br />
                      {address.line1}, {address.postalCode} {address.city}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            <label className="mt-2 flex cursor-pointer items-center gap-3 rounded border border-line-btn bg-page p-3 font-sans text-sm">
              <input
                type="radio"
                checked={addressId === "new"}
                onChange={() => setAddressId("new")}
                className="accent-[var(--accent)]"
              />
              {t("address.new")}
            </label>
            {addressId === "new" ? (
              <div className="mt-4 grid gap-3">
                <Field
                  label={t("address.recipient")}
                  required
                  error={fieldError("recipientName")}
                  errorId="checkout-recipient-error"
                >
                  <input
                    required
                    autoComplete="name"
                    data-checkout-field="recipientName"
                    value={shippingAddress.recipientName}
                    aria-invalid={Boolean(fieldErrors.recipientName)}
                    aria-describedby={
                      fieldErrors.recipientName
                        ? "checkout-recipient-error"
                        : undefined
                    }
                    onChange={(e) => {
                      setShippingAddress({
                        ...shippingAddress,
                        recipientName: e.target.value,
                      });
                      clearFieldError("recipientName");
                    }}
                    className={cn(
                      inputCls,
                      fieldErrors.recipientName && "border-accent",
                    )}
                  />
                </Field>
                <Field
                  label={t("address.line1")}
                  required
                  error={fieldError("line1")}
                  errorId="checkout-line1-error"
                >
                  <input
                    required
                    autoComplete="address-line1"
                    data-checkout-field="line1"
                    value={shippingAddress.line1}
                    aria-invalid={Boolean(fieldErrors.line1)}
                    aria-describedby={
                      fieldErrors.line1 ? "checkout-line1-error" : undefined
                    }
                    onChange={(e) => {
                      setShippingAddress({
                        ...shippingAddress,
                        line1: e.target.value,
                      });
                      clearFieldError("line1");
                    }}
                    className={cn(
                      inputCls,
                      fieldErrors.line1 && "border-accent",
                    )}
                  />
                </Field>
                <Field label={t("address.line2")}>
                  <input
                    autoComplete="address-line2"
                    value={shippingAddress.line2}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        line2: e.target.value,
                      })
                    }
                    className={inputCls}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={t("address.postalCode")}
                    required
                    error={fieldError("postalCode")}
                    errorId="checkout-postal-code-error"
                  >
                    <input
                      required
                      pattern="[0-9]{5}"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      data-checkout-field="postalCode"
                      value={shippingAddress.postalCode}
                      aria-invalid={Boolean(fieldErrors.postalCode)}
                      aria-describedby={
                        fieldErrors.postalCode
                          ? "checkout-postal-code-error"
                          : undefined
                      }
                      onChange={(e) => {
                        setShippingAddress({
                          ...shippingAddress,
                          postalCode: e.target.value,
                        });
                        clearFieldError("postalCode");
                      }}
                      className={cn(
                        inputCls,
                        fieldErrors.postalCode && "border-accent",
                      )}
                    />
                  </Field>
                  <Field
                    label={t("address.city")}
                    required
                    error={fieldError("city")}
                    errorId="checkout-city-error"
                  >
                    <input
                      required
                      autoComplete="address-level2"
                      data-checkout-field="city"
                      value={shippingAddress.city}
                      aria-invalid={Boolean(fieldErrors.city)}
                      aria-describedby={
                        fieldErrors.city ? "checkout-city-error" : undefined
                      }
                      onChange={(e) => {
                        setShippingAddress({
                          ...shippingAddress,
                          city: e.target.value,
                        });
                        clearFieldError("city");
                      }}
                      className={cn(
                        inputCls,
                        fieldErrors.city && "border-accent",
                      )}
                    />
                  </Field>
                </div>
                {verifiedEmail ? (
                  <label className="flex items-center gap-2 font-sans text-sm text-body">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    {t("address.save")}
                  </label>
                ) : null}
              </div>
            ) : null}
            <p className="mt-3 font-sans text-xs leading-5 text-muted">
              {t("address.stripeConfirm")}
            </p>
          </fieldset>
        ) : null}

        <div className="mt-[18px]">
          <label className="flex items-start gap-[10px] font-sans text-[14px] leading-[1.6] text-body">
            <input
              type="checkbox"
              required
              data-checkout-field="consent"
              checked={consent}
              aria-invalid={Boolean(fieldErrors.consent)}
              aria-describedby={
                fieldErrors.consent ? "checkout-consent-error" : undefined
              }
              onChange={(e) => {
                setConsent(e.target.checked);
                clearFieldError("consent");
              }}
              className="mt-[3px] h-[18px] w-[18px] accent-[var(--accent)]"
            />
            <span>
              {t.rich("fields.consent", {
                link: (chunks) => (
                  <Link
                    href={PUBLIC_PATHS.privacy}
                    target="_blank"
                    className="underline underline-offset-4 hover:text-accent"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {fieldError("consent") ? (
            <span
              id="checkout-consent-error"
              role="alert"
              className="mt-[6px] block font-sans text-[13px] leading-[1.4] text-accent"
            >
              {fieldError("consent")}
            </span>
          ) : null}
        </div>

        <div className="mt-[24px]">
          <ButtonAction
            type="submit"
            iconRight={ArrowRight}
            disabled={submitting}
            className="disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t("submitting") : t("submit")}
          </ButtonAction>
        </div>
      </form>

      <aside className="h-fit rounded-[var(--radius)] border border-line-card bg-card p-[clamp(20px,3vw,28px)]">
        <h2 className="font-display text-[26px] font-medium text-ink">
          {t("summary")}
        </h2>
        <div className="mt-[18px] space-y-[12px]">
          {cart.lines.map((line) => {
            const name =
              line.product.i18n[locale as "fi" | "en" | "ru"]?.name ??
              line.product.slug;
            return (
              <div
                key={line.product.slug}
                className="flex justify-between gap-[14px] border-b border-line-hair pb-[12px] font-sans text-[14px]"
              >
                <span className="text-body">
                  {line.qty} x {name}
                </span>
                <span className="shrink-0 text-ink">
                  {formatPrice(line.lineTotal)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-[16px] flex justify-between gap-[16px] font-sans text-[15px] font-medium text-ink">
          <span>{tb("subtotal")}</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>
      </aside>
    </div>
  );
}

const inputCls =
  "w-full rounded-[4px] border border-line-btn bg-page px-[14px] py-[11px] font-sans text-copy text-ink outline-none focus:border-accent";

function Field({
  label,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-sans text-label tracking-[.04em] text-muted uppercase">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="mt-[6px] block font-sans text-[13px] leading-[1.4] text-accent"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
