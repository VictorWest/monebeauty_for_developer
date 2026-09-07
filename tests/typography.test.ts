import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

const styles = read("app/globals.css");
const markdown = read("components/Markdown.tsx");
const booking = read("components/booking/BookingWizard.tsx");
const checkout = read("components/shop/CheckoutForm.tsx");
const chat = read("components/ui/ChatWidget.tsx");
const admin = read("components/admin/AdminRouter.tsx");
const adminShell = read("components/admin/AdminShell.tsx");
const adminIconButton = read("components/admin/AdminIconButton.tsx");
const fonts = read("lib/fonts.ts");
const adminLayout = read("app/(admin)/admin/layout.tsx");
const localizedAdminLayout = read("app/(admin)/[locale]/admin/layout.tsx");
const staff = read("components/staff/StaffSchedule.tsx");
const operationalIcons = [
  adminShell,
  admin,
  read("components/admin/AdminPasswordField.tsx"),
  read("components/admin/CommunicationComposer.tsx"),
  read("components/calendar/SharedCalendar.tsx"),
  read("components/calendar/AppointmentForm.tsx"),
  read("components/calendar/InternalServicePaletteEditor.tsx"),
  read("components/ui/CalendarPicker.tsx"),
  read("components/ui/ThemedSelect.tsx"),
  read("components/ui/TimePicker.tsx"),
].join("\n");

test("shared typography tokens define readable functional sizes", () => {
  assert.match(styles, /--text-copy: 16px/);
  assert.match(styles, /--text-compact: 15px/);
  assert.match(styles, /--text-label: 13px/);
  assert.match(styles, /--text-meta: 12px/);
  assert.match(
    styles,
    /\.hr-booking input,[\s\S]*?font-size: 16px;[\s\S]*?text-transform: none;/,
  );
});

test("public forms and reading content use the readable scale", () => {
  assert.match(booking, /const inputCls =\s*\n\s*"[^"]*text-copy/);
  assert.match(checkout, /const inputCls =\s*\n\s*"[^"]*text-copy/);
  assert.match(chat, /min-h-\[44px\][^"]*text-copy/);
  assert.match(chat, /const inputCls =\s*\n\s*"[^"]*text-copy/);
  assert.match(markdown, /text-copy leading-\[1\.8\] font-normal/);
  assert.doesNotMatch(markdown, /font-light text-body/);
});

test("admin and staff controls avoid dense microcopy", () => {
  assert.match(admin, /const inputCls =\s*\n\s*"[^"]*text-compact/);
  assert.match(
    admin,
    /text-\[14px\] font-medium text-body[\s\S]*activityAction\(entry\.action\)/,
  );
  assert.match(admin, /const recordRow =\s*\n\s*"[^"]*text-\[14px\]/);
  assert.match(staff, /const inputCls =\s*\n\s*"[^"]*text-compact/);
});

test("admin uses an isolated professional multilingual type system", () => {
  assert.match(fonts, /export const inter = Inter/);
  assert.match(fonts, /"cyrillic"/);
  assert.match(fonts, /"cyrillic-ext"/);
  assert.match(fonts, /variable: "--font-admin"/);
  assert.match(adminLayout, /inter\.variable/);
  assert.match(localizedAdminLayout, /inter\.variable/);
  assert.match(adminLayout, /className="admin-app/);
  assert.match(
    styles,
    /\.admin-app \{[\s\S]*?--font-display: var\(--font-admin\)/,
  );
  assert.match(styles, /\.admin-app h1 \{[\s\S]*?font-weight: 600/);
  assert.match(styles, /font-variant-numeric: tabular-nums/);
});

test("admin operational icons use strong vectors and accessible targets", () => {
  assert.doesNotMatch(operationalIcons, /weight="thin"/);
  assert.doesNotMatch(operationalIcons, />\s*[×→←☰]\s*</);
  assert.match(adminShell, /weight=\{active \? "bold" : "regular"\}/);
  assert.match(adminIconButton, /min-h-11 min-w-11/);
  assert.match(adminIconButton, /aria-label=\{label\}/);
  assert.match(adminIconButton, /role="tooltip"/);
});

test("client records separate name, email, and phone", () => {
  assert.match(admin, /strong className="block text-compact/);
  assert.match(admin, /small className="mt-1\.25 flex flex-wrap gap-x-3/);
  assert.match(admin, /span className="break-all">\{client\.email\}/);
  assert.match(admin, /span className="whitespace-nowrap">\{client\.phone\}/);
  assert.doesNotMatch(admin, /\{client\.email\}\s*·\s*\{client\.phone\}/);
});
