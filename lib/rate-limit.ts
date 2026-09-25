import { createHash } from "node:crypto";
import { database } from "./db";

/** Hash the IP before persistence; a raw IP is never written to the database. */
export function requestKey(request: Request, scope: string) {
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "local";
  return `${scope}:${createHash("sha256").update(`${scope}:${ip}`).digest("hex")}`;
}

/** Atomic fixed-window counter, shared by all Vercel instances. Fails closed. */
export async function consumeLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }> {
  const sql = database();
  const rows = await sql`
    INSERT INTO rate_limits (key, window_start, request_count)
    VALUES (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    ON CONFLICT (key) DO UPDATE SET
      request_count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.request_count + 1 ELSE 1 END,
      window_start = excluded.window_start
    RETURNING request_count, greatest(1, ceil(extract(epoch from window_start + ${windowSeconds} * interval '1 second' - now())))::integer AS retry_after
  `;
  return { allowed: Number(rows[0].request_count) <= limit, retryAfter: Number(rows[0].retry_after) };
}
