const assert = require("node:assert/strict");
const { test } = require("node:test");

// Isolated configuration: never access production data or send notifications.
Object.assign(process.env, {
  NODE_ENV: "test", SUPABASE_URL: "https://example.supabase.co", SUPABASE_KEY: "test",
  ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD_HASH: require("bcrypt").hashSync("test-password", 4),
  JWT_SECRET_KEY: "isolated-test-secret-with-at-least-32-characters",
  APP_ORIGIN: "https://example.com", SERVE_PAGES: "true",
  GMAIL_USER: "", GMAIL_APP_PASSWORD: "", CONTACT_TO_EMAIL: "",
  GMAIL_API_CLIENT_ID: "", GMAIL_API_CLIENT_SECRET: "", GMAIL_API_REFRESH_TOKEN: "",
  BULKGATE_APPLICATION_ID: "", BULKGATE_APPLICATION_TOKEN: "",
});
const app = require("../dist/index").default;
const repository = require("../dist/src/repositories/bookingRepository");
const { readAllRows } = require("../dist/src/repositories/pagination");

test("production safeguards", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options) => fetch(base + path, { redirect: "manual", ...options });

  await t.test("private routes and malformed cookies reject access", async () => {
    for (const path of ["/api/admin/session", "/api/admin/invoicing", "/api/admin/bookings"]) {
      const response = await request(path, { headers: { Cookie: "eldorado_session=%ZZ" } });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    assert.equal((await request("/admin.html")).status, 303);
  });
  await t.test("cross-origin writes and malformed JSON are rejected", async () => {
    assert.equal((await request("/api/booking", { method: "POST", headers: { Origin: "https://attacker.example" } })).status, 403);
    assert.equal((await request("/api/booking", { method: "POST", headers: { Origin: process.env.APP_ORIGIN, "Content-Type": "application/json" }, body: "{" })).status, 400);
  });
  await t.test("security headers and secret paths", async () => {
    const response = await request("/api/health");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok(response.headers.get("content-security-policy").includes("frame-ancestors 'none'"));
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.equal((await request("/.env")).status, 404);
  });
  await t.test("past public slots remain blocked and manual slots respect conflicts", () => {
    const day = "2020-01-02";
    assert.deepEqual(repository.calculateAvailableSlots([], day, 45), []);
    const slots = repository.calculateAvailableSlots([{ starts_at: `${day}T09:00:00`, ends_at: `${day}T09:45:00` }], day, 45, true);
    assert.ok(slots.includes("08:00"));
    assert.ok(!slots.includes("08:30"));
    assert.ok(!slots.includes("09:00"));
    assert.ok(slots.includes("09:50"));
    assert.ok(!slots.includes("21:20"));
  });
  await t.test("reports read more than 1000 rows", async () => {
    const source = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const rows = await readAllRows(async (from, to) => ({ data: source.slice(from, to + 1), error: null }));
    assert.deepEqual(rows, source);
  });
  await t.test("past manual booking saves without notification lookups", async () => {
    const oldCreate = repository.createBooking;
    repository.createBooking = async () => "created";
    const jwt = require("jsonwebtoken");
    const { env } = require("../dist/src/config/env");
    const token = jwt.sign({ email: env.adminEmail, role: "admin" }, env.jwtSecret, { subject: "admin", issuer: env.jwtIssuer, audience: env.jwtAudience, expiresIn: 60 });
    const options = { method: "POST", headers: { Origin: env.appOrigin, "Content-Type": "application/json", Cookie: `eldorado_session=${token}` }, body: JSON.stringify({ barber_id: "11111111-1111-4111-8111-111111111111", service_id: "22222222-2222-4222-8222-222222222222", customer_name: "Test Customer", customer_phone: "912345678", customer_email: "", starts_at: "2020-01-02T09:00:00" }) };
    try {
      assert.equal((await request("/api/admin/booking", options)).status, 201);
      assert.equal((await request("/api/booking", options)).status, 400);
    } finally { repository.createBooking = oldCreate; }
  });
});
