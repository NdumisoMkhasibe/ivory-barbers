import { database } from "@/lib/db";
import { errorResponse, field, HttpError, json, readJson } from "@/lib/http";
import { consumeLimit, requestKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const name = field(body.name, "your name", 1, 100);
    const review = field(body.review, "your review", 10, 1500);
    const rating = body.rating;
    if (typeof rating !== "number" || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2)) throw new HttpError(400, "Choose a rating between 0.5 and 5 stars.");
    if (body.website) throw new HttpError(400, "Unable to accept this submission.");
    const limit = await consumeLimit(requestKey(request, "review"), 5, 3600);
    if (!limit.allowed) throw new HttpError(429, "You have submitted several reviews recently. Please try again in an hour.");
    const sql = database();
    const rows = await sql`INSERT INTO reviews (name, rating, review, status) VALUES (${name}, ${rating}, ${review}, 'pending') RETURNING id`;
    if (!rows[0]?.id) throw new Error("Review not saved");
    return json({ success: true, message: "Thank you. Your review has been saved as pending and will not appear publicly." }, 201);
  } catch (error) { return errorResponse(error); }
}
