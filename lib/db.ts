import { neon } from "@neondatabase/serverless";
import { HttpError } from "./http";

export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new HttpError(503, "Our online forms are temporarily unavailable. Nothing has been saved. Please try again shortly.");
  return neon(connectionString);
}
