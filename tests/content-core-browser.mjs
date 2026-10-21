// Opt-in isolated QA only: node tests/content-core-browser.mjs --run-local-content-core
// Uses its own loopback Next preview and synthetic fixtures; never loads repository credentials.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect as playwrightExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

assert(process.argv.includes("--run-local-content-core"), "Explicit --run-local-content-core is required.");
const expect = playwrightExpect.configure({ timeout: 25000 });
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qaDir = path.join(process.env.LOCALAPPDATA ?? "", "Temp", "iroup-stability-local-20261021");
const container = "supabase_db_iroup-stability-local-20261021";
const api = "http://127.0.0.1:30321";
const site = "http://127.0.0.1:3105";
const runId = randomUUID().slice(0, 8);
const prefix = `QA Core Content ${runId}`;
const scholarshipId = randomUUID();
const newsId = randomUUID();
const users = [];
const canonicalIds = [scholarshipId, newsId];
const workItemIds = [];
const secrets = [];
const result = { checks: [], screenshots: [], externalBrowserRequestsBlocked: [], cleanup: false };
const logPath = path.join(qaDir, `content-core-next-${runId}.log`);
const resultPath = path.join(qaDir, `content-core-result-${runId}.json`);
let browser, server, logFd, admin, anonymous, page;

function checked(name) { result.checks.push(name); console.log(`PASS ${name}`); }
function literal(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function dockerInfo() {
  const info = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8", windowsHide: true }))[0];
  assert.equal(info.Name, `/${container}`);
  assert.equal(info.State.Running, true, "Isolated QA database must be running.");
  assert(info.NetworkSettings.Ports["5432/tcp"].some((binding) => binding.HostPort === "30322" && binding.HostIp === "127.0.0.1"), "Expected loopback QA database binding.");
}
function sql(query) {
  dockerInfo();
  return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], {
    input: query, encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
function canonicalSnapshot() {
  return sql(`select jsonb_build_object(
    'scholarship', (select to_jsonb(s) from public.scholarships s where id = ${literal(scholarshipId)}),
    'news', (select to_jsonb(n) from public.news_articles n where id = ${literal(newsId)}),
    'scholarship_public', (select to_jsonb(s) from public.scholarships_public s where id = ${literal(scholarshipId)}),
    'news_public', (select to_jsonb(n) from public.news_public n where id = ${literal(newsId)}))::text;`);
}
function editorialState(recordId) {
  return JSON.parse(sql(`select jsonb_build_object(
    'work_item', to_jsonb(w),
    'snapshot', (select to_jsonb(s) from public.content_snapshots s where id=w.current_snapshot_id),
    'versions', (select coalesce(jsonb_agg(to_jsonb(v) order by v.version_number), '[]') from public.content_versions v where work_item_id=w.id),
    'sources', (select coalesce(jsonb_agg(to_jsonb(s) order by s.revision), '[]') from public.content_source_verifications s where work_item_id=w.id),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(d) order by d.revision), '[]') from public.content_review_decisions d where work_item_id=w.id))
    from public.content_work_items w where scholarship_id=${literal(recordId)} or news_id=${literal(recordId)};`));
}
function trackWorkItem(recordId) {
  const state = editorialState(recordId);
  if (!workItemIds.includes(state.work_item.id)) workItemIds.push(state.work_item.id);
  return state;
}
async function publishedSnapshot() {
  const [scholarship, news] = await Promise.all([
    anonymous.from("scholarships_public").select("*").eq("id", scholarshipId).single(),
    anonymous.from("news_public").select("*").eq("id", newsId).single(),
  ]);
  assert(!scholarship.error && !news.error, "Anonymous canonical fixture read failed.");
  return JSON.stringify({ scholarship: scholarship.data, news: news.data });
}
async function screenshot(targetPage, name) {
  const file = path.join(qaDir, `content-core-${name}-${runId}.png`);
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
  const email = `content-core-${users.length}-${runId}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Local Core Content ${role}` } });
  assert(!created.error, `Could not create local ${role} user.`);
  const user = { id: created.data.user.id, email, password };
  users.push(user);
  sql(`insert into private.user_roles (user_id, role) values (${literal(user.id)}, ${literal(role)});
    ${modules.map(({ module, create = false, update = false, publish = false }) => `insert into private.module_permissions (user_id, module, can_view, can_create, can_update, can_publish) values (${literal(user.id)}, ${literal(module)}, true, ${create}, ${update}, ${publish});`).join("\n")}`);
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
  await targetPage.goto(`${site}/login`);
  await targetPage.locator('input[name="email"]').fill(user.email);
  await targetPage.locator('input[name="password"]').fill(user.password);
  await targetPage.locator('button[type="submit"]').click();
  await targetPage.waitForURL(`${site}/`, { timeout: 60000 });
  return targetPage;
}

async function startIsolatedPreview() {
  mkdirSync(qaDir, { recursive: true });
  assert(existsSync(path.join(qaDir, "supabase", "config.toml")), "Missing isolated QA config.");
  dockerInfo();
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
  anonymous = createClient(api, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
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
}

async function fillSource(targetPage, { verified = true, finalUrl = "https://example.test/scholarship", note = "Human fixture source check" } = {}) {
  const form = targetPage.getByTestId("content-source-form");
  const recordId = new URL(targetPage.url()).pathname.split("/").at(-1);
  const before = editorialState(recordId).work_item.row_version;
  if (!await form.isVisible()) await targetPage.getByText("เพิ่มผลตรวจสอบแหล่งข้อมูล", { exact: true }).click();
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  for (const [name, value] of Object.entries({ title: `${prefix} official source`, publisher: "Synthetic scholarship owner", requested_url: finalUrl, final_url: finalUrl, observed_on: today, valid_until: nextWeek, note })) {
    await form.locator(`[name="${name}"]`).fill(value);
  }
  await form.locator('[name="official"]').setChecked(verified);
  await form.locator('[name="result"]').selectOption(verified ? "verified" : "unverified");
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => editorialState(recordId).work_item.row_version).toBeGreaterThan(before);
  await expect(targetPage.getByTestId("content-draft-form").locator('[name="expected_revision"]')).toHaveValue(String(editorialState(recordId).work_item.row_version));
}

async function fillDraft(targetPage, { kind = "scholarship", sourceId, title = `${prefix} ไทย`, englishTitle = `${prefix} English` }) {
  const form = targetPage.getByTestId("content-draft-form");
  const fields = {
    fact_subject: `${prefix} independently verified facts`,
    fact_key_points: "Synthetic factual notes, separate from channel presentation.",
    th_title: title, th_summary: "สรุปภาษาไทยสำหรับทดสอบ", th_body: "เนื้อหาภาษาไทยที่ต้องไม่สูญหายเมื่อแก้ภาษาอังกฤษ",
    en_title: englishTitle, en_summary: "English summary retained across edits.", en_body: "English body retained across Thai-only edits.",
  };
  if (kind === "scholarship") Object.assign(fields, { th_coverage: "ครอบคลุมค่าเล่าเรียน", en_coverage: "Tuition covered" });
  for (const [name, value] of Object.entries(fields)) await form.locator(`[name="${name}"]`).fill(value);
  if (sourceId) await form.locator(`[name="selected_source"][value="${sourceId}"]`).check();
  return form;
}

async function setDeadline(targetPage, kind, values) {
  const form = targetPage.getByTestId("content-draft-form");
  for (const [field, value] of Object.entries(values)) {
    const control = form.locator(`[name="deadline_${kind}_${field}"]`);
    if (["applicability", "precision", "source_verification_id"].includes(field)) await control.selectOption(value);
    else await control.fill(value);
  }
}

async function saveDraft(targetPage, recordId) {
  const before = editorialState(recordId).work_item.row_version;
  await targetPage.getByTestId("content-draft-form").getByRole("button", { name: "บันทึกร่างใหม่", exact: true }).click();
  await expect.poll(() => editorialState(recordId).work_item.row_version).toBeGreaterThan(before);
  await expect(targetPage.getByTestId("content-draft-form").locator('[name="expected_revision"]')).toHaveValue(String(editorialState(recordId).work_item.row_version));
  return editorialState(recordId);
}

async function decide(targetPage, recordId, versionId, decision, note = "") {
  const before = editorialState(recordId).work_item.row_version;
  const form = targetPage.getByTestId(`content-review-${versionId}`);
  if (note) await form.locator('[name="note"]').fill(note);
  await form.getByRole("button", { name: { submit: "ส่งตรวจเนื้อหา", approve: "อนุมัติเนื้อหา", return: "ส่งกลับแก้ไข" }[decision], exact: true }).click();
  await expect.poll(() => editorialState(recordId).work_item.row_version).toBeGreaterThan(before);
  await expect(targetPage.getByTestId("content-draft-form").locator('[name="expected_revision"]')).toHaveValue(String(editorialState(recordId).work_item.row_version));
  return editorialState(recordId);
}

try {
  await startIsolatedPreview();
  const owner = await createUser("system_admin");
  const editor = await createUser("editor", [{ module: "news", create: true, update: true }]);
  const viewer = await createUser("viewer", [{ module: "scholarship" }, { module: "news" }]);
  const denied = await createUser("editor", [{ module: "travel", create: true, update: true }]);
  sql(`insert into public.scholarships (id,title_th,title_en,summary_th,summary_en,content_th,content_en,coverage_th,coverage_en,publication_status,public_visible,internal_note,created_by)
    values (${literal(scholarshipId)},${literal(`${prefix} Published scholarship`)},'Published English scholarship','Published Thai summary','Published English summary','Published Thai body','Published English body','Published Thai coverage','Published English coverage','published',true,${literal(`PRIVATE_CANONICAL_${runId}`)},${literal(owner.id)});
    insert into public.news_articles (id,title_th,title_en,summary_th,summary_en,content_th,content_en,publication_status,public_visible,internal_note,created_by)
    values (${literal(newsId)},${literal(`${prefix} Published news`)},'Published English news','Published Thai summary','Published English summary','Published Thai body','Published English body','published',true,${literal(`PRIVATE_CANONICAL_${runId}`)},${literal(owner.id)});`);
  const canonicalBefore = canonicalSnapshot();
  const publicBefore = await publishedSnapshot();
  checked("isolated loopback QA, synthetic roles and published reference records verified");

  page = await signedInPage(owner);
  await page.goto(`${site}/content-production?kind=scholarship`);
  await expect(page.locator(`a[href="/content-production/scholarship/${scholarshipId}"]`).first()).toBeVisible();
  await page.goto(`${site}/content-production/scholarship/${scholarshipId}`);
  await page.getByTestId("content-open-form").getByRole("button", { name: "เริ่มจัดทำเนื้อหา", exact: true }).click();
  await expect(page.getByTestId("content-source-form")).toBeVisible();
  trackWorkItem(scholarshipId);
  assert.equal(canonicalSnapshot(), canonicalBefore);
  checked("existing published Scholarship enrolls without rewriting canonical/public content");

  await fillSource(page, { verified: false, note: "Unverified source must never approve" });
  let state = editorialState(scholarshipId);
  const unverifiedSource = state.sources.at(-1).id;
  const draft = await fillDraft(page, {});
  for (const kind of ["university_internal", "thai_nominating_body", "scholarship_owner"]) await expect(draft.locator(`[name="deadline_${kind}_applicability"]`)).toHaveValue("pending");
  state = await saveDraft(page, scholarshipId);
  assert.deepEqual(state.snapshot.deadlines, [], "Unknown deadlines must remain pending, never invented as N/A.");
  let version = state.versions.at(-1);
  const beforeInvalidSubmit = JSON.stringify(state);
  await page.getByTestId(`content-review-${version.id}`).getByRole("button", { name: "ส่งตรวจเนื้อหา", exact: true }).click();
  await expect(page.getByTestId(`content-review-${version.id}`).getByRole("alert")).toBeVisible();
  assert.equal(JSON.stringify(editorialState(scholarshipId)), beforeInvalidSubmit);
  checked("missing selected source cannot pass submission and rejected transition changes no state");
  checked("incomplete Scholarship saves with pending deadlines without inventing N/A reasons or dates");

  await draft.locator(`[name="selected_source"][value="${unverifiedSource}"]`).check();
  state = await saveDraft(page, scholarshipId);
  version = state.versions.at(-1);
  await expect(page.getByTestId(`content-version-${version.id}`)).toContainText("ต้องตรวจใหม่");
  await expect(page.getByTestId(`content-review-${version.id}`)).toHaveCount(0);
  checked("unverified source marks the draft stale and does not offer submission");

  await draft.locator('[name="th_title"]').fill("Unsaved Thai copy survives source append");
  await draft.locator('[name="fact_key_points"]').fill("Unsaved independent facts survive source append");
  await fillSource(page, { verified: true });
  await expect(draft.locator('[name="th_title"]')).toHaveValue("Unsaved Thai copy survives source append");
  await expect(draft.locator('[name="fact_key_points"]')).toHaveValue("Unsaved independent facts survive source append");
  await draft.locator('[name="th_title"]').fill(`${prefix} ไทย`);
  await draft.locator('[name="fact_key_points"]').fill("Synthetic factual notes, separate from channel presentation.");
  state = editorialState(scholarshipId);
  const source = state.sources.at(-1).id;
  await draft.locator(`[name="selected_source"][value="${unverifiedSource}"]`).uncheck();
  await draft.locator(`[name="selected_source"][value="${source}"]`).check();
  state = await saveDraft(page, scholarshipId);
  version = state.versions.at(-1);
  const beforePendingSubmit = JSON.stringify(state);
  await page.getByTestId(`content-review-${version.id}`).getByRole("button", { name: "ส่งตรวจเนื้อหา", exact: true }).click();
  await expect(page.getByTestId(`content-review-${version.id}`).getByRole("alert")).toContainText("กำหนดเวลา");
  assert.equal(JSON.stringify(editorialState(scholarshipId)), beforePendingSubmit);
  checked("verified sources alone cannot submit Scholarship while deadline determinations remain pending");
  await setDeadline(page, "university_internal", { applicability: "specified", cycle_key: "2027", raw_text: "Submit within university by 10 March 2027 (date only)", precision: "date_only", date: "2027-03-10", source_verification_id: source });
  await setDeadline(page, "thai_nominating_body", { applicability: "specified", cycle_key: "2027", raw_text: "Thai nomination: 15 March 2027 at 16:30 Asia/Bangkok", precision: "local_datetime", date: "2027-03-15", time: "16:30", timezone: "Asia/Bangkok", source_verification_id: source });
  await setDeadline(page, "scholarship_owner", { applicability: "specified", cycle_key: "2027", raw_text: "Owner closes 20 March 2027 12:00 UTC", precision: "instant", instant: "2027-03-20T12:00:00Z", source_verification_id: source });
  const beforeMissingDeadline = JSON.stringify(editorialState(scholarshipId));
  await draft.locator('[name="deadline_university_internal_raw_text"]').fill("");
  await draft.getByRole("button", { name: "บันทึกร่างใหม่", exact: true }).click();
  assert(await draft.locator('[name="deadline_university_internal_raw_text"]').evaluate((control) => control.validity.valueMissing));
  assert.equal(JSON.stringify(editorialState(scholarshipId)), beforeMissingDeadline);
  await draft.locator('[name="deadline_university_internal_raw_text"]').fill("Submit within university by 10 March 2027 (date only)");
  state = await saveDraft(page, scholarshipId);
  version = state.versions.at(-1);
  assert.deepEqual(state.snapshot.deadlines.map((item) => item.kind).sort(), ["scholarship_owner", "thai_nominating_body", "university_internal"]);
  const dateOnly = state.snapshot.deadlines.find((item) => item.kind === "university_internal");
  assert.equal(dateOnly.precision, "date_only");
  assert.equal(dateOnly.date, "2027-03-10");
  assert.equal(dateOnly.time, null);
  assert.equal(dateOnly.timezone, null);
  assert.equal(dateOnly.instant, null);
  assert.equal(version.locales.en.body, "English body retained across Thai-only edits.");
  assert.equal(version.locales.en.coverage, "Tuition covered");
  assert.equal(version.locales.th.coverage, "ครอบคลุมค่าเล่าเรียน");
  checked("bilingual Scholarship draft and all three deadline levels preserve their raw precision");
  checked("source append retains unsaved copy/facts and incomplete deadline cannot save");

  await page.reload();
  await expect(draft.locator('[name="en_body"]')).toHaveValue(version.locales.en.body);
  await expect(draft.locator('[name="th_body"]')).toHaveValue(version.locales.th.body);
  const stalePage = await page.context().newPage();
  await stalePage.goto(`${site}/content-production/scholarship/${scholarshipId}`);
  const snapshotBeforeCopy = state.snapshot.id;
  await draft.locator('[name="th_title"]').fill(`${prefix} Updated Thai only`);
  state = await saveDraft(page, scholarshipId);
  assert.equal(state.snapshot.id, snapshotBeforeCopy, "Presentation-only edit must not change canonical snapshot.");
  assert.equal(state.versions.at(-1).locales.en.body, version.locales.en.body);
  const winningState = JSON.stringify(state);
  await stalePage.bringToFront();
  await stalePage.getByTestId("content-draft-form").locator('[name="en_title"]').fill("Unsent stale tab title must remain visible");
  result.conflict = { loadedRevision: await stalePage.getByTestId("content-draft-form").locator('[name="expected_revision"]').inputValue(), winningRevision: state.work_item.row_version };
  assert(Number(result.conflict.loadedRevision) < result.conflict.winningRevision, "Second tab must hold an older revision before testing conflict.");
  const conflictStarted = performance.now();
  await stalePage.getByTestId("content-draft-form").getByRole("button", { name: "บันทึกร่างใหม่", exact: true }).click();
  try {
    await expect(stalePage.getByTestId("content-draft-form").getByRole("alert")).toBeVisible();
    result.conflict.elapsedMs = Math.round(performance.now() - conflictStarted);
  } catch (error) {
    result.conflict.databaseActivity = sql("select coalesce(jsonb_agg(jsonb_build_object('application',application_name,'state',state,'wait_type',wait_event_type,'wait',wait_event,'duration_seconds',extract(epoch from now()-query_start))) filter(where pid<>pg_backend_pid()),'[]') from pg_stat_activity where datname='postgres';");
    result.conflict.actualRevision = editorialState(scholarshipId).work_item.row_version;
    await screenshot(stalePage, "conflict-failure");
    throw error;
  }
  await expect(stalePage.getByTestId("content-draft-form").getByRole("alert")).toContainText("อีกหน้าต่าง");
  await expect(stalePage.getByTestId("content-draft-form").getByRole("button", { name: "โหลดข้อมูลล่าสุด", exact: true })).toBeVisible();
  await expect(stalePage.getByTestId("content-draft-form").locator('[name="en_title"]')).toHaveValue("Unsent stale tab title must remain visible");
  assert.equal(JSON.stringify(editorialState(scholarshipId)), winningState);
  await stalePage.close();
  checked("Thai-only edits retain English and snapshot; stale second-tab save preserves winner and unsaved input");

  version = state.versions.at(-1);
  state = await decide(page, scholarshipId, version.id, "submit");
  state = await decide(page, scholarshipId, version.id, "approve", "Checked both languages against synthetic sources");
  const approvedVersion = JSON.stringify(state.versions.find((item) => item.id === version.id));
  assert.equal(state.reviews.at(-1).decision, "approved");
  assert.equal(canonicalSnapshot(), canonicalBefore);
  assert.equal(await publishedSnapshot(), publicBefore);
  await screenshot(page, "approved");
  checked("submit and approve append review events without publishing or changing public output");

  await draft.locator('[name="fact_key_points"]').fill("Revised independent facts require a fresh review.");
  state = await saveDraft(page, scholarshipId);
  assert.notEqual(state.snapshot.id, snapshotBeforeCopy);
  assert.equal(JSON.stringify(state.versions.find((item) => item.id === version.id)), approvedVersion);
  const newVersion = state.versions.at(-1);
  assert.equal(newVersion.based_on_version_id, version.id);
  await expect(page.getByTestId(`content-version-${version.id}`)).toContainText("ต้องตรวจใหม่");
  state = await decide(page, scholarshipId, newVersion.id, "submit");
  state = await decide(page, scholarshipId, newVersion.id, "return", "Please clarify revised fact statement");
  assert.equal(state.reviews.at(-1).decision, "returned");
  assert.equal(state.reviews.at(-1).note, "Please clarify revised fact statement");
  checked("edit after approval creates immutable successors and stale prior review; return records reviewer reason");

  const websitePayloadBefore = JSON.stringify(state.versions.filter((item) => item.channel === "website"));
  await draft.locator('[name="channel"]').selectOption("facebook");
  await draft.locator('[name="th_title"]').fill(`${prefix} Facebook ไทย`);
  await draft.locator('[name="th_body"]').fill("ข้อความ Facebook ภาษาไทย");
  await draft.locator('[name="en_title"]').fill(`${prefix} Facebook English`);
  await draft.locator('[name="en_body"]').fill("Facebook English body");
  state = await saveDraft(page, scholarshipId);
  await expect(draft.locator('[name="channel"]')).toHaveValue("facebook");
  assert.equal(JSON.stringify(state.versions.filter((item) => item.channel === "website")), websitePayloadBefore);
  assert.equal(state.versions.find((item) => item.channel === "facebook").snapshot_id, state.snapshot.id);
  await draft.locator('[name="channel"]').selectOption("website");
  await expect(draft.locator('[name="en_title"]')).toHaveValue(`${prefix} English`);
  checked("Website and Facebook drafts retain separate copy on the same snapshot and preserve selected channel");

  const editorPage = await signedInPage(editor);
  await editorPage.goto(`${site}/content-production/news/new`);
  await editorPage.getByTestId("content-open-form").locator('[name="title_th"]').fill(`${prefix} New news`);
  await editorPage.getByTestId("content-open-form").getByRole("button", { name: "เริ่มจัดทำเนื้อหา", exact: true }).click();
  await expect(editorPage).toHaveURL(/\/content-production\/news\/[0-9a-f-]{36}$/);
  const newNewsId = new URL(editorPage.url()).pathname.split("/").at(-1);
  canonicalIds.push(newNewsId);
  trackWorkItem(newNewsId);
  await fillSource(editorPage, { finalUrl: "https://example.test/news" });
  const newsSource = editorialState(newNewsId).sources.at(-1).id;
  await fillDraft(editorPage, { kind: "news", sourceId: newsSource, title: `${prefix} ข่าวไทย`, englishTitle: `${prefix} English news` });
  const newsState = await saveDraft(editorPage, newNewsId);
  assert.equal(newsState.versions.at(-1).locales.th.title, `${prefix} ข่าวไทย`);
  assert.equal(newsState.versions.at(-1).locales.en.title, `${prefix} English news`);
  await decide(editorPage, newNewsId, newsState.versions.at(-1).id, "submit");
  await expect(editorPage.getByRole("button", { name: "อนุมัติเนื้อหา", exact: true })).toHaveCount(0);
  assert.equal(sql(`select publication_status::text || ':' || public_visible::text from public.news_articles where id=${literal(newNewsId)};`), "draft:false");
  const publicNewNews = await anonymous.from("news_public").select("id").eq("id", newNewsId);
  assert(!publicNewNews.error && publicNewNews.data.length === 0);
  checked("news editor creates bilingual draft and submits, without approve permission or public visibility");

  const viewerPage = await signedInPage(viewer);
  await viewerPage.goto(`${site}/content-production/scholarship/${scholarshipId}`);
  await expect(viewerPage.getByTestId("content-source-form")).toHaveCount(0);
  await expect(viewerPage.getByRole("button", { name: "บันทึกร่างใหม่", exact: true })).toHaveCount(0);
  await expect(viewerPage.getByRole("button", { name: "อนุมัติเนื้อหา", exact: true })).toHaveCount(0);
  await expect(viewerPage.getByTestId("content-draft-form").locator('[name="th_title"]')).toHaveValue(`${prefix} Updated Thai only`);
  await expect(viewerPage.getByTestId("content-draft-form").locator('[name="th_title"]')).toBeDisabled();
  await screenshot(viewerPage, "readonly");
  checked("view-only user reads versions without authoring or review actions");

  const deniedPage = await signedInPage(denied);
  await deniedPage.goto(`${site}/content-production/scholarship/${scholarshipId}`);
  await expect(deniedPage.getByTestId("content-draft-form")).toHaveCount(0);
  await expect(deniedPage.getByText(`${prefix} Updated Thai only`, { exact: true })).toHaveCount(0);
  await expect(deniedPage.getByText("ยังไม่มีสิทธิ์", { exact: false }).first()).toBeVisible();
  sql(`update public.profiles set active=false where id=${literal(viewer.id)};`);
  await viewerPage.reload();
  await expect(viewerPage.getByText(`${prefix} Updated Thai only`, { exact: true })).toHaveCount(0);
  checked("unrelated module and deactivated sessions cannot read editorial content");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${site}/content-production/scholarship/${scholarshipId}`);
  await noOverflow(page, "mobile editorial workspace");
  await screenshot(page, "mobile");
  await page.getByTestId("content-draft-form").locator('[name="en_title"]').focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" keyboard");
  await expect(page.getByTestId("content-draft-form").locator('[name="en_title"]')).toHaveValue(`${prefix} English keyboard`);
  checked("mobile workspace has no horizontal overflow and keyboard editing works");

  assert.equal(canonicalSnapshot(), canonicalBefore);
  assert.equal(await publishedSnapshot(), publicBefore);
  const privateAnonymous = await anonymous.from("content_work_items").select("id");
  assert(privateAnonymous.error || privateAnonymous.data.length === 0);
  checked("canonical/public snapshots remain byte-identical and anonymous clients cannot inspect editorial work");
} catch (error) {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const secret of secrets) message = message.replaceAll(secret, "[redacted]");
  result.error = message;
  console.error(`FAIL ${message}`);
  if (page && !page.isClosed()) await screenshot(page, "failure").catch(() => {});
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server?.pid && server.exitCode === null) {
    try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch { /* Already exited. */ }
  }
  if (logFd !== undefined) closeSync(logFd);
  try {
    if (users.length) {
      // Discover this run's work IDs even if an assertion failed immediately after opening.
      const userIds = users.map((user) => literal(user.id)).join(",");
      const extraWork = sql(`select id from public.content_work_items where created_by in (${userIds});`).split("\n").filter(Boolean);
      for (const id of extraWork) if (!workItemIds.includes(id)) workItemIds.push(id);
      const extraCanonical = sql(`select id from public.scholarships where created_by in (${userIds}) union select id from public.news_articles where created_by in (${userIds});`).split("\n").filter(Boolean);
      for (const id of extraCanonical) if (!canonicalIds.includes(id)) canonicalIds.push(id);
      // History is immutable for application callers. Fixture cleanup is constrained to
      // exact synthetic IDs in the known isolated database and one postgres transaction.
      sql(`begin;
        set local session_replication_role = replica;
        ${workItemIds.length ? `delete from private.content_command_receipts where work_item_id in (${workItemIds.map(literal).join(",")});
        delete from public.content_review_decisions where work_item_id in (${workItemIds.map(literal).join(",")});
        delete from public.content_versions where work_item_id in (${workItemIds.map(literal).join(",")});
        delete from public.content_snapshots where work_item_id in (${workItemIds.map(literal).join(",")});
        delete from public.content_source_verifications where work_item_id in (${workItemIds.map(literal).join(",")});
        delete from public.content_work_items where id in (${workItemIds.map(literal).join(",")});` : ""}
        delete from public.scholarships where id in (${canonicalIds.map(literal).join(",")});
        delete from public.news_articles where id in (${canonicalIds.map(literal).join(",")});
        commit;`);
      for (const user of users) assert(!(await admin.auth.admin.deleteUser(user.id)).error, "Local Auth fixture cleanup failed.");
      const auditFixtureIds = [...canonicalIds, ...workItemIds, ...users.map((user) => user.id)];
      sql(`delete from private.audit_logs where actor_id in (${userIds}) or record_id in (${auditFixtureIds.map(literal).join(",")});`);
      assert.equal(sql(`select count(*) from auth.users where id in (${userIds});`), "0");
      assert.equal(sql(`select count(*) from public.scholarships where id in (${canonicalIds.map(literal).join(",")});`), "0");
      assert.equal(sql(`select count(*) from public.news_articles where id in (${canonicalIds.map(literal).join(",")});`), "0");
      if (workItemIds.length) assert.equal(sql(`select count(*) from public.content_work_items where id in (${workItemIds.map(literal).join(",")});`), "0");
    }
    result.cleanup = true;
  } catch (error) {
    result.cleanupError = error instanceof Error ? error.message : String(error);
    console.error("FAIL isolated QA fixture cleanup; inspect result file.");
    process.exitCode = 1;
  }
  result.externalBrowserRequestsBlocked = [...new Set(result.externalBrowserRequestsBlocked)];
  mkdirSync(qaDir, { recursive: true });
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`QA result: ${resultPath}`);
  console.log(`QA Next log: ${logPath}`);
  console.log(`Synthetic fixtures removed: ${result.cleanup}`);
}
