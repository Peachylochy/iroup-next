// Opt-in local QA smoke: node tests/stability-browser.mjs --run-local-stability
// Never reads the repository's Supabase credentials or modifies .env files.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

assert(process.argv.includes("--run-local-stability"), "Explicit --run-local-stability is required.");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qaDir = path.join(process.env.LOCALAPPDATA ?? "", "Temp", "iroup-stability-local-20261021");
const container = "supabase_db_iroup-stability-local-20261021";
const api = "http://127.0.0.1:30321";
const site = "http://127.0.0.1:3105";
const result = { checks: [], externalBrowserRequestsBlocked: [], cleanup: false };
let browser, server, logFd, admin, userId;
let publishableKey = "", serviceKey = "", password = "";
const unitId = randomUUID();
const countryId = randomUUID();
const runId = randomUUID().slice(0, 8);
const unitName = `QA Stability Unit ${runId}`;
const countryName = `QA Stability Country ${runId}`;
const logPath = path.join(qaDir, `browser-next-${runId}.log`);
const resultPath = path.join(qaDir, `browser-result-${runId}.json`);
function checked(name) { result.checks.push(name); console.log(`PASS ${name}`); }
function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function dockerInfo() {
  const info = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8", windowsHide: true }))[0];
  assert.equal(info.Name, `/${container}`, "Unexpected QA container identity.");
  assert.equal(info.State.Running, true, "The isolated QA container must be running.");
  assert(info.NetworkSettings.Ports["5432/tcp"].some((binding) => binding.HostPort === "30322"), "Unexpected QA database port.");
}
function sql(query) {
  dockerInfo(); // Recheck the exact isolated destination immediately before SQL.
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], {
    input: query, encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
function movementSnapshot(id) {
  return sql(`select jsonb_build_object('record', to_jsonb(m), 'participants', (select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]') from public.movement_participants p where p.movement_id = m.id), 'funding', (select coalesce(jsonb_agg(to_jsonb(f) order by f.id), '[]') from public.movement_funding f where f.movement_id = m.id), 'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]') from public.movement_workflow_events e where e.movement_id = m.id))::text from public.movement_cases m where m.id = ${sqlLiteral(id)};`);
}
async function selectMaster(page, fieldName, optionName) {
  const root = page.locator(".master-search-select").filter({ has: page.locator(`input[name="${fieldName}"]`) });
  await root.getByRole("combobox").click();
  await root.getByPlaceholder("พิมพ์เพื่อค้นหา...").fill(optionName);
  await root.getByRole("option", { name: new RegExp(optionName) }).click();
}
async function ensurePortFree() {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(3105, "127.0.0.1", () => probe.close(resolve));
  });
}
try {
  assert.equal(new URL(api).hostname, "127.0.0.1");
  assert.equal(new URL(api).port, "30321");
  assert.equal(new URL(site).hostname, "127.0.0.1");
  assert.equal(new URL(site).port, "3105");
  assert(existsSync(path.join(qaDir, "supabase", "config.toml")), "Isolated QA config is missing.");
  dockerInfo();
  await ensurePortFree();
  const status = JSON.parse(execFileSync(process.execPath, [path.join(repo, "node_modules", "supabase", "dist", "supabase.js"), "status", "--workdir", qaDir, "--output", "json"], {
    cwd: repo, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  }));
  assert.equal(status.API_URL.replace(/\/$/, ""), api, "CLI status does not match the allowed loopback API.");
  const dbUrl = new URL(status.DB_URL);
  assert(["127.0.0.1", "localhost"].includes(dbUrl.hostname));
  assert.equal(dbUrl.port, "30322");
  publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  serviceKey = status.SERVICE_ROLE_KEY;
  assert(publishableKey && serviceKey, "Local QA keys unavailable.");
  const executablePath = [chromium.executablePath(), "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
  assert(executablePath, "No installed browser available; this harness does not install browsers.");
  browser = await chromium.launch({ executablePath, headless: true });
  checked("loopback API, isolated QA container and installed browser verified");

  admin = createClient(api, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  password = randomBytes(24).toString("base64url");
  const email = `stability-browser-${runId}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Local Stability Browser QA" } });
  assert(!created.error, "Could not create synthetic local Auth user.");
  userId = created.data.user.id;
  sql(`insert into private.user_roles (user_id, role) values (${sqlLiteral(userId)}, 'system_admin');
    insert into public.organization_units (id, code, name_th, name_en) values (${sqlLiteral(unitId)}, ${sqlLiteral(`QA-STABILITY-${runId}`)}, ${sqlLiteral(unitName)}, ${sqlLiteral(unitName)});
    insert into public.countries (id, iso2, iso3, name_th, name_en) values (${sqlLiteral(countryId)}, 'QZ', 'QZZ', ${sqlLiteral(countryName)}, ${sqlLiteral(countryName)});`);
  mkdirSync(qaDir, { recursive: true });
  logFd = openSync(logPath, "w");
  server = spawn(process.execPath, [path.join(repo, "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", "127.0.0.1", "--port", "3105"], {
    cwd: repo, windowsHide: true,
    env: { ...process.env, SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_URL: api, SUPABASE_PUBLISHABLE_KEY: publishableKey, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey, NEXT_PUBLIC_SITE_URL: site, SUPABASE_SERVICE_ROLE_KEY: serviceKey, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", logFd, logFd],
  });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Local Next dev process exited before readiness.");
    try {
      const response = await fetch(`${site}/login`, { signal: AbortSignal.timeout(2000) });
      if (response.status === 200) { ready = true; break; }
    } catch { /* Local server still compiling. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, "Local Next dev server did not become ready.");

  const context = await browser.newContext();
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ([site, api].includes(url.origin) || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    result.externalBrowserRequestsBlocked.push(url.origin);
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`${site}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${site}/`, { timeout: 60000 });
  checked("browser login with synthetic local System Admin");

  await page.goto(`${site}/travel/new`);
  const travelName = `QA Stability Travel ${runId}`;
  await page.locator('input[name="project_name"]').fill(travelName);
  await selectMaster(page, "owner_unit_id", unitName);
  await selectMaster(page, "country_id", countryName);
  await page.locator('input[name="start_date"]').fill("2026-10-21");
  await page.locator('input[name="end_date"]').fill("2026-10-22");
  await page.getByRole("button", { name: "เพิ่มผู้เดินทาง", exact: true }).click();
  await page.getByPlaceholder("ชื่อ-นามสกุล *", { exact: true }).fill("QA Manual Traveller");
  await page.getByRole("button", { name: "บันทึกร่าง", exact: true }).click();
  await page.waitForURL(/\/travel\/[0-9a-f-]{36}$/, { timeout: 60000 });
  const travelId = new URL(page.url()).pathname.split("/").at(-1);
  const travel = JSON.parse(movementSnapshot(travelId));
  assert.equal(travel.record.project_name, travelName);
  assert.equal(travel.record.workflow_status, "draft");
  assert.equal(travel.participants.length, 1);
  assert.equal(travel.participants[0].person_source, "external");
  assert.equal(travel.participants[0].person_id, null);
  checked("Travel draft saves manual participant as external with database readback");

  await page.goto(`${site}/mobility/new`);
  const mobilityName = `QA Stability Mobility ${runId}`;
  await page.locator('input[name="project_name"]').fill(mobilityName);
  await selectMaster(page, "owner_unit_id", unitName);
  await selectMaster(page, "country_id", countryName);
  await page.locator('input[name="start_date"]').fill("2026-10-21");
  await page.locator('textarea[name="purpose"]').fill("Synthetic atomic save browser QA");
  await page.getByRole("button", { name: "เพิ่มผู้เข้าร่วม", exact: true }).click();
  await page.getByPlaceholder("ชื่อ-นามสกุล *", { exact: true }).fill("QA Synthetic Student");
  await page.getByRole("button", { name: "เพิ่มแหล่งงบ", exact: true }).click();
  await page.getByPlaceholder("ประเภทงบ", { exact: true }).fill("QA budget");
  await page.getByPlaceholder("แหล่งงบประมาณ", { exact: true }).fill("QA synthetic source");
  await page.getByPlaceholder("จำนวนเงิน", { exact: true }).fill("123");
  await page.getByRole("button", { name: "บันทึกร่าง", exact: true }).click();
  await page.waitForURL(/\/mobility\/[0-9a-f-]{36}\?created=1$/, { timeout: 60000 });
  const mobilityId = new URL(page.url()).pathname.split("/").at(-1);
  const savedMobility = JSON.parse(movementSnapshot(mobilityId));
  assert.equal(savedMobility.record.project_name, mobilityName);
  assert.equal(savedMobility.participants.length, 1);
  assert.equal(savedMobility.funding.length, 1);
  assert.equal(Number(savedMobility.funding[0].amount), 123);
  checked("Student Mobility draft saves project, participant and funding through atomic action");

  await page.goto(`${site}/mobility/${mobilityId}/edit`);
  const before = movementSnapshot(mobilityId);
  await page.locator('input[name="project_name"]').fill(`${mobilityName} SHOULD ROLLBACK`);
  await page.locator('textarea[name="purpose"]').fill("");
  await page.getByPlaceholder("ชื่อ-นามสกุล *", { exact: true }).fill("QA Should Roll Back Student");
  await page.getByPlaceholder("จำนวนเงิน", { exact: true }).fill("999");
  await page.getByRole("button", { name: "บันทึกและส่งตรวจ", exact: true }).click();
  await expect(page.locator(".mou-form-message.is-error")).toBeVisible({ timeout: 30000 });
  assert.equal(movementSnapshot(mobilityId), before, "Failed review must roll back record, child rows, timestamp and workflow events.");
  checked("browser incomplete-review error leaves complete Mobility database snapshot unchanged");

  sql(`update public.profiles set active = false where id = ${sqlLiteral(userId)};`);
  const denied = await context.request.get(`${site}/api/settings/master-import/${randomUUID()}`);
  assert.equal(denied.status(), 403, "Inactive session must lose System Admin API access immediately.");
  checked("existing browser session receives 403 from System Admin API after profile deactivation");
} catch (error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [publishableKey, serviceKey, password].filter(Boolean)) message = message.replaceAll(secret, "[redacted]");
  result.error = message;
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server?.pid && server.exitCode === null) {
    try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch { /* Already exited. */ }
  }
  if (logFd !== undefined) closeSync(logFd);
  if (userId) {
    try {
      sql(`delete from public.movement_cases where created_by = ${sqlLiteral(userId)};
        delete from public.organization_units where id = ${sqlLiteral(unitId)};
        delete from public.countries where id = ${sqlLiteral(countryId)};
        delete from private.audit_logs where actor_id = ${sqlLiteral(userId)};`);
      const deleted = await admin.auth.admin.deleteUser(userId);
      assert(!deleted.error, "Synthetic local Auth cleanup failed.");
      assert.equal(sql(`select count(*) from auth.users where id = ${sqlLiteral(userId)};`), "0");
      result.cleanup = true;
    } catch { result.cleanup = false; console.error("FAIL synthetic local fixture cleanup; inspect QA-only result file."); process.exitCode = 1; }
  } else result.cleanup = true;
  mkdirSync(qaDir, { recursive: true });
  result.externalBrowserRequestsBlocked = [...new Set(result.externalBrowserRequestsBlocked)];
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`QA result: ${resultPath}`);
  console.log(`QA Next log: ${logPath}`);
  console.log(`Synthetic fixtures removed: ${result.cleanup}`);
}
