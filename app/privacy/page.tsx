import Link from 'next/link';

export const metadata = { title: 'Privacy Policy | IVORY Barbers' };

export default function Privacy() {
  return <main className="legal-page">
    <Link href="/">← Back to IVORY Barbers</Link>
    <h1>PRIVACY <em>POLICY.</em></h1>
    <p className="legal-updated">Updated 25 September 2026</p>
    <p>IVORY Barbers values your privacy. Please use contact information you are comfortable sharing when testing the booking and contact features. No payment is collected through this website.</p>
    <h2>What you choose to share</h2>
    <ul>
      <li>Bookings: first name, surname, South African phone number, email, service, assigned barber, appointment start and end, and your acceptance of the Booking Terms.</li>
      <li>Contact: your name, email and message.</li>
      <li>Reviews: your name, rating and review text. Submissions are kept pending and do not appear on the public website.</li>
      <li>Preview: a photo you select and the hairstyle you request. Only upload your own photo, or a photo you have permission to process.</li>
    </ul>
    <h2>How the information is used</h2>
    <p>Bookings are saved to manage appointments and prevent overlapping times. Contact messages and reviews are saved for project review and moderation. We do not send emails or SMS messages, take payments, sell contact details or create customer accounts.</p>
    <h2>Where it is processed</h2>
    <p>The website and server routes run on Vercel. Booking details, contact messages and pending reviews are stored in Neon Postgres. AI Preview sends a resized version of your image to Cloudflare Workers AI for generation. Cloudflare processes it under its own service terms and privacy practices. We do not save uploaded or generated images to the booking database or a project photo library.</p>
    <h2>Technical data and fair use</h2>
    <p>Hosting providers may process basic request information, such as IP address and browser details, to operate and secure their services. The application uses a hashed request identifier and short-lived counters to limit repeated submissions. It does not include advertising trackers or analytics cookies.</p>
    <h2>Calendar sharing</h2>
    <p>If you choose Add to Google Calendar, appointment details are passed to Google in a calendar URL. Download for Apple Calendar creates an .ics file with your appointment details. Keep shared calendar links and files private.</p>
    <h2>Retention and removal requests</h2>
    <p>Submissions remain in the project database until the owner removes them or the database is retired. You can request access, correction or deletion through the <Link href="/#contact">contact form</Link>; include the email used and booking reference where applicable.</p>
    <h2>Your choices</h2>
    <p>Browsing the site does not require submitting personal details. Preview is optional and separate from booking. Do not submit sensitive information in messages or reviews. For booking rules, read the <Link href="/terms">Booking Terms</Link>.</p>
  </main>;
}
