import { BARBERS, getService, LOCATION, TIME_ZONE, type BarberChoice } from "./catalog";

export class BookingValidationError extends Error {}
export type BusyAppointment = { barberId: string; startAt: string | Date; endAt: string | Date };
export type AvailableSlot = { time: string; startAt: string; endAt: string };
export type SavedBooking = {
  id: string; serviceId: string; serviceName: string; barberId: string; barberName: string;
  price: number; duration: number; startAt: string; endAt: string; firstName: string;
  surname: string; phone: string; email: string; location: string;
};

export function parseShopDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BookingValidationError("Choose a valid appointment date.");
  const result = new Date(`${date}T00:00:00+02:00`);
  // Johannesburg uses UTC+02:00 throughout the year, with no daylight saving.
  if (!Number.isFinite(result.getTime()) || new Date(result.getTime() + 7_200_000).toISOString().slice(0, 10) !== date) {
    throw new BookingValidationError("Choose a valid appointment date.");
  }
  return result;
}

export function shopDate(now = new Date()) { return new Date(now.getTime() + 7_200_000).toISOString().slice(0, 10); }

export function openingMinutes(date: string) {
  const day = new Date(parseShopDate(date).getTime() + 7_200_000).getUTCDay();
  return day === 0 ? null : day === 6 ? { open: 8 * 60, close: 16 * 60 } : { open: 9 * 60, close: 18 * 60 };
}

export function validateSelection(serviceId: string, barberId: string) {
  const service = getService(serviceId);
  if (!service) throw new BookingValidationError("Choose a service from our menu.");
  if (barberId !== "first-available" && !BARBERS.some((barber) => barber.id === barberId)) throw new BookingValidationError("Choose Kylie, Pro, Steve or First Available.");
  return { service, barberId: barberId as BarberChoice };
}

export function appointmentInstants(date: string, time: string, duration: number, now = new Date()) {
  const hours = openingMinutes(date);
  if (!hours) throw new BookingValidationError("We are closed on Sundays. Please choose another day.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new BookingValidationError("Choose a valid appointment time.");
  const [hour, minute] = time.split(":").map(Number);
  const minutes = hour * 60 + minute;
  if (minute % 15 !== 0 || minutes < hours.open || minutes + duration > hours.close) throw new BookingValidationError("This service must fit within our opening hours. Please choose an available time.");
  const startAt = new Date(`${date}T${time}:00+02:00`);
  if (startAt.getTime() <= now.getTime()) throw new BookingValidationError("Please choose a future appointment time.");
  const endAt = new Date(startAt.getTime() + duration * 60_000);
  return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
}

export function availableSlots(date: string, serviceId: string, barberId: string, busy: BusyAppointment[], now = new Date()): AvailableSlot[] {
  const { service } = validateSelection(serviceId, barberId);
  const hours = openingMinutes(date);
  if (!hours) return [];
  const barbers = barberId === "first-available" ? BARBERS.map((barber) => barber.id) : [barberId];
  const result: AvailableSlot[] = [];
  for (let minute = hours.open; minute + service.duration <= hours.close; minute += 15) {
    const time = `${Math.floor(minute / 60).toString().padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
    const start = new Date(`${date}T${time}:00+02:00`).getTime();
    const end = start + service.duration * 60_000;
    if (start <= now.getTime()) continue;
    if (barbers.some((barber) => !busy.some((booking) => booking.barberId === barber && new Date(booking.startAt).getTime() < end && new Date(booking.endAt).getTime() > start))) {
      result.push({ time, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() });
    }
  }
  return result;
}

export function normalizePhone(input: string) {
  const phone = input.replace(/[\s()-]/g, "");
  if (/^0[1-8]\d{8}$/.test(phone)) return `+27${phone.slice(1)}`;
  if (/^\+27[1-8]\d{8}$/.test(phone)) return phone;
  if (/^27[1-8]\d{8}$/.test(phone)) return `+${phone}`;
  throw new BookingValidationError("Enter a South African phone number, for example 076 532 2261 or +27 76 532 2261.");
}

function calendarDate(value: string) { return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function calendarDescription(booking: SavedBooking) {
  return `${booking.serviceName} with ${booking.barberName} at IVORY Barbers.\nDuration: ${booking.duration} minutes. Menu price: R${booking.price}.\nAppointment reference: ${booking.id}.\nPlease arrive 5 minutes before your time. Phone: 076 532 2261.`;
}

export function googleCalendarUrl(booking: SavedBooking) {
  const params = new URLSearchParams({ action: "TEMPLATE", text: `IVORY Barbers — ${booking.serviceName} with ${booking.barberName}`, dates: `${calendarDate(booking.startAt)}/${calendarDate(booking.endAt)}`, ctz: TIME_ZONE, location: booking.location || LOCATION, details: calendarDescription(booking) });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
// RFC 5545 lines are limited to 75 octets, not 75 characters.
function foldIcs(line: string) {
  const lines: string[] = [];
  let current = "";
  let size = 0;
  for (const character of line) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (size + bytes > 75) { lines.push(current); current = " "; size = 1; }
    current += character; size += bytes;
  }
  lines.push(current);
  return lines.join("\r\n");
}

export function calendarIcs(booking: SavedBooking, now = new Date()) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//IVORY Barbers//Appointments//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", `UID:${booking.id}@ivory-barbers.example`, `DTSTAMP:${calendarDate(now.toISOString())}`, `DTSTART:${calendarDate(booking.startAt)}`, `DTEND:${calendarDate(booking.endAt)}`, `SUMMARY:${escapeIcs(`IVORY Barbers — ${booking.serviceName} with ${booking.barberName}`)}`, `LOCATION:${escapeIcs(booking.location || LOCATION)}`, `DESCRIPTION:${escapeIcs(calendarDescription(booking))}`, "STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT", "END:VCALENDAR", ""].map(foldIcs).join("\r\n");
}
