import { createHash, randomBytes } from "node:crypto";
import { appointmentInstants, BookingValidationError, googleCalendarUrl, normalizePhone, validateSelection, type SavedBooking } from "@/lib/booking";
import { BARBERS, LOCATION } from "@/lib/catalog";
import { database } from "@/lib/db";
import { emailField, errorResponse, field, HttpError, json, readJson } from "@/lib/http";
import { consumeLimit, requestKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const { service, barberId } = validateSelection(field(body.serviceId, "a service", 1, 20), field(body.barberId, "a barber", 1, 30));
    const date = field(body.date, "an appointment date", 10, 10);
    const time = field(body.time, "an appointment time", 5, 5);
    const { startAt, endAt } = appointmentInstants(date, time, service.duration);
    const firstName = field(body.firstName, "your first name", 1, 80);
    const surname = field(body.surname, "your surname", 1, 80);
    const email = emailField(body.email);
    const phone = normalizePhone(field(body.phone, "your South African phone number", 10, 24));
    if (body.termsAccepted !== true) throw new HttpError(400, "Please read and accept the Booking Terms before booking.");
    if (body.website) throw new HttpError(400, "Unable to accept this submission.");
    const limit = await consumeLimit(requestKey(request, "booking"), 20, 3600);
    if (!limit.allowed) throw new HttpError(429, "Too many booking attempts. Please try again in an hour.");

    const sql = database();
    const candidates = barberId === "first-available" ? BARBERS : BARBERS.filter((barber) => barber.id === barberId);
    const calendarToken = randomBytes(32).toString("hex");
    const calendarTokenHash = createHash("sha256").update(calendarToken).digest("hex");
    for (const barber of candidates) {
      try {
        // The availability check improves the response; the PostgreSQL exclusion
        // constraint is the final authority and prevents concurrent double bookings.
        const rows = await sql`
          INSERT INTO bookings (service_id, service_name, barber_id, barber_name, price_zar, duration_minutes,
            start_at, end_at, first_name, surname, phone, email, location, calendar_token_hash)
          SELECT ${service.id}, ${service.name}, ${barber.id}, ${barber.name}, ${service.price}, ${service.duration},
            ${startAt}::timestamptz, ${endAt}::timestamptz, ${firstName}, ${surname}, ${phone}, ${email}, ${LOCATION}, ${calendarTokenHash}
          WHERE NOT EXISTS (
            SELECT 1 FROM bookings WHERE barber_id = ${barber.id}
            AND start_at < ${endAt}::timestamptz AND end_at > ${startAt}::timestamptz
          ) RETURNING *
        `;
        if (!rows.length) continue;
        const row = rows[0];
        const booking: SavedBooking = {
          id: row.id, serviceId: row.service_id, serviceName: row.service_name, barberId: row.barber_id,
          barberName: row.barber_name, price: Number(row.price_zar), duration: Number(row.duration_minutes),
          startAt: new Date(row.start_at).toISOString(), endAt: new Date(row.end_at).toISOString(),
          firstName: row.first_name, surname: row.surname, phone: row.phone, email: row.email, location: row.location,
        };
        return json({ booking, googleCalendarUrl: googleCalendarUrl(booking), icsUrl: `/api/bookings/${booking.id}/calendar?token=${calendarToken}` }, 201);
      } catch (error) {
        if ((error as { code?: string }).code === "23P01") continue;
        throw error;
      }
    }
    throw new HttpError(409, "That time was just taken. Please choose another available time; your details are still here.");
  } catch (error) {
    return errorResponse(error instanceof BookingValidationError ? new HttpError(400, error.message) : error);
  }
}
