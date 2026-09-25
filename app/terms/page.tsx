import Link from 'next/link';

export const metadata = { title: 'Booking Terms | IVORY Barbers' };

export default function Terms() {
  return <main className="legal-page">
    <Link href="/">← Back to IVORY Barbers</Link>
    <h1>BOOKING <em>TERMS.</em></h1>
    <p className="legal-updated">Updated 25 September 2026</p>
    <p>A saved appointment tests this website’s scheduling system. It does not reserve a real barber, promise an in-person haircut or create a payment obligation. Confirm the location and availability before travelling.</p>
    <h2>Making an appointment</h2>
    <p>Choose a barber, select a service and an available slot, then provide contact details and accept these terms. An appointment is confirmed only after the server saves it. If another visitor takes the time first, choose a new slot.</p>
    <h2>Services and timing</h2>
    <p>Chiskop, Brush Cut and Fade Cut are R150 for 45 minutes, including a complimentary beard cut or trim. Trim is R100 for 30 minutes. Beard is R100 for 15 minutes. Custom Cut is R180 for 60 minutes. Prices are menu prices; this website collects no payments.</p>
    <p>All appointments are displayed in Africa/Johannesburg time (South African Standard Time, UTC+2). Hours are Monday–Friday 09:00–18:00, Saturday 08:00–16:00, closed Sunday.</p>
    <h2>Your confirmation and calendars</h2>
    <p>Keep the booking reference and download the calendar event before leaving the confirmation screen. Google Calendar and Apple-compatible .ics events use the appointment actually saved. We do not send email or SMS confirmations or reminders.</p>
    <h2>Changes and cancellations</h2>
    <p>This website does not provide automated rescheduling or cancellation. Use the <Link href="/#contact">contact form</Link> to request a change or removal, quoting your booking reference and email.</p>
    <h2>AI Preview</h2>
    <p>Preview is an optional approximation, not a guaranteed haircut result or professional recommendation. Only upload an image you have permission to use. Photos are sent to Cloudflare for generation and are not saved in the booking database.</p>
    <h2>Fair use and privacy</h2>
    <p>Use accurate test details, avoid repeated or abusive submissions, and do not upload unlawful material. See the <Link href="/privacy">Privacy Policy</Link> for the data collected and how to request removal.</p>
  </main>;
}
