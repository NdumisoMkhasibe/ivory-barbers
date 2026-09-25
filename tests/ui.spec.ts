import { test, expect, type Page } from "@playwright/test";

async function databaseReady(page: Page) {
  const response = await page.request.get("/api/health");
  return (await response.json()).databaseReady === true;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("DISTINCTION");
});

test("desktop navigation, supplied images, video and legal pages work", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  for (const [name, hash] of [["Services", "services"], ["Book", "book"], ["Preview", "preview"], ["Our Story", "our-story"], ["Contact", "contact"], ["Reviews", "reviews"]]) {
    await navigation.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${hash}$`));
    await expect(page.locator(`#${hash}`)).toBeVisible();
  }
  // Bring lazy images into view before verifying the browser actually decoded them.
  for (const image of await page.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  const mediaPaths = await page.locator("video").evaluateAll((videos) => videos.flatMap((video) => [video.getAttribute("poster"), ...Array.from(video.querySelectorAll("source")).map((source) => source.getAttribute("src"))]).filter(Boolean));
  for (const media of mediaPaths) expect((await page.request.head(media!)).ok()).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/privacy/i);
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/booking terms/i);
});

test("service selection preserves barber-first flow and Sundays cannot be selected", async ({ page }) => {
  await page.getByRole("button", { name: "Book Fade Cut", exact: true }).click();
  const booking = page.locator("#book");
  await expect(booking.getByRole("heading", { name: "Find your person." })).toBeVisible();
  await expect(booking.locator(".booking-preselected")).toContainText("Fade Cut selected");
  await expect(booking.getByRole("button", { name: "Choose your service" })).toBeDisabled();
  await booking.getByRole("button", { name: /^Kylie/ }).click();
  await booking.getByRole("button", { name: "Choose your service" }).click();
  await expect(booking.getByRole("button", { name: /^Fade Cut/ })).toHaveAttribute("aria-pressed", "true");
  await booking.getByRole("button", { name: "Find a time" }).click();
  const sundays = booking.getByRole("button", { name: /^Sunday,/ });
  expect(await sundays.count()).toBeGreaterThan(0);
  for (const sunday of await sundays.all()) await expect(sunday).toBeDisabled();
  await expect(booking.getByRole("button", { name: "Your details", exact: true })).toBeDisabled();
  await booking.getByRole("button", { name: "Next month" }).click();
  await booking.locator(".booking-days button:not([disabled])").first().click();
  if (!(await databaseReady(page))) {
    await expect(booking.locator(".booking-times").getByRole("alert")).toBeVisible();
    await expect(booking.getByRole("button", { name: "Your details", exact: true })).toBeDisabled();
    await expect(booking.getByText("Your appointment is booked.")).toHaveCount(0);
  } else {
    await expect(booking.locator(".booking-slot-grid button").first()).toBeVisible();
  }
});

test("mobile navigation closes on selection and Escape, with no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Services", exact: true }).click();
  await expect(page).toHaveURL(/#services$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  for (const id of ["home", "services", "book", "preview", "our-story", "contact", "reviews"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("contact only confirms after a successful server save", async ({ page }) => {
  const ready = await databaseReady(page);
  const form = page.locator(".contact-form");
  await form.getByLabel("Your name").fill("Assessment Test");
  await form.getByLabel("Email address").fill("assessment@example.com");
  await form.getByLabel("Your message").fill("Automated assessment test of the working contact form.");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/contact") && response.request().method() === "POST");
  await form.getByRole("button", { name: "Send message" }).click();
  const response = await responsePromise;
  if (ready) {
    expect(response.ok()).toBe(true);
    await expect(form.getByRole("status")).toContainText("Your message has been saved");
  } else {
    expect(response.ok()).toBe(false);
    await expect(form.getByRole("status")).not.toBeEmpty();
    await expect(form.getByRole("status")).not.toContainText("Your message has been saved");
    await expect(form.getByLabel("Your message")).toHaveValue("Automated assessment test of the working contact form.");
  }
});

test("review modal closes accessibly and pending submissions never become public", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Leave a Review" });
  const dialog = page.getByRole("dialog");
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "Close review dialog" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  const ready = await databaseReady(page);
  await dialog.getByLabel("Your name").fill("Private Assessment Review");
  await dialog.getByLabel("Your rating").selectOption("4.5");
  await dialog.getByLabel("Your review").fill("A private test review that must remain pending and must not appear publicly.");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/reviews") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Submit review" }).click();
  const response = await responsePromise;
  if (ready) {
    expect(response.ok()).toBe(true);
    await expect(dialog.getByRole("status")).toContainText("saved for moderation");
  } else {
    expect(response.ok()).toBe(false);
    await expect(dialog.getByRole("status")).not.toBeEmpty();
    await expect(dialog.getByRole("status")).not.toContainText("saved for moderation");
  }
  await dialog.getByRole("button", { name: "Close review dialog" }).click();
  await expect(page.locator(".review-card")).toHaveCount(10);
  await expect(page.locator("#reviews")).not.toContainText("Private Assessment Review");
});

test("real saved booking, assigned barber, matching calendars and rejected invalid bookings", async ({ page }) => {
  test.skip(!(await databaseReady(page)), "Neon is not configured and migrated; no booking success is simulated.");
  await page.getByRole("button", { name: "Book Fade Cut", exact: true }).click();
  const booking = page.locator("#book");
  await booking.getByRole("button", { name: /^First Available/ }).click();
  await booking.getByRole("button", { name: "Choose your service" }).click();
  await booking.getByRole("button", { name: "Find a time" }).click();
  await booking.getByRole("button", { name: "Next month" }).click();
  await booking.locator(".booking-days button:not([disabled])").first().click();
  await booking.locator(".booking-slot-grid button").first().click();
  await booking.getByRole("button", { name: "Your details", exact: true }).click();
  await booking.getByLabel("First name").fill("Assessment");
  await booking.getByLabel("Surname").fill("Test");
  await booking.getByLabel("South African phone").fill("076 532 2261");
  await booking.getByLabel("Email address").fill("assessment@example.com");
  await booking.getByRole("button", { name: "Review appointment" }).click();
  await booking.getByRole("checkbox").check();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/bookings") && response.request().method() === "POST");
  await booking.getByRole("button", { name: "Confirm booking" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const result = await response.json();
  const saved = result.booking;
  expect(["kylie", "pro", "steve"]).toContain(saved.barberId);
  await expect(booking.getByRole("heading", { name: "Your appointment is booked." })).toBeVisible();
  await expect(booking.locator(".booking-confirmation-details")).toContainText(saved.barberName);
  const google = new URL(await booking.getByRole("link", { name: "Add to Google Calendar" }).getAttribute("href") as string);
  const calendarInstant = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  expect(google.searchParams.get("dates")).toBe(`${calendarInstant(saved.startAt)}/${calendarInstant(saved.endAt)}`);
  expect(google.searchParams.get("text")).toContain(saved.serviceName);
  expect(google.searchParams.get("text")).toContain(saved.barberName);
  expect(google.searchParams.get("location")).toContain("Observatory");
  const ics = await page.request.get(result.icsUrl);
  expect(ics.ok()).toBe(true);
  const icsText = (await ics.text()).replace(/\r\n /g, "");
  expect(icsText).toContain(`DTSTART:${calendarInstant(saved.startAt)}`);
  expect(icsText).toContain(`DTEND:${calendarInstant(saved.endAt)}`);
  expect(icsText).toContain(saved.barberName);
  expect(icsText).toContain(saved.serviceName);
  const request = { ...response.request().postDataJSON(), barberId: saved.barberId };
  expect((await page.request.post("/api/bookings", { data: request })).status()).toBe(409);
  const nextSunday = new Date(`${request.date}T12:00:00+02:00`);
  nextSunday.setUTCDate(nextSunday.getUTCDate() + (7 - nextSunday.getUTCDay()) % 7);
  expect((await page.request.post("/api/bookings", { data: { ...request, date: nextSunday.toISOString().slice(0, 10) } })).status()).toBe(400);
  expect((await page.request.post("/api/bookings", { data: { ...request, time: "17:45", serviceId: "custom" } })).status()).toBe(400);
});
