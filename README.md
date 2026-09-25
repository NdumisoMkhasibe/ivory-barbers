# IVORY Barbers

IVORY Barbers is a responsive Next.js website for a Cape Town barber shop. It includes a service menu, barber-first appointment booking, calendar integration, contact messages, moderated reviews, and an optional AI hairstyle preview.

Live site: [ivory-barbers.vercel.app](https://ivory-barbers.vercel.app/)

## Features

- Responsive desktop and mobile layout
- Service menu with booking shortcuts
- Barber-first booking flow with availability checks
- South African time zone and business-hour validation
- First Available barber assignment
- Google Calendar add link
- Apple Calendar `.ics` event link
- Contact form and pending reviews
- Optional Cloudflare Workers AI hairstyle preview
- Privacy policy and booking terms pages
- Database health endpoint at `/api/health`

## Requirements

- Node.js 20 or newer
- npm
- Neon Postgres for bookings, contact messages, and reviews
- Cloudflare Workers AI credentials for the Preview feature

## Local setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and fill in the values privately:

```env
DATABASE_URL=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

Apply the database schema:

```bash
npm run db:migrate
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev            # Start the development server
npm run build          # Create a production build
npm run start          # Start the production server
npm run typecheck      # Run TypeScript validation
npm test               # Run unit and API tests
npm run test:e2e       # Run Playwright browser tests
npm run db:migrate     # Apply the database schema
npm run media:optimize # Optimize source media assets
```

The Playwright configuration starts a clean development server automatically when `PLAYWRIGHT_BASE_URL` is not set.

## API routes

| Route | Purpose |
| --- | --- |
| `/api/health` | Reports database and Preview configuration status |
| `/api/availability` | Returns available appointment slots |
| `/api/bookings` | Creates and validates bookings |
| `/api/bookings/[id]/calendar` | Serves the Apple Calendar event |
| `/api/contact` | Saves contact messages |
| `/api/reviews` | Saves pending reviews |
| `/api/preview` | Generates an AI hairstyle preview |

## Deployment

The project is configured for Vercel. Set the environment variables in the Vercel project before deploying, then run a production build locally to verify the application:

```bash
npm run typecheck
npm test
npm run build
```

Never commit `.env.local` or expose database and API tokens in source control.
