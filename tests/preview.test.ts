import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { POST } from "../app/api/preview/route";

const names = ["DATABASE_URL", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] as const;
const original = new Map(names.map((name) => [name, process.env[name]]));

before(() => {
  // Validation tests never contact the database or Cloudflare.
  process.env.DATABASE_URL = "postgresql://test:test@invalid.example/test";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
});
after(() => {
  for (const name of names) {
    if (original.get(name) === undefined) delete process.env[name];
    else process.env[name] = original.get(name);
  }
});

function request(form: FormData, headers?: HeadersInit) {
  return new Request("http://localhost:3000/api/preview", { method: "POST", body: form, headers });
}

function form(image?: Uint8Array, mime = "image/jpeg") {
  const data = new FormData();
  data.append("service", "fade");
  data.append("consent", "true");
  if (image) data.append("photo", new Blob([new Uint8Array(image)], { type: mime }), "test.jpg");
  return data;
}

test("Preview cannot claim success without a configured provider", async () => {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_API_TOKEN;
  try {
    const response = await POST(request(form()));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "NOT_CONFIGURED");
  } finally { process.env.CLOUDFLARE_API_TOKEN = token; }
});

test("Preview rejects cross-origin requests before consuming allowance", async () => {
  const response = await POST(request(form(), { origin: "https://another-site.example" }));
  assert.equal(response.status, 403);
});

test("Custom Cut is unavailable for AI Preview", async () => {
  const data = form();
  data.set("service", "custom");
  const response = await POST(request(data));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_SERVICE");
});

test("AI processing requires explicit consent", async () => {
  const data = form();
  data.delete("consent");
  const response = await POST(request(data));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "CONSENT_REQUIRED");
});

test("Both input image dimensions must be at most 500", async () => {
  for (const [width, height] of [[501, 100], [100, 512]]) {
    const image = await sharp({ create: { width, height, channels: 3, background: "#888" } }).jpeg().toBuffer();
    const response = await POST(request(form(image)));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_DIMENSIONS");
  }
});

test("Image bytes must match the declared MIME type", async () => {
  const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#888" } }).png().toBuffer();
  const response = await POST(request(form(png, "image/jpeg")));
  assert.equal(response.status, 400);
});

test("Malformed image bytes do not reach the AI provider", async () => {
  const response = await POST(request(form(new TextEncoder().encode("not a real image"))));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_IMAGE");
});

test("Oversized requests fail before multipart decoding", async () => {
  const response = await POST(request(form(), { "content-length": String(2 * 1024 * 1024) }));
  assert.equal(response.status, 413);
});
