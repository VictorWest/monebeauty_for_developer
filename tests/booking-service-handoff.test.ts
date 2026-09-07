import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const context = readFileSync("lib/booking-context.ts", "utf8");
const wizard = readFileSync("components/booking/BookingWizard.tsx", "utf8");
const page = readFileSync("app/(public)/[locale]/ajanvaraus/page.tsx", "utf8");
const serviceDetail = readFileSync(
  "components/services/ServiceDetailPage.tsx",
  "utf8",
);

test("Endospheres CTA copy is localized and uses the locale-aware booking link", () => {
  assert.match(serviceDetail, /Ready to book Endospheres Therapy®\?/u);
  assert.match(serviceDetail, /Book an appointment\./u);
  assert.match(
    serviceDetail,
    /Valmis varaamaan Endospheres Therapy® -hoidon\?/u,
  );
  assert.match(serviceDetail, /Готовы записаться на Endospheres Therapy®\?/u);
  assert.match(serviceDetail, /query: \{ service: service\.slug \}/u);
  assert.match(serviceDetail, /pathname: PUBLIC_PATHS\.booking/u);
});

test("explicit hidden service context resolves without exposing it in the picker", () => {
  const pickerQuery = context.slice(
    context.indexOf("export async function getBookingServiceOptions"),
    context.indexOf("export async function getBookingContext"),
  );
  const contextualQuery = context.slice(
    context.indexOf("export async function getBookingContext"),
    context.indexOf("function localizedOptions"),
  );
  assert.match(pickerQuery, /bookingPickerVisible: true/u);
  assert.doesNotMatch(contextualQuery, /bookingPickerVisible/u);
  assert.match(
    wizard,
    /initialContext\?\.service\.key === service[\s\S]*initialContext\.service/u,
  );
  assert.match(wizard, /selectedService\.options\.map/u);
  assert.match(context, /normalizeEndospheresBookingOptions/u);
});

test("booking uses localized selected-service media with the global hero as fallback", () => {
  assert.match(context, /imageAlt: content\.imageAlt \|\| content\.h1/u);
  assert.match(
    page,
    /const selectedServiceMedia = bookingContext\?\.service\.image/u,
  );
  assert.match(page, /image: bookingContext\.service\.image/u);
  assert.match(page, /alt: bookingContext\.service\.imageAlt/u);
  assert.match(page, /focalX: bookingContext\.service\.imageFocalX/u);
  assert.match(page, /focalY: bookingContext\.service\.imageFocalY/u);
  assert.match(page, /: bookingMedia/u);
  assert.match(page, /src=\{selectedServiceMedia\.image\}/u);
  assert.match(wizard, /alt=\{service\.imageAlt\}/u);
  assert.match(wizard, /alt=\{s\.imageAlt\}/u);
});
