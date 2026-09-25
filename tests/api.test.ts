import assert from "node:assert/strict";
import { after, test } from "node:test";
import { POST as book } from "../app/api/bookings/route";
import { POST as contact } from "../app/api/contact/route";
import { POST as review } from "../app/api/reviews/route";

const originalDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
after(() => { if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl; });

const nextMonday = new Date(Date.now() + 8 * 86_400_000);
while (nextMonday.getUTCDay() !== 1) nextMonday.setUTCDate(nextMonday.getUTCDate() + 1);
const date = nextMonday.toISOString().slice(0, 10);
const appointment = { serviceId: "fade", barberId: "first-available", date, time: "10:00", firstName: "Demo", surname: "Visitor", phone: "076 532 2261", email: "demo@example.com", termsAccepted: true };
const request = (path: string, body: unknown, origin = "https://ivory.example") => new Request(`https://ivory.example${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });

test("booking never returns a successful appointment when the database is missing", async () => {
  const response = await book(request("/api/bookings", appointment));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.ok(body.error);
  assert.equal(body.booking, undefined);
  assert.equal(body.googleCalendarUrl, undefined);
});

test("server rejects missing consent and invalid contact details before persistence", async () => {
  assert.equal((await book(request("/api/bookings", { ...appointment, termsAccepted: false }))).status, 400);
  assert.equal((await book(request("/api/bookings", { ...appointment, phone: "1234567890" }))).status, 400);
  assert.equal((await book(request("/api/bookings", { ...appointment, email: "invalid" }))).status, 400);
});

test("server ignores forged duration and rejects a service that overruns closing", async () => {
  const response = await book(request("/api/bookings", { ...appointment, serviceId: "custom", time: "17:45", duration: 15 }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /opening hours/);
});

test("cross-origin writes are rejected", async () => {
  assert.equal((await book(request("/api/bookings", appointment, "https://another.example"))).status, 403);
});

test("contact messages and reviews never claim saving without a database", async () => {
  const contactResponse = await contact(request("/api/contact", { name: "Demo", email: "demo@example.com", message: "Please remove my demonstration booking." }));
  const reviewResponse = await review(request("/api/reviews", { name: "Demo", rating: 4.5, review: "A clear and useful demonstration website." }));
  assert.equal(contactResponse.status, 503);
  assert.equal(reviewResponse.status, 503);
  assert.equal((await contactResponse.json()).success, undefined);
  assert.equal((await reviewResponse.json()).success, undefined);
});

test("review ratings must be a real number on the half-star scale", async () => {
  for (const rating of [0, 5.5, 4.1, "5"]) {
    assert.equal((await review(request("/api/reviews", { name: "Demo", rating, review: "A clear demonstration website." }))).status, 400);
  }
});
