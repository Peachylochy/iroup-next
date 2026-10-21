// Opt-in isolated QA only: node tests/travel-v2-browser.mjs --run-local-travel-v2
// Starts its own loopback Next preview; never reads repository credentials or changes .env.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect as playwrightExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

assert(process.argv.includes("--run-local-travel-v2"), "Explicit --run-local-travel-v2 is required.");
const expect = playwrightExpect.configure({ timeout: 25000 });
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qaDir = path.join(process.env.LOCALAPPDATA ?? "", "Temp", "iroup-stability-local-20261021");
const container = "supabase_db_iroup-stability-local-20261021";
const api = "http://127.0.0.1:30321";
const site = "http://127.0.0.1:3105";
const runId = randomUUID().slice(0, 8);
const prefix = `QA Travel V2 ${runId}`;
const units = [randomUUID(), randomUUID()];
const countries = [randomUUID(), randomUUID()];
const ids = Array.from({ length: 47 }, () => randomUUID());
const users = [];
const secrets = [];
const result = { checks: [], screenshots: [], listPayloads: [], externalBrowserRequestsBlocked: [], cleanup: false };
const pendingPayloads = [];
const logPath = path.join(qaDir, `travel-v2-next-${runId}.log`);
const resultPath = path.join(qaDir, `travel-v2-result-${runId}.json`);
let browser, server, logFd, admin, page, restoreExecute;

function checked(name) { result.checks.push(name); console.log(`PASS ${name}`); }
function literal(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function dockerInfo() {
  const info = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8", windowsHide: true }))[0];
  assert.equal(info.Name, `/${container}`);
  assert.equal(info.State.Running, true, "Isolated QA database must be running.");
  assert(info.NetworkSettings.Ports["5432/tcp"].some((item) => item.HostPort === "30322" && item.HostIp === "127.0.0.1"), "Expected loopback QA database binding.");
}
function sql(query) {
  dockerInfo();
  return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], {
    input: query, encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
function snapshot() {
  return sql(`select jsonb_build_object(
    'cases', (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]') from public.movement_cases m where m.id in (${ids.map(literal).join(",")})),
    'participants', (select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]') from public.movement_participants p where p.movement_id in (${ids.map(literal).join(",")})),
    'funding', (select coalesce(jsonb_agg(to_jsonb(f) order by f.id), '[]') from public.movement_funding f where f.movement_id in (${ids.map(literal).join(",")})),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]') from public.movement_workflow_events e where e.movement_id in (${ids.map(literal).join(",")})))::text;`);
}
const recordName = (n) => `${prefix} - ${String(n).padStart(2, "0")}`;
const sequence = (first, last) => Array.from({ length: Math.abs(last - first) + 1 }, (_, i) => first + i * (last >= first ? 1 : -1));
async function rowsAre(targetPage, numbers) {
  const rows = targetPage.getByTestId("travel-row");
  await expect(rows).toHaveCount(numbers.length);
  for (let i = 0; i < numbers.length; i++) await expect(rows.nth(i)).toContainText(recordName(numbers[i]));
}
async function apply(targetPage, values = {}, waitForNavigation = true) {
  for (const [name, value] of Object.entries(values)) {
    const control = targetPage.locator(`[name="${name}"]`);
    if (name === "q") await control.fill(value);
    else await control.selectOption(value);
  }
  const params = new URLSearchParams();
  for (const name of ["q", "status", "country", "unit", "year", "sort"]) {
    const value = (await targetPage.locator(`[name="${name}"]`).inputValue()).trim();
    if (value && !(name === "sort" && value === "updated_desc")) params.set(name, value);
  }
  await targetPage.getByRole("button", { name: "ค้นหาและกรอง", exact: true }).click();
  if (waitForNavigation) {
    await expect(targetPage).toHaveURL(`${site}/travel${params.size ? `?${params}` : ""}`);
    await expect(targetPage.locator('form[action="/travel"]')).toHaveAttribute("aria-busy", "false");
  }
}
async function screenshot(targetPage, name) {
  const file = path.join(qaDir, `travel-v2-${name}-${runId}.png`);
  // Do not inject Playwright's caret-hiding style into server HTML while React hydrates.
  await targetPage.screenshot({ path: file, fullPage: true, caret: "initial" });
  result.screenshots.push(file);
}
async function noOverflow(targetPage, label) {
  const size = await targetPage.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert(size.document <= size.viewport + 1, `${label} horizontal overflow: ${JSON.stringify(size)}`);
}
async function createUser(role, modules = []) {
  const password = randomBytes(24).toString("base64url");
  secrets.push(password);
  const email = `travel-v2-${role}-${runId}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Local Travel V2 ${role}` } });
  assert(!created.error, `Could not create local ${role} user.`);
  const user = { id: created.data.user.id, email, password };
  users.push(user);
  sql(`insert into private.user_roles (user_id, role) values (${literal(user.id)}, ${literal(role)});
    ${modules.map((module) => `insert into private.module_permissions (user_id, module, can_view) values (${literal(user.id)}, ${literal(module)}, true);`).join("\n")}`);
  return user;
}
async function signedInPage(user, viewport = { width: 1440, height: 1050 }) {
  const context = await browser.newContext({ viewport });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ([site, api].includes(url.origin) || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    result.externalBrowserRequestsBlocked.push(url.origin);
    return route.abort();
  });
  const targetPage = await context.newPage();
  targetPage.setDefaultTimeout(25000);
  targetPage.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== site || url.pathname !== "/travel" || response.status() !== 200) return;
    const pending = response.text().then((body) => {
      const includedIds = ids.filter((id) => body.includes(id));
      result.listPayloads.push({ query: url.searchParams.has("_rsc") ? "RSC" : url.search, distinctFixtureRows: includedIds.length });
      assert(includedIds.length <= 20, `Travel response contains ${includedIds.length} distinct records instead of at most 20.`);
      assert(!includedIds.includes(ids[45]) && !includedIds.includes(ids[46]), "Other-module or deleted sentinel leaked into list response.");
      assert(!body.includes(`PRIVATE_SENTINEL_${runId}`), "Internal note leaked into Travel list payload.");
    }).catch((error) => {
      // Navigation cancellations can make a response body unavailable. Assertions remain fatal.
      if (error?.name === "AssertionError") throw error;
    });
    pendingPayloads.push(pending);
    // Attach a handler immediately; final Promise.all still propagates assertion failures.
    pending.catch(() => {});
  });
  await targetPage.goto(`${site}/login`);
  await targetPage.locator('input[name="email"]').fill(user.email);
  await targetPage.locator('input[name="password"]').fill(user.password);
  await targetPage.locator('button[type="submit"]').click();
  await targetPage.waitForURL(`${site}/`, { timeout: 60000 });
  return targetPage;
}

try {
  mkdirSync(qaDir, { recursive: true });
  assert(existsSync(path.join(qaDir, "supabase", "config.toml")), "Missing isolated QA config.");
  dockerInfo();
  assert.equal(sql("select count(*) from public.movement_cases;"), "0", "QA must have no existing movement records before this test; never delete non-fixture data.");
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(3105, "127.0.0.1", () => probe.close(resolve));
  });
  const status = JSON.parse(execFileSync(process.execPath, [path.join(repo, "node_modules", "supabase", "dist", "supabase.js"), "status", "--workdir", qaDir, "--output", "json"], {
    cwd: repo, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  }));
  assert.equal(status.API_URL.replace(/\/$/, ""), api);
  const dbUrl = new URL(status.DB_URL);
  assert(["127.0.0.1", "localhost"].includes(dbUrl.hostname));
  assert.equal(dbUrl.port, "30322");
  const publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  const serviceKey = status.SERVICE_ROLE_KEY;
  assert(publishableKey && serviceKey, "Local QA keys unavailable.");
  secrets.push(publishableKey, serviceKey);
  const executablePath = [chromium.executablePath(), "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
  assert(executablePath, "No installed browser; this harness does not install browsers.");
  browser = await chromium.launch({ executablePath, headless: true });
  admin = createClient(api, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const owner = await createUser("system_admin");
  const viewer = await createUser("viewer", ["travel"]);
  const noTravel = await createUser("editor", ["mobility"]);
  logFd = openSync(logPath, "w");
  server = spawn(process.execPath, [path.join(repo, "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", "127.0.0.1", "--port", "3105"], {
    cwd: repo, windowsHide: true,
    env: { ...process.env, SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_URL: api, SUPABASE_PUBLISHABLE_KEY: publishableKey, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey, NEXT_PUBLIC_SITE_URL: site, SUPABASE_SERVICE_ROLE_KEY: serviceKey, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", logFd, logFd],
  });
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error("Local Next exited before readiness.");
    try { if ((await fetch(`${site}/login`, { signal: AbortSignal.timeout(2000) })).status === 200) { ready = true; break; } } catch { /* Compiling. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, "Local Next server did not become ready.");
  checked("isolated loopback QA, synthetic role users and own Next preview verified");

  page = await signedInPage(owner);
  await page.goto(`${site}/travel`);
  await expect(page.getByTestId("travel-empty")).toBeVisible();
  await expect(page.getByTestId("travel-row")).toHaveCount(0);
  await expect(page.locator('a[href="/travel/new"]').first()).toBeVisible();
  await screenshot(page, "empty");
  checked("empty workspace and authorized create action");

  sql(`insert into public.organization_units (id, code, name_th) values
    (${literal(units[0])}, ${literal(`QA-V2-A-${runId}`)}, ${literal(`QA Unit A ${runId}`)}),
    (${literal(units[1])}, ${literal(`QA-V2-B-${runId}`)}, ${literal(`QA Unit B ${runId}`)});
    insert into public.countries (id, iso2, iso3, name_th, name_en) values
    (${literal(countries[0])}, 'QX', 'QXX', ${literal(`QA Country A ${runId}`)}, ${literal(`QA Country A ${runId}`)}),
    (${literal(countries[1])}, 'QY', 'QYY', ${literal(`QA Country B ${runId}`)}, ${literal(`QA Country B ${runId}`)});
    insert into public.movement_cases (id, category, project_name, title_en, country_id, owner_unit_id, start_date, end_date, fiscal_year, workflow_status, internal_note, created_by, updated_at, deleted_at) values
    ${ids.map((id, index) => {
      const n = index + 1;
      return `(${literal(id)}, '${n === 46 ? "staff_mobility" : "staff_official_travel"}', ${literal(recordName(n))}, ${literal(n === 10 ? `QA Literal 100%_ ${runId}` : `QA English ${n}`)}, ${literal(countries[n % 2 === 0 ? 0 : 1])}, ${literal(units[n % 3 === 0 ? 1 : 0])}, date '2026-01-01' + ${n}, date '2026-01-02' + ${n}, ${n <= 30 ? 2570 : 2569}, '${["draft", "under_review", "active"][n % 3]}', ${literal(`PRIVATE_SENTINEL_${runId}`)}, ${literal(owner.id)}, timestamptz '2026-10-21 00:00:00+00' + interval '${n} minutes', ${n === 47 ? "now()" : "null"})`;
    }).join(",\n")};`);
  const before = snapshot();
  await page.goto(`${site}/travel`);
  await rowsAre(page, sequence(45, 26));
  await expect(page.getByTestId("travel-result-count")).toContainText(/ทั้งหมด\s*45/);
  await expect(page.locator('section[aria-labelledby="travel-overview-title"] strong')).toHaveText(["45", "15", "15"]);
  await screenshot(page, "desktop");
  await noOverflow(page, "desktop");
  checked("server list shows latest 20 of 45 and excludes staff/deleted records");

  await page.getByRole("link", { name: "หน้าถัดไป", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await rowsAre(page, sequence(25, 6));
  await page.getByRole("link", { name: "หน้าถัดไป", exact: true }).click();
  await expect(page).toHaveURL(/page=3/);
  await rowsAre(page, sequence(5, 1));
  await page.reload();
  await rowsAre(page, sequence(5, 1));
  await page.getByRole("link", { name: "หน้าก่อนหน้า", exact: true }).click();
  await rowsAre(page, sequence(25, 6));
  await page.goBack();
  await rowsAre(page, sequence(5, 1));
  checked("20/20/5 pagination persists through refresh and browser Back");

  await apply(page, { sort: "start_asc" });
  await rowsAre(page, sequence(1, 20));
  assert.equal(new URL(page.url()).searchParams.get("page"), null, "Changing sort must reset page.");
  await apply(page, { sort: "name_asc" });
  await rowsAre(page, sequence(1, 20));
  await apply(page, { sort: "start_desc" });
  await rowsAre(page, sequence(45, 26));
  checked("date and name sorting run over all records and reset pagination");

  await apply(page, { q: prefix, status: "under_review", country: countries[0], unit: units[0], year: "2570" });
  await rowsAre(page, [28, 22, 16, 10, 4]);
  for (const [key, value] of Object.entries({ q: prefix, status: "under_review", country: countries[0], unit: units[0], year: "2570", sort: "start_desc" })) {
    assert.equal(new URL(page.url()).searchParams.get(key), value);
  }
  await page.reload();
  await rowsAre(page, [28, 22, 16, 10, 4]);
  await expect(page.locator('[name="q"]')).toHaveValue(prefix);
  await expect(page.locator('[name="country"]')).toHaveValue(countries[0]);
  await screenshot(page, "filtered");
  checked("combined search/status/country/unit/year filters persist in URL and after refresh");

  await page.goto(`${site}/travel?q=${encodeURIComponent("100%_")}`);
  await rowsAre(page, [10]);
  await page.goto(`${site}/travel?q=${encodeURIComponent(`missing-${runId}`)}`);
  await expect(page.getByTestId("travel-no-results")).toBeVisible();
  await expect(page.getByTestId("travel-row")).toHaveCount(0);
  await page.getByRole("link", { name: "ล้างตัวกรอง", exact: true }).first().click();
  await rowsAre(page, sequence(45, 26));
  checked("literal wildcard characters are searched safely and no-results can be cleared");

  await page.goto(`${site}/travel?page=999999`);
  await expect(page).toHaveURL(/page=3/);
  await rowsAre(page, sequence(5, 1));
  checked("out-of-range pagination resolves to last valid page");

  await page.goto(`${site}/travel`);
  await rowsAre(page, sequence(45, 26));
  await page.locator('[name="q"]').focus();
  await page.keyboard.type(recordName(4));
  await page.keyboard.press("Enter");
  await rowsAre(page, [4]);
  checked("keyboard Enter submits search");
  await page.locator(`a[href="/travel/${ids[3]}"]`).first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${site}/travel/${ids[3]}`);
  await expect(page.getByRole("heading", { name: recordName(4), exact: true })).toBeVisible();
  checked("keyboard detail link preserves existing Travel detail route");

  await page.goto(`${site}/travel`);
  await page.setViewportSize({ width: 390, height: 844 });
  await rowsAre(page, sequence(45, 26));
  await noOverflow(page, "mobile");
  await screenshot(page, "mobile");
  await apply(page, { q: recordName(2) });
  await rowsAre(page, [2]);
  await noOverflow(page, "mobile filtered");
  checked("mobile list and filtering work without horizontal overflow");
  await page.setViewportSize({ width: 1440, height: 1050 });

  let releaseNavigation;
  let navigationEntered;
  const heldNavigation = new Promise((resolve) => { releaseNavigation = resolve; });
  const navigationStarted = new Promise((resolve) => { navigationEntered = resolve; });
  const delayedNavigation = async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === site && url.pathname === "/travel" && url.searchParams.get("q") === recordName(17)) {
      navigationEntered();
      await heldNavigation;
    }
    await route.continue();
  };
  await page.route("**/travel?**", delayedNavigation);
  try {
    await apply(page, { q: recordName(17) }, false);
    await Promise.race([navigationStarted, new Promise((_, reject) => setTimeout(() => reject(new Error("Did not observe delayed local list navigation.")), 15000))]);
    await expect(page.locator('form[aria-busy="true"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "กำลังค้นหา…", exact: true })).toBeDisabled();
    await screenshot(page, "loading");
  } finally {
    releaseNavigation();
  }
  await rowsAre(page, [17]);
  await page.unroute("**/travel?**", delayedNavigation);
  checked("delayed local navigation exposes busy/loading state and completes correctly");

  const rpcSignature = sql("select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='travel_list_v2';");
  assert(rpcSignature.startsWith("public.travel_list_v2(") && !rpcSignature.includes("\n"), "Expected one Travel list function.");
  assert.equal(sql("select has_function_privilege('authenticated', p.oid, 'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='travel_list_v2';"), "t");
  restoreExecute = `grant execute on function ${rpcSignature} to authenticated;`;
  sql(`revoke execute on function ${rpcSignature} from authenticated;`);
  await page.goto(`${site}/travel?q=${encodeURIComponent(recordName(3))}`);
  await expect(page.getByRole("heading", { name: "โหลดข้อมูลการเดินทางไม่สำเร็จ", exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "ตัวกรอง" })).toBeVisible();
  await screenshot(page, "error");
  sql(restoreExecute);
  restoreExecute = undefined;
  await page.getByRole("button", { name: "ลองอีกครั้ง", exact: true }).click();
  await rowsAre(page, [3]);
  assert.equal(new URL(page.url()).searchParams.get("q"), recordName(3));
  checked("real QA RPC failure renders error and retry recovers with URL filters intact");

  const viewerPage = await signedInPage(viewer);
  await viewerPage.goto(`${site}/travel`);
  await rowsAre(viewerPage, sequence(45, 26));
  await expect(viewerPage.getByTestId("travel-readonly")).toBeVisible();
  await expect(viewerPage.locator('a[href="/travel/new"]')).toHaveCount(0);
  await screenshot(viewerPage, "readonly");
  checked("view-only role can read Travel with read-only notice and no create action");
  sql(`update private.module_permissions set can_publish=true where user_id=${literal(viewer.id)} and module='travel';`);
  await viewerPage.reload();
  await rowsAre(viewerPage, sequence(45, 26));
  await expect(viewerPage.getByTestId("travel-readonly")).toHaveCount(0);
  await expect(viewerPage.locator('a[href="/travel/new"]')).toHaveCount(0);
  sql(`update private.module_permissions set can_publish=false where user_id=${literal(viewer.id)} and module='travel';`);
  checked("custom publish permission is not mislabeled read-only or granted create access");

  const deniedPage = await signedInPage(noTravel);
  await deniedPage.goto(`${site}/travel`);
  await expect(deniedPage.getByRole("heading", { name: "ยังไม่มีสิทธิ์ดูข้อมูลการเดินทาง", exact: true })).toBeVisible();
  await expect(deniedPage.getByTestId("travel-row")).toHaveCount(0);
  checked("user without Travel permission sees denial without any Travel rows");
  sql(`update public.profiles set active=false where id=${literal(viewer.id)};`);
  await viewerPage.reload();
  await expect(viewerPage.getByRole("heading", { name: "ยังไม่มีสิทธิ์ดูข้อมูลการเดินทาง", exact: true })).toBeVisible();
  await expect(viewerPage.getByTestId("travel-row")).toHaveCount(0);
  checked("deactivation removes list access from an existing signed-in session");

  assert.equal(snapshot(), before, "List reads must preserve case, participant, funding and workflow snapshots.");
  await Promise.all(pendingPayloads);
  assert(result.listPayloads.some((payload) => payload.distinctFixtureRows === 20), "Did not capture a full paginated HTML/RSC response.");
  checked("database snapshots unchanged and captured list payloads contain at most 20 records");
} catch (error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) message = message.replaceAll(secret, "[redacted]");
  result.error = message;
  console.error(`FAIL ${message}`);
  if (page && !page.isClosed()) await screenshot(page, "failure").catch(() => {});
  process.exitCode = 1;
} finally {
  if (restoreExecute) {
    try { sql(restoreExecute); restoreExecute = undefined; } catch { result.permissionRestoreFailed = true; process.exitCode = 1; }
  }
  if (browser) await browser.close().catch(() => {});
  if (server?.pid && server.exitCode === null) {
    try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch { /* Already exited. */ }
  }
  if (logFd !== undefined) closeSync(logFd);
  try {
    if (users.length) {
      sql(`delete from public.movement_cases where id in (${ids.map(literal).join(",")});
        delete from public.organization_units where id in (${units.map(literal).join(",")});
        delete from public.countries where id in (${countries.map(literal).join(",")});`);
      for (const user of users) assert(!(await admin.auth.admin.deleteUser(user.id)).error, "Local Auth fixture cleanup failed.");
      // SQL fixture writes/deletes use postgres, so their audit actor is null.
      // Remove only this run's audit records after every fixture deletion has fired its triggers.
      const auditFixtureIds = [...ids, ...units, ...countries, ...users.map((user) => user.id)];
      sql(`delete from private.audit_logs where actor_id in (${users.map((user) => literal(user.id)).join(",")}) or record_id in (${auditFixtureIds.map(literal).join(",")});`);
      assert.equal(sql(`select count(*) from auth.users where id in (${users.map((user) => literal(user.id)).join(",")});`), "0");
      assert.equal(sql(`select count(*) from public.movement_cases where id in (${ids.map(literal).join(",")});`), "0");
      assert.equal(sql(`select count(*) from private.audit_logs where record_id in (${auditFixtureIds.map(literal).join(",")});`), "0");
    }
    result.cleanup = !result.permissionRestoreFailed;
  } catch { console.error("FAIL isolated QA fixture cleanup; inspect result file."); process.exitCode = 1; }
  result.externalBrowserRequestsBlocked = [...new Set(result.externalBrowserRequestsBlocked)];
  mkdirSync(qaDir, { recursive: true });
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`QA result: ${resultPath}`);
  console.log(`QA Next log: ${logPath}`);
  console.log(`Synthetic fixtures removed: ${result.cleanup}`);
}
