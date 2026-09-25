import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Set it privately in .env.local before running this integration test.');
  process.exit(1);
}
const base = new URL(process.argv[2] || 'http://localhost:3000').origin;
const sql = neon(process.env.DATABASE_URL);
const marker = `IVORY_TEST_${randomUUID()}`;
const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
const get = (path) => fetch(`${base}${path}`);
const monday = new Date(Date.now() + 14 * 86_400_000);
while (monday.getUTCDay() !== 1) monday.setUTCDate(monday.getUTCDate() + 1);
const date = monday.toISOString().slice(0, 10);
let passed = false;

try {
  const barberIds = ['kylie', 'pro', 'steve'];
  const slotLists = await Promise.all(barberIds.map(async (barber) => {
    const response = await get(`/api/availability?service=fade&barber=${barber}&date=${date}`);
    assert.equal(response.status, 200, 'Availability must reach the migrated database');
    return (await response.json()).slots;
  }));
  const slot = slotLists[0].find((candidate) => slotLists.every((slots) => slots.some((other) => other.time === candidate.time)));
  assert.ok(slot, 'A future common free slot is needed for this isolated test');
  const body = { serviceId: 'fade', barberId: 'kylie', date, time: slot.time, firstName: marker, surname: 'Temporary', phone: '076 532 2261', email: 'integration@example.invalid', termsAccepted: true };

  const concurrent = await Promise.all([post('/api/bookings', body), post('/api/bookings', body)]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  const confirmation = await concurrent.find((response) => response.status === 201).json();
  const booking = confirmation.booking;
  assert.equal(booking.barberId, 'kylie');
  assert.equal(booking.startAt, slot.startAt);
  assert.equal(booking.endAt, slot.endAt);
  assert.equal(booking.duration, 45);
  assert.equal(booking.price, 150);
  const stored = await sql`SELECT barber_id, start_at, end_at FROM bookings WHERE id = ${booking.id}::uuid AND first_name = ${marker}`;
  assert.equal(stored.length, 1);
  assert.equal(new Date(stored[0].start_at).toISOString(), booking.startAt);
  assert.equal(new Date(stored[0].end_at).toISOString(), booking.endAt);
  console.log('PASS: two simultaneous API requests save exactly one booking; confirmation matches Neon.');

  const google = new URL(confirmation.googleCalendarUrl);
  const compact = (value) => value.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  assert.equal(google.searchParams.get('dates'), `${compact(booking.startAt)}/${compact(booking.endAt)}`);
  assert.match(google.searchParams.get('text'), /Fade Cut with Kylie/);
  assert.match(google.searchParams.get('location'), /Observatory/);
  const calendarResponse = await get(confirmation.icsUrl);
  assert.equal(calendarResponse.status, 200);
  assert.match(calendarResponse.headers.get('content-disposition'), /attachment.*\.ics/);
  const ics = (await calendarResponse.text()).replace(/\r\n /g, '');
  assert.ok(ics.includes(`DTSTART:${compact(booking.startAt)}`));
  assert.ok(ics.includes(`DTEND:${compact(booking.endAt)}`));
  assert.ok(ics.includes('Fade Cut with Kylie'));
  const wrongToken = await get(`/api/bookings/${booking.id}/calendar?token=${'0'.repeat(64)}`);
  assert.equal(wrongToken.status, 404);
  console.log('PASS: Google and Apple calendars use the saved appointment; private download rejects an invalid token.');

  const assigned = new Set(['kylie']);
  for (let index = 0; index < 2; index++) {
    const response = await post('/api/bookings', { ...body, barberId: 'first-available' });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.ok(!assigned.has(result.booking.barberId));
    assigned.add(result.booking.barberId);
  }
  assert.equal(assigned.size, 3);
  assert.equal((await post('/api/bookings', { ...body, barberId: 'first-available' })).status, 409);
  const fullSlots = await (await get(`/api/availability?service=fade&barber=first-available&date=${date}`)).json();
  assert.ok(!fullSlots.slots.some((candidate) => candidate.time === slot.time));
  console.log('PASS: First Available stores an actual free barber and disappears after all three are occupied.');

  const sunday = new Date(monday.getTime() - 86_400_000).toISOString().slice(0, 10);
  assert.equal((await post('/api/bookings', { ...body, date: sunday })).status, 400);
  assert.equal((await post('/api/bookings', { ...body, serviceId: 'custom', time: '17:15' })).status, 400);
  assert.equal((await post('/api/bookings', { ...body, date: '2020-01-06' })).status, 400);
  console.log('PASS: Sundays, past dates and appointments ending after closing are rejected server-side.');

  const contactResponse = await post('/api/contact', { name: marker, email: 'integration@example.invalid', message: 'Temporary automated contact persistence verification.' });
  const reviewResponse = await post('/api/reviews', { name: marker, rating: 4.5, review: 'Temporary automated pending review persistence verification.' });
  assert.equal(contactResponse.status, 201);
  assert.equal(reviewResponse.status, 201);
  const persisted = await sql`SELECT (SELECT count(*)::integer FROM contact_messages WHERE name = ${marker}) AS contacts, (SELECT status FROM reviews WHERE name = ${marker}) AS review_status`;
  assert.equal(persisted[0].contacts, 1);
  assert.equal(persisted[0].review_status, 'pending');
  console.log('PASS: contact and review API success means a saved row; submitted review remains pending.');
  passed = true;
} catch (error) {
  // Assert messages are controlled, but do not print arbitrary errors from Neon.
  console.error(error?.code === 'ERR_ASSERTION' ? `FAIL: ${error.message}` : 'HTTP integration failed. Confirm the app is running and the private database environment is configured.');
} finally {
  try {
    await sql.transaction([
      sql`DELETE FROM bookings WHERE first_name = ${marker}`,
      sql`DELETE FROM contact_messages WHERE name = ${marker}`,
      sql`DELETE FROM reviews WHERE name = ${marker}`,
    ]);
    console.log('Temporary HTTP integration rows removed.');
  } catch {
    console.error(`Could not clean up test rows named ${marker}. Remove that exact test name in Neon.`);
    passed = false;
  }
}
if (!passed) process.exitCode = 1;
