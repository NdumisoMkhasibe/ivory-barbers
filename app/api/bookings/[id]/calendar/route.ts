import { createHash } from "node:crypto";
import { calendarIcs, type SavedBooking } from "@/lib/booking";
import { database } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get("token") || "";
    if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id) || !/^[a-f\d]{64}$/.test(token)) throw new HttpError(404, "This calendar download could not be found. Please use the link on your booking confirmation.");
    const hash = createHash("sha256").update(token).digest("hex");
    const sql = database();
    const rows = await sql`SELECT id, service_id, service_name, barber_id, barber_name, price_zar, duration_minutes, start_at, end_at, location FROM bookings WHERE id = ${id}::uuid AND calendar_token_hash = ${hash} LIMIT 1`;
    if (!rows.length) throw new HttpError(404, "This calendar download could not be found. Please use the link on your booking confirmation.");
    const row = rows[0];
    const booking: SavedBooking = {
      id: row.id, serviceId: row.service_id, serviceName: row.service_name, barberId: row.barber_id,
      barberName: row.barber_name, price: Number(row.price_zar), duration: Number(row.duration_minutes),
      startAt: new Date(row.start_at).toISOString(), endAt: new Date(row.end_at).toISOString(), location: row.location,
      firstName: "", surname: "", phone: "", email: "",
    };
    return new Response(calendarIcs(booking), { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="ivory-barbers-${booking.id}.ics"`,
      "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return errorResponse(error); }
}
