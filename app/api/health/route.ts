import { database } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = {
    database: Boolean(process.env.DATABASE_URL),
    preview: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
  };
  let databaseReady = false;
  if (configured.database) {
    try {
      const sql = database();
      const rows = await sql`SELECT to_regclass('public.bookings') IS NOT NULL AND to_regclass('public.contact_messages') IS NOT NULL AND to_regclass('public.reviews') IS NOT NULL AND to_regclass('public.rate_limits') IS NOT NULL AS ready`;
      databaseReady = rows[0]?.ready === true;
    } catch { /* Only booleans are exposed; no errors or secret values. */ }
  }
  return json({ configured, databaseReady }, databaseReady ? 200 : 503);
}
