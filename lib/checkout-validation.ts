import { normalizeCheckoutPhone } from "@/lib/phone";

export type CheckoutValidationField =
  | "fullName"
  | "phone"
  | "email"
  | "recipientName"
  | "line1"
  | "postalCode"
  | "city"
  | "consent";

export type CheckoutValidationError =
  | "name_required"
  | "phone_required"
  | "phone_invalid"
  | "email_required"
  | "recipient_required"
  | "line1_required"
  | "postal_code_invalid"
  | "city_required"
  | "consent_required";

export type CheckoutValidationErrors = Partial<
  Record<CheckoutValidationField, CheckoutValidationError>
>;

type CheckoutValidationInput = {
  fullName: string;
  phone: string;
  email: string;
  consent: boolean;
  shippingAddress?: {
    recipientName: string;
    line1: string;
    postalCode: string;
    city: string;
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CHECKOUT_FIELD_ORDER: CheckoutValidationField[] = [
  "fullName",
  "phone",
  "email",
  "recipientName",
  "line1",
  "postalCode",
  "city",
  "consent",
];

export function validateCheckoutFields(
  input: CheckoutValidationInput,
): CheckoutValidationErrors {
  const errors: CheckoutValidationErrors = {};

  if (!input.fullName.trim()) errors.fullName = "name_required";
  if (!input.phone.trim()) errors.phone = "phone_required";
  else if (!normalizeCheckoutPhone(input.phone)) errors.phone = "phone_invalid";
  if (!EMAIL_RE.test(input.email.trim())) errors.email = "email_required";

  if (input.shippingAddress) {
    if (!input.shippingAddress.recipientName.trim())
      errors.recipientName = "recipient_required";
    if (!input.shippingAddress.line1.trim()) errors.line1 = "line1_required";
    if (!/^\d{5}$/.test(input.shippingAddress.postalCode.trim()))
      errors.postalCode = "postal_code_invalid";
    if (!input.shippingAddress.city.trim()) errors.city = "city_required";
  }

  if (!input.consent) errors.consent = "consent_required";

  return errors;
}

export function firstCheckoutValidationError(errors: CheckoutValidationErrors) {
  return CHECKOUT_FIELD_ORDER.find((field) => errors[field]);
}
