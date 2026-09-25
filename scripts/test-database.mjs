import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Add it privately to .env.local and apply the migration first.');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const bookingIds = [randomUUID(), randomUUID(), randomUUID()];
const contactId = randomUUID();
const reviewId = randomUUID();
let passed = false;
try {
  // Deliberately distant test dates cannot consume a normal bookable slot.
  const testDay = `2099-${String(1 + Math.floor(Math.random() * 11)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 27)).padStart(2, '0')}`;
  const start = `${testDay}T07:00:00Z`;
  const end = `${testDay}T07:45:00Z`;
  const insert = (id, barber = 'kylie') => sql`
    INSERT INTO bookings (id, service_id, service_name, barber_id, barber_name, price_zar, duration_minutes,
      start_at, end_at, first_name, surname, phone, email, location, calendar_token_hash)
    VALUES (${id}::uuid, 'fade', 'Fade Cut', ${barber}, ${barber === 'kylie' ? 'Kylie' : 'Pro'}, 150, 45,
      ${start}::timestamptz, ${end}::timestamptz, '__IVORY_TEST__', 'Temporary', '+27765322261',
      'integration@example.invalid', 'Observatory, Cape Town', 'test-only-no-public-token')
    RETURNING id, barber_id, start_at, end_at`;
  const results = await Promise.allSettled([insert(bookingIds[0]), insert(bookingIds[1])]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1, 'Exactly one concurrent booking must save');
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.code, '23P01', 'Concurrent overlap must be rejected by the PostgreSQL exclusion constraint');
  await insert(bookingIds[2], 'pro');
  console.log('PASS: simultaneous overlap rejected; another barber accepts the same time.');

  await sql`INSERT INTO contact_messages(id, name, email, message) VALUES (${contactId}::uuid, '__IVORY_TEST__', 'integration@example.invalid', 'Temporary integration test contact message.')`;
  await sql`INSERT INTO reviews(id, name, rating, review) VALUES (${reviewId}::uuid, '__IVORY_TEST__', 4.5, 'Temporary integration test review.')`;
  const saved = await sql`SELECT (SELECT count(*)::integer FROM contact_messages WHERE id = ${contactId}::uuid) AS contacts, (SELECT status FROM reviews WHERE id = ${reviewId}::uuid) AS review_status`;
  assert.equal(saved[0].contacts, 1);
  assert.equal(saved[0].review_status, 'pending');
  console.log('PASS: contact persists and reviews default to pending.');
  passed = true;
} catch {
  console.error('Database integration test failed. No private connection details were printed. Check that db/schema.sql has been applied.');
} finally {
  try {
    await sql.transaction([
      sql`DELETE FROM bookings WHERE id IN (${bookingIds[0]}::uuid, ${bookingIds[1]}::uuid, ${bookingIds[2]}::uuid)`,
      sql`DELETE FROM contact_messages WHERE id = ${contactId}::uuid`,
      sql`DELETE FROM reviews WHERE id = ${reviewId}::uuid`,
    ]);
    console.log('Temporary integration rows removed.');
  } catch {
    console.error('Could not remove temporary rows. In Neon, remove only rows named __IVORY_TEST__.');
    passed = false;
  }
}
if (!passed) process.exitCode = 1;
