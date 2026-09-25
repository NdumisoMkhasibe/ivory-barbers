import assert from "node:assert/strict";
import test from "node:test";
import { appointmentInstants, availableSlots, calendarIcs, googleCalendarUrl, normalizePhone, openingMinutes, parseShopDate, shopDate, validateSelection, type SavedBooking } from "../lib/booking";
import { LOCATION, SERVICES } from "../lib/catalog";

const now = new Date("2026-09-25T12:00:00Z");
const date = "2026-09-28"; // Monday

test("all approved service prices and durations are authoritative", () => {
  assert.deepEqual(SERVICES.map(({ id, price, duration }) => [id, price, duration]), [
    ["chiskop", 150, 45], ["brush", 150, 45], ["fade", 150, 45],
    ["trim", 100, 30], ["beard", 100, 15], ["custom", 180, 60],
  ]);
  assert.throws(() => validateSelection("fake", "kylie"));
  assert.throws(() => validateSelection("fade", "ashley"));
});

test("Johannesburg dates handle midnight and reject nonexistent dates", () => {
  assert.equal(shopDate(new Date("2026-09-25T22:01:00Z")), "2026-09-26");
  assert.equal(parseShopDate(date).toISOString(), "2026-09-27T22:00:00.000Z");
  assert.throws(() => parseShopDate("2026-02-30"));
  assert.throws(() => parseShopDate("not-a-date"));
});

test("Sundays are closed and Saturday hours differ", () => {
  assert.equal(openingMinutes("2026-09-27"), null);
  assert.deepEqual(openingMinutes("2026-09-26"), { open: 480, close: 960 });
  assert.deepEqual(availableSlots("2026-09-27", "beard", "first-available", [], now), []);
  assert.throws(() => appointmentInstants("2026-09-27", "10:00", 15, now), /Sundays/);
  assert.throws(() => appointmentInstants("2026-09-26", "15:30", 45, now), /opening hours/);
});

test("slots use the full duration and an appointment may finish exactly at closing", () => {
  const slots = availableSlots(date, "custom", "kylie", [], now);
  assert.equal(slots[0].time, "09:00");
  assert.equal(slots.at(-1)?.time, "17:00");
  assert.equal(slots.length, 33);
  assert.equal(appointmentInstants(date, "17:00", 60, now).endAt, "2026-09-28T16:00:00.000Z");
  assert.throws(() => appointmentInstants(date, "17:15", 60, now), /opening hours/);
  assert.throws(() => appointmentInstants(date, "09:07", 15, now), /opening hours/);
});

test("past appointments and a start time equal to now cannot be booked", () => {
  assert.throws(() => appointmentInstants("2026-09-25", "13:45", 15, now), /future/);
  assert.throws(() => appointmentInstants("2026-09-25", "14:00", 15, now), /future/);
  assert.equal(availableSlots("2026-09-25", "beard", "kylie", [], now)[0].time, "14:15");
  assert.equal(availableSlots("2026-09-24", "beard", "kylie", [], now).length, 0);
});

test("overlap detection includes partial overlaps and permits adjacent appointments", () => {
  const busy = [{ barberId: "kylie", startAt: "2026-09-28T08:00:00Z", endAt: "2026-09-28T08:45:00Z" }];
  const times = availableSlots(date, "fade", "kylie", busy, now).map((slot) => slot.time);
  assert.ok(times.includes("09:15")); // Ends at 10:00, precisely before busy time.
  assert.ok(!times.includes("09:30")); // Would run into 10:00 appointment.
  assert.ok(!times.includes("10:00"));
  assert.ok(!times.includes("10:30"));
  assert.ok(times.includes("10:45"));
  assert.ok(availableSlots(date, "fade", "pro", busy, now).some((slot) => slot.time === "10:00"));
});

test("First Available requires one barber free for the entire service", () => {
  const busy = [
    { barberId: "kylie", startAt: "2026-09-28T08:00:00Z", endAt: "2026-09-28T08:15:00Z" },
    { barberId: "pro", startAt: "2026-09-28T08:15:00Z", endAt: "2026-09-28T08:30:00Z" },
    { barberId: "steve", startAt: "2026-09-28T08:30:00Z", endAt: "2026-09-28T08:45:00Z" },
  ];
  assert.ok(!availableSlots(date, "fade", "first-available", busy, now).some((slot) => slot.time === "10:00"));
  assert.ok(availableSlots(date, "fade", "first-available", busy.slice(0, 2), now).some((slot) => slot.time === "10:00"));
});

test("South African phone numbers normalize and invalid numbers are rejected", () => {
  assert.equal(normalizePhone("076 532 2261"), "+27765322261");
  assert.equal(normalizePhone("+27 (76) 532-2261"), "+27765322261");
  assert.equal(normalizePhone("27765322261"), "+27765322261");
  assert.throws(() => normalizePhone("+1 555 123 4567"));
  assert.throws(() => normalizePhone("1234567890"));
});

const booking: SavedBooking = {
  id: "00000000-0000-4000-8000-000000000001", serviceId: "fade", serviceName: "Fade Cut", barberId: "pro", barberName: "Pro",
  price: 150, duration: 45, startAt: "2026-09-28T08:15:00.000Z", endAt: "2026-09-28T09:00:00.000Z",
  firstName: "Test", surname: "Visitor", phone: "+27765322261", email: "test@example.com", location: LOCATION,
};

test("Google Calendar uses the saved actual barber, service, instants and location", () => {
  const url = new URL(googleCalendarUrl(booking));
  assert.equal(url.origin, "https://calendar.google.com");
  assert.equal(url.searchParams.get("text"), "IVORY Barbers — Fade Cut with Pro");
  assert.equal(url.searchParams.get("dates"), "20260928T081500Z/20260928T090000Z");
  assert.equal(url.searchParams.get("ctz"), "Africa/Johannesburg");
  assert.equal(url.searchParams.get("location"), LOCATION);
  assert.match(url.searchParams.get("details") || "", /45 minutes.*R150/);
});

test("Apple Calendar download is RFC 5545 with matching saved UTC dates, CRLF and octet folding", () => {
  const ics = calendarIcs(booking, now);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(unfolded, /DTSTART:20260928T081500Z\r\nDTEND:20260928T090000Z/);
  assert.match(unfolded, /SUMMARY:IVORY Barbers — Fade Cut with Pro/);
  assert.match(unfolded, /Observatory\\, Cape Town/);
  assert.match(unfolded, /45 minutes\. Menu price: R150/);
  assert.ok(!unfolded.includes(booking.email));
  assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75));
  assert.ok(!ics.replace(/\r\n/g, "").includes("\n"));
});
