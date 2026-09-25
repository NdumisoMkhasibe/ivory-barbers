import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Database/provider errors may contain connection information: never return or log them.
  return json({ error: "This service is temporarily unavailable. We could not confirm your submission. Please try again shortly." }, 503);
}

/**
 * Validate browser writes against the public host. `request.url` can contain an
 * internal bind address (for example 0.0.0.0 in development), while Host and
 * X-Forwarded-* retain the address the visitor actually used.
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let supplied: URL;
  try { supplied = new URL(origin); }
  catch { return false; }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto ? `${forwardedProto}:` : new URL(request.url).protocol;
  return supplied.host === host && supplied.protocol === protocol;
}

export function requireSameOrigin(request: Request) {
  if (!isSameOrigin(request)) throw new HttpError(403, "Please submit this form from the IVORY Barbers website.");
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  requireSameOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "Please send a valid form submission.");
  if (Number(request.headers.get("content-length") || 0) > 16_384) throw new HttpError(413, "Your submission is too long.");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 16_384) throw new HttpError(413, "Your submission is too long.");
  try {
    const value = JSON.parse(body);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, "Please check your form and try again."); }
}

export function field(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new HttpError(400, `Please enter ${label}.`);
  const result = value.trim();
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(result)) {
    throw new HttpError(400, `Please enter ${label} using ${min}–${max} characters.`);
  }
  return result;
}

export function emailField(value: unknown) {
  const email = field(value, "a valid email address", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  return email;
}
