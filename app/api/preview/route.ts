import sharp from "sharp";
import { consumeLimit, requestKey } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_UPLOAD = 1024 * 1024;
const MAX_RESPONSE = 3 * 1024 * 1024;
const MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
const STYLE_PROMPTS: Record<string, string> = {
  chiskop: "Give the person a Chiskop: a clean, very close shaved head with no long hair. If a beard is already present, neatly trim and shape that existing beard; if absent, do not add facial hair.",
  brush: "Give the person a brush cut: neat, very short, even hair all over, respecting their natural hair texture and hairline. If a beard is already present, neatly trim and shape that existing beard; if absent, do not add facial hair.",
  fade: "Give the person a precision fade haircut: smoothly blend closely cut sides and back into a short textured top, respecting their natural hair texture and hairline. If a beard is already present, neatly trim and shape that existing beard; if absent, do not add facial hair.",
  trim: "Give the person a subtle professional trim: retain the current hairstyle and general length, remove excess hair, neaten the existing hairline and, only if a beard is already present, neaten its outline. Do not add facial hair.",
  beard: "Neatly cut, shape and define the person's existing beard and its edges. Preserve the hairstyle completely. If the person has no visible beard, keep the face clean shaven; do not invent a beard.",
};

function failure(error: string, code: string, status: number, retryAfter?: number) {
  return Response.json({ error, code }, { status, headers: {
    "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
  } });
}

async function limitedResponse(response: Response): Promise<Uint8Array> {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_RESPONSE || !response.body) throw new Error("INVALID_MODEL_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > MAX_RESPONSE) { await reader.cancel(); throw new Error("INVALID_MODEL_RESPONSE"); }
    chunks.push(chunk.value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function POST(request: Request) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token || !process.env.DATABASE_URL) {
    return failure("AI Preview is not connected yet. You can still explore the styles and book a look.", "NOT_CONFIGURED", 503);
  }
  // This is a same-origin form; rejecting a foreign origin prevents drive-by quota consumption.
  if (!isSameOrigin(request)) return failure("Please use Preview on the IVORY Barbers website.", "INVALID_ORIGIN", 403);
  if (Number(request.headers.get("content-length") || 0) > MAX_UPLOAD + 16384) {
    return failure("The prepared image must be smaller than 1 MB. Please choose another photo.", "IMAGE_TOO_LARGE", 413);
  }
  let form: FormData;
  try { form = await request.formData(); }
  catch { return failure("Choose a JPG, PNG or WebP photo and try again.", "INVALID_IMAGE", 400); }
  const photo = form.get("photo");
  const service = form.get("service");
  if (typeof service !== "string" || !Object.hasOwn(STYLE_PROMPTS, service)) return failure("Choose one of the five available preview styles.", "INVALID_SERVICE", 400);
  if (form.get("consent") !== "true") return failure("Please agree to temporary photo processing before generating a preview.", "CONSENT_REQUIRED", 400);
  if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_UPLOAD || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
    return failure("Choose a valid JPG, PNG or WebP photo. Prepared images must be under 1 MB.", "INVALID_IMAGE", 400);
  }
  let input: Buffer;
  try {
    const source = Buffer.from(await photo.arrayBuffer());
    const metadata = await sharp(source, { limitInputPixels: 500 * 500, failOn: "error" }).metadata();
    const acceptedFormats: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    const expectedMime = acceptedFormats[metadata.format || ""];
    if (!metadata.width || !metadata.height || metadata.width > 500 || metadata.height > 500 || !expectedMime || expectedMime !== photo.type || (metadata.pages || 1) > 1) {
      return failure("Use a single still image no larger than 500 × 500 pixels. Choose the photo again so we can resize it.", "INVALID_DIMENSIONS", 400);
    }
    // Decode fully, remove metadata and normalize the actual uploaded bytes server-side too.
    input = await sharp(source, { limitInputPixels: 500 * 500, failOn: "error" }).rotate().jpeg({ quality: 90 }).toBuffer();
  } catch {
    return failure("That image could not be read safely. Please choose another JPG, PNG or WebP photo.", "INVALID_IMAGE", 400);
  }

  try {
    const visitor = await consumeLimit(requestKey(request, "preview"), 2, 86400);
    if (!visitor.allowed) return failure("Your connection has used its two preview attempts today. Please return after 02:00 South African time.", "VISITOR_QUOTA", 429, visitor.retryAfter);
    const global = await consumeLimit("preview-global", 5, 86400);
    if (!global.allowed) return failure("Today's free previews have all been used. Preview resets at 02:00 South African time; booking is still available.", "DAILY_QUOTA", 429, global.retryAfter);
  } catch {
    // Fail closed: never bypass persistent quota protection if Neon is unavailable.
    return failure("Preview is temporarily unavailable while its daily allowance cannot be checked. Please try again later.", "QUOTA_UNAVAILABLE", 503);
  }

  try {
    const upstreamForm = new FormData();
    upstreamForm.append("input_image_0", new Blob([new Uint8Array(input)], { type: "image/jpeg" }), "portrait.jpg");
    upstreamForm.append("prompt", `Edit only the grooming of the person in input image 0. Preserve their identity, facial proportions, face, skin tone, age, expression, glasses if present, clothing, background, lighting and photographic realism as closely as possible. ${STYLE_PROMPTS[service]} This is a realistic barber consultation portrait. Do not add text, branding, accessories, extra people, or a before-and-after collage. Return a single edited photograph.`);
    upstreamForm.append("width", "512");
    upstreamForm.append("height", "512");
    // fetch generates the required multipart boundary. Never set a bare Content-Type here.
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run/${MODEL}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: upstreamForm,
      signal: AbortSignal.timeout(50000), cache: "no-store",
    });
    const bytes = await limitedResponse(response);
    let payload: { success?: boolean; result?: { image?: string }; image?: string; errors?: { code?: number }[] } | null = null;
    if (response.headers.get("content-type")?.includes("json")) {
      try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* handled as invalid output */ }
    }
    const codes = payload?.errors?.map((item) => Number(item.code)) || [];
    if (!response.ok || payload?.success === false) {
      if (codes.includes(3036)) return failure("Cloudflare's daily free AI allowance has been used. Please return after 02:00 South African time.", "DAILY_QUOTA", 429, 86400 - Math.floor(Date.now() / 1000) % 86400);
      if (response.status === 429 || codes.includes(3040)) return failure("The AI model is busy right now. Please try again later; your photo has not been saved.", "MODEL_BUSY", 429, 60);
      if (response.status === 401 || response.status === 403 || response.status === 404 || codes.includes(5007)) return failure("This AI model is currently unavailable. You can still browse and book your preferred style.", "MODEL_UNAVAILABLE", 503);
      return failure("The AI model could not create this preview. Please try a clear, well-lit portrait later.", "MODEL_ERROR", 502);
    }
    let generated: Buffer;
    if (response.headers.get("content-type")?.startsWith("image/")) generated = Buffer.from(bytes);
    else {
      const encoded = payload?.result?.image || payload?.image;
      if (!encoded || encoded.length > MAX_RESPONSE) throw new Error("INVALID_MODEL_RESPONSE");
      generated = Buffer.from(encoded.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
    }
    const output = await sharp(generated, { limitInputPixels: 1024 * 1024, failOn: "error" })
      .resize(512, 512, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 87 }).toBuffer();
    if (!output.length || output.length > MAX_UPLOAD) throw new Error("INVALID_MODEL_RESPONSE");
    return new Response(new Uint8Array(output), { headers: {
      "Content-Type": "image/jpeg", "Content-Length": String(output.length),
      "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="ivory-${service}-ai-preview.jpg"`,
    } });
  } catch (problem) {
    // Do not log request bodies, photos, provider responses or credentials.
    if (problem instanceof Error && ["TimeoutError", "AbortError"].includes(problem.name)) {
      return failure("The AI model took too long. Please try again later; your photo has not been saved.", "MODEL_TIMEOUT", 504);
    }
    return failure("Preview could not connect to the AI model or received an unreadable image. Please try again later.", "MODEL_UNAVAILABLE", 502);
  }
}
