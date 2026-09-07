import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_HANDOFF_TTL_MS,
  createBookingHandoff,
  isValidPreferredDate,
  parseBookingHandoff,
} from "../lib/booking-handoff";
import { parseProcedures, resolveProcedure } from "../lib/procedures";

const markdown = `### Facial care

#### Express treatment

An approved concise description.

#### 65 € / 45 minutes

Into a basket

#### Deep treatment

Another approved description.

#### 95 EUR / 60 minutes
`;

test("procedures use stable one-based ordering", () => {
  const procedures = parseProcedures(markdown);
  assert.equal(procedures.length, 2);
  assert.equal(procedures[0].title, "Express treatment");
  assert.equal(
    resolveProcedure(markdown, "2")?.procedure.title,
    "Deep treatment",
  );
});

test("invalid and stale procedure indexes never resolve", () => {
  for (const value of [undefined, "", "0", "1.5", "1x", "99", -1]) {
    assert.equal(resolveProcedure(markdown, value), null);
  }
});

test("booking handoff is versioned and expires after thirty minutes", () => {
  const now = Date.UTC(2026, 6, 16, 12);
  const handoff = createBookingHandoff(
    { service: "facial", fullName: "Test Client" },
    now,
  );
  assert.equal(
    parseBookingHandoff(
      JSON.stringify(handoff),
      now + BOOKING_HANDOFF_TTL_MS - 1,
    )?.fullName,
    "Test Client",
  );
  assert.equal(
    parseBookingHandoff(JSON.stringify(handoff), now + BOOKING_HANDOFF_TTL_MS),
    null,
  );
  assert.equal(parseBookingHandoff("not-json", now), null);
});

test("preferred dates must be real and non-past", () => {
  const now = new Date("2026-07-16T12:00:00Z");
  assert.equal(isValidPreferredDate("2026-07-16", now), true);
  assert.equal(isValidPreferredDate("2026-07-17", now), true);
  assert.equal(isValidPreferredDate("2026-07-15", now), false);
  assert.equal(isValidPreferredDate("2026-02-30", now), false);
  assert.equal(isValidPreferredDate("not-a-date", now), false);
});
