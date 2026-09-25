-- Run once using `npm run db:migrate` or paste into the Neon SQL Editor.
-- Safe to reapply. No personal information is seeded.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL CHECK (service_id IN ('chiskop', 'brush', 'fade', 'trim', 'beard', 'custom')),
  service_name text NOT NULL,
  barber_id text NOT NULL CHECK (barber_id IN ('kylie', 'pro', 'steve')),
  barber_name text NOT NULL,
  price_zar integer NOT NULL CHECK (price_zar > 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (15, 30, 45, 60)),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  first_name text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 80),
  surname text NOT NULL CHECK (length(surname) BETWEEN 1 AND 80),
  phone text NOT NULL CHECK (phone ~ '^\+27[1-8][0-9]{8}$'),
  email text NOT NULL CHECK (length(email) <= 254),
  location text NOT NULL,
  calendar_token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_duration CHECK (end_at = start_at + duration_minutes * interval '1 minute'),
  -- [) permits one appointment to begin exactly as the previous one ends.
  -- PostgreSQL enforces this even for simultaneous requests on different servers.
  CONSTRAINT no_barber_overlap EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
);

CREATE INDEX IF NOT EXISTS bookings_start_at_idx ON bookings(start_at);

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (length(email) <= 254),
  subject text NOT NULL DEFAULT 'Website enquiry' CHECK (length(subject) <= 160),
  message text NOT NULL CHECK (length(message) BETWEEN 10 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  rating numeric(2,1) NOT NULL CHECK (rating BETWEEN 0.5 AND 5 AND mod(rating * 2, 1) = 0),
  review text NOT NULL CHECK (length(review) BETWEEN 10 AND 1500),
  status text NOT NULL DEFAULT 'pending' CHECK (status = 'pending'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0)
);
