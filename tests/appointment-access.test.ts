import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentIdFromManageToken,
  appointmentManageToken,
  validAppointmentManageToken,
} from "../lib/appointment-access";
import { appointmentCalendarToken } from "../lib/appointment-calendar";
import { orderAccessToken } from "../lib/order-access";

process.env.APPOINTMENT_ACCESS_SECRET = "manage-link-test-secret";

const ID = "appointment-abcdefgh";

test("a manage token round-trips and reveals the appointment it belongs to", () => {
  const token = appointmentManageToken(ID);
  assert.equal(appointmentIdFromManageToken(token), ID);
  assert.equal(validAppointmentManageToken(ID, token), true);
});

test("a manage token is rejected for a different appointment", () => {
  const token = appointmentManageToken(ID);
  assert.equal(validAppointmentManageToken("appointment-other", token), false);
});

test("tampering with any part of a manage token invalidates it", () => {
  const token = appointmentManageToken(ID);
  const [scope, id, expiry, signature] = token.split(".");
  assert.equal(
    validAppointmentManageToken(ID, `${scope}.${id}.${expiry}.${signature}x`),
    false,
  );
  assert.equal(
    validAppointmentManageToken(
      ID,
      `${scope}.${id}.${Number(expiry) + 86400}.${signature}`,
    ),
    false,
  );
  assert.equal(validAppointmentManageToken(ID, ""), false);
});

test("an expired manage token is rejected", () => {
  const token = appointmentManageToken(ID, Date.now() - 1000);
  assert.equal(validAppointmentManageToken(ID, token), false);
});

test("calendar and order tokens cannot be replayed as manage tokens", () => {
  process.env.APPOINTMENT_CALENDAR_SECRET = "manage-link-test-secret";
  process.env.ORDER_ACCESS_SECRET = "manage-link-test-secret";
  // Same secret material, different scope: the domain separator must still reject them.
  assert.equal(
    validAppointmentManageToken(ID, appointmentCalendarToken(ID)),
    false,
  );
  assert.equal(validAppointmentManageToken(ID, orderAccessToken(ID)), false);
  assert.equal(
    appointmentIdFromManageToken(appointmentCalendarToken(ID)),
    null,
  );
});
