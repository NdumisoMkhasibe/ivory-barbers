import { availableSlots, BookingValidationError, parseShopDate, validateSelection } from "@/lib/booking";
import { TIME_ZONE } from "@/lib/catalog";
import { database } from "@/lib/db";
import { errorResponse, HttpError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const date = params.get("date") || "";
    const service = params.get("service") || "";
    const barber = params.get("barber") || "";
    validateSelection(service, barber);
    const start = parseShopDate(date);
    const end = new Date(start.getTime() + 86_400_000);
    const sql = database();
    const rows = await sql`
      SELECT barber_id, start_at, end_at FROM bookings
      WHERE start_at < ${end.toISOString()}::timestamptz AND end_at > ${start.toISOString()}::timestamptz
    `;
    const busy = rows.map((row) => ({ barberId: row.barber_id as string, startAt: row.start_at as string, endAt: row.end_at as string }));
    return json({ slots: availableSlots(date, service, barber, busy), date, timeZone: TIME_ZONE });
  } catch (error) {
    return errorResponse(error instanceof BookingValidationError ? new HttpError(400, error.message) : error);
  }
}
