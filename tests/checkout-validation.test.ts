import assert from "node:assert/strict";
import test from "node:test";
import {
  firstCheckoutValidationError,
  validateCheckoutFields,
} from "../lib/checkout-validation";

const validCheckout = {
  fullName: "Ada Lovelace",
  phone: "+358 40 123 4567",
  email: "ada@example.com",
  consent: true,
};

test("checkout validation accepts valid pickup details", () => {
  assert.deepEqual(validateCheckoutFields(validCheckout), {});
});

test("checkout validation reports every invalid contact field and consent", () => {
  const errors = validateCheckoutFields({
    fullName: " ",
    phone: "",
    email: "invalid",
    consent: false,
  });

  assert.deepEqual(errors, {
    fullName: "name_required",
    phone: "phone_required",
    email: "email_required",
    consent: "consent_required",
  });
  assert.equal(firstCheckoutValidationError(errors), "fullName");
});

test("checkout validation distinguishes a malformed phone number", () => {
  const errors = validateCheckoutFields({
    ...validCheckout,
    phone: "040 123 4567",
  });

  assert.equal(errors.phone, "phone_invalid");
  assert.equal(firstCheckoutValidationError(errors), "phone");
});

test("checkout validation checks every new Finland shipping-address field", () => {
  const errors = validateCheckoutFields({
    ...validCheckout,
    shippingAddress: {
      recipientName: "",
      line1: "",
      postalCode: "1234",
      city: "",
    },
  });

  assert.deepEqual(errors, {
    recipientName: "recipient_required",
    line1: "line1_required",
    postalCode: "postal_code_invalid",
    city: "city_required",
  });
  assert.equal(firstCheckoutValidationError(errors), "recipientName");
});

test("checkout validation ignores an address when pickup or a saved address is used", () => {
  assert.deepEqual(validateCheckoutFields(validCheckout), {});
});
