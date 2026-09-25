import { database } from "@/lib/db";
import { emailField, errorResponse, field, HttpError, json, readJson } from "@/lib/http";
import { consumeLimit, requestKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const name = field(body.name, "your name", 1, 120);
    const email = emailField(body.email);
    const subject = body.subject ? field(body.subject, "a subject", 1, 160) : "Website enquiry";
    const message = field(body.message, "your message", 10, 5000);
    if (body.website) throw new HttpError(400, "Unable to accept this submission.");
    const limit = await consumeLimit(requestKey(request, "contact"), 5, 3600);
    if (!limit.allowed) throw new HttpError(429, "You have sent several messages recently. Please try again in an hour.");
    const sql = database();
    const rows = await sql`INSERT INTO contact_messages (name, email, subject, message) VALUES (${name}, ${email}, ${subject}, ${message}) RETURNING id`;
    if (!rows[0]?.id) throw new Error("Contact message not saved");
    return json({ success: true, message: "Your message has been saved. No email has been sent." }, 201);
  } catch (error) { return errorResponse(error); }
}
