// Opt-in isolated QA only: node tests/content-visual-browser.mjs --run-local-content-visual
// Focused panel regression: add --panel-regression-only to the command above.
// Uses its own loopback Next preview and synthetic fixtures; never loads repository credentials.
import assert from "node:assert/strict";
import sharp from "sharp";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect as playwrightExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

assert(process.argv.includes("--run-local-content-visual"), "Explicit --run-local-content-visual is required.");
const expect = playwrightExpect.configure({ timeout: 25000 });
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qaDir = path.join(process.env.LOCALAPPDATA ?? "", "Temp", "iroup-stability-local-20261021");
const container = "supabase_db_iroup-stability-local-20261021";
const api = "http://127.0.0.1:30321";
const site = "http://127.0.0.1:3105";
const runId = randomUUID().slice(0, 8);
const prefix = `QA Content Visual ${runId}`;
const scholarshipId = randomUUID();
const newsId = randomUUID();
const users = [];
const canonicalIds = [scholarshipId, newsId];
const workItemIds = [];
const assetIds = [];
let publishableKey;
const secrets = [];
const result = { checks: [], screenshots: [], externalBrowserRequestsBlocked: [], cleanup: false };
const logPath = path.join(qaDir, `content-visual-next-${runId}.log`);
const resultPath = path.join(qaDir, `content-visual-result-${runId}.json`);
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
async function publishedSnapshot() {
  const [scholarship, news] = await Promise.all([
    anonymous.from("scholarships_public").select("*").eq("id", scholarshipId).single(),
    anonymous.from("news_public").select("*").eq("id", newsId).single(),
  ]);
  assert(!scholarship.error && !news.error, "Anonymous canonical fixture read failed.");
  return JSON.stringify({ scholarship: scholarship.data, news: news.data });
}
async function screenshot(targetPage, name) {
  const file = path.join(qaDir, `content-visual-${name}-${runId}.png`);
  // Fixed shell controls should appear at the top of a full-page capture.
  await targetPage.evaluate(() => window.scrollTo(0, 0));
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
  const email = `content-visual-${users.length}-${runId}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Local Content Visual ${role}` } });
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
  publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
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

async function signedClient(user) {
  const client = createClient(api, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert(!signed.error, "Local fixture sign-in failed.");
  secrets.push(signed.data.session.access_token, signed.data.session.refresh_token);
  return client;
}

async function rpc(client, name, args) {
  const response = await client.rpc(name, args);
  assert(!response.error, `${name}: ${response.error?.message}`);
  return response.data;
}

async function inspect(client, workItemId) {
  return rpc(client, "content_visual_inspect", { p_work_item_id: workItemId });
}

async function seedApproved(client, kind, recordId) {
  let current = await rpc(client, "content_core_execute", { p_command: {
    op: "open", kind, record_id: recordId, title_th: "", idempotency_key: randomUUID(),
  } });
  workItemIds.push(current.work_item_id);
  const sourceUrl = `https://example.test/${runId}/${kind}`;
  const today = sql("select (now() at time zone 'Asia/Bangkok')::date;");
  const validUntil = sql("select (now() at time zone 'Asia/Bangkok')::date + 7;");
  current = await rpc(client, "content_core_execute", { p_command: {
    op: "record_source", work_item_id: current.work_item_id, expected_revision: current.row_version,
    idempotency_key: randomUUID(), source: { title: "Synthetic official source", publisher: "QA source owner",
      requested_url: sourceUrl, final_url: sourceUrl, observed_on: today, valid_until: validUntil,
      official: true, result: "verified", note: `PRIVATE_SOURCE_${runId}` },
  } });
  const sourceId = current.source_verification_id;
  const facts = { subject: `${prefix} ${kind} approved facts`, key_points: "Verified synthetic factual notes", category: "QA",
    scholarship_type: "", audience: "both", funding_type: "", study_level: "", eligibility: "", detail_url: "", apply_url: "" };
  const locales = { th: { title: `${prefix} ไทย`, summary: "สรุปสำหรับทดสอบ", body: "เนื้อหาไทยสำหรับทดสอบภาพ", coverage: "" },
    en: { title: `${prefix} English`, summary: "Synthetic summary", body: "Synthetic editorial body", coverage: "" } };
  const deadlines = kind === "scholarship" ? ["university_internal", "thai_nominating_body", "scholarship_owner"].map(deadlineKind => ({
    kind: deadlineKind, applicability: "not_applicable", reason: "No application in synthetic visual test", cycle_key: "QA", raw_text: "",
    precision: "date_only", date: null, time: null, timezone: null, instant: null, source_verification_id: null,
  })) : [];
  current = await rpc(client, "content_core_execute", { p_command: {
    op: "save_draft", work_item_id: current.work_item_id, expected_revision: current.row_version, idempotency_key: randomUUID(),
    channel: "website", facts, source_verification_ids: [sourceId], deadlines, locales,
  } });
  const versionId = current.version_id;
  for (const decision of ["submit", "approve"]) current = await rpc(client, "content_core_execute", { p_command: {
    op: "review", work_item_id: current.work_item_id, expected_revision: current.row_version,
    idempotency_key: randomUUID(), version_id: versionId, decision, note: "Synthetic approved content",
  } });
  return { workItemId: current.work_item_id, versionId, sourceId, sourceUrl, facts, locales, deadlines };
}

async function revision(client, workId) { return (await inspect(client, workId)).work_item.row_version; }
async function waitRevision(client, workId, before) {
  await expect.poll(() => revision(client, workId)).toBeGreaterThan(before);
}
async function fillBrief(targetPage, { versionId, title = `${prefix} brief`, panels = 2 } = {}) {
  if (versionId) await targetPage.locator('[name="brief_content_version"]').selectOption(versionId);
  const form = targetPage.getByTestId("visual-brief-form");
  if (!await form.locator('[name="prompt"]').isVisible()) await form.locator("details > summary").click();
  const values = { title, objective: "Communicate verified scholarship and news facts", audience: "Students and staff",
    key_message: "Exact content version controls the visual", design_notes: "Readable Thai and English with generous margins",
    brand_notes: "Synthetic local QA graphics only", prompt: "Manual prompt package; no provider has generated an image",
    negative_prompt: "No unsupported facts or private contact details", width: "1200", height: "630",
    panel_0_key: "hero", panel_0_label: "ภาพหลัก", panel_0_notes: "Main semantic panel" };
  for (const [name, value] of Object.entries(values)) await form.locator(`[name="${name}"]`).fill(value);
  if (panels === 2) {
    if (!await form.locator('[name="panel_1_key"]').count()) await form.getByRole("button", { name: "เพิ่มแผงภาพ", exact: true }).click();
    for (const [field, value] of Object.entries({ key: "details", label: "รายละเอียด", notes: "Supporting semantic panel" })) {
      await form.locator(`[name="panel_1_${field}"]`).fill(value);
    }
  }
  return form;
}

async function saveForm(targetPage, client, workId, testId) {
  const before = await revision(client, workId);
  await targetPage.getByTestId(testId).locator('button[type="submit"]').click();
  await waitRevision(client, workId, before);
  await expect(targetPage.getByTestId("visual-workspace")).toHaveAttribute("data-revision", String(await revision(client, workId)));
  return inspect(client, workId);
}

async function decide(targetPage, client, workId, targetId, decision, note = "") {
  const form = targetPage.getByTestId(`visual-review-${targetId}`);
  if (note) await form.locator('[name="note"]').fill(note);
  const before = await revision(client, workId);
  await form.locator(`[name="decision"][value="${decision}"]`).click();
  await waitRevision(client, workId, before);
  await expect(targetPage.getByTestId("visual-workspace")).toHaveAttribute("data-revision", String(await revision(client, workId)));
  return inspect(client, workId);
}

async function fillUpload(targetPage, briefId, { parentId = "", sourceKind = "manual_upload" } = {}) {
  await targetPage.locator('[name="asset_brief_id"]').selectOption(briefId);
  const form = targetPage.getByTestId("visual-upload-form");
  await form.locator('[name="source_kind"]').selectOption(sourceKind);
  await form.locator('[name="rights_basis"]').selectOption("owned");
  await form.locator('[name="rights_note"]').fill("Synthetic raster generated by this local QA script; test fixture rights only.");
  await form.locator('[name="attribution"]').fill("Local automated QA fixture");
  await form.locator('[name="origin_url"]').fill("https://example.test/manual-fixture");
  await form.locator('[name="parent_asset_id"]').selectOption(parentId);
  return form;
}

async function upload(targetPage, client, workId, briefId, name, mimeType, buffer, options) {
  const form = await fillUpload(targetPage, briefId, options);
  const before = await inspect(client, workId);
  await form.locator('[name="image"]').setInputFiles({ name, mimeType, buffer });
  await form.locator('button[type="submit"]').click();
  await waitRevision(client, workId, before.work_item.row_version);
  const after = await inspect(client, workId);
  await expect(targetPage.getByTestId("visual-workspace")).toHaveAttribute("data-revision", String(after.work_item.row_version));
  const asset = after.assets.find(item => !before.assets.some(previous => previous.id === item.id));
  assert(asset, "Successful upload must create an immutable asset.");
  assetIds.push(asset.id);
  assert.equal(asset.uploaded_sha256, createHash("sha256").update(buffer).digest("hex"));
  assert.equal(asset.width, 1200);
  assert.equal(asset.height, 630);
  assert.equal(asset.mime_type, mimeType);
  const stored = JSON.parse(sql(`select jsonb_build_object('bucket',storage_bucket,'path',storage_path,'public',is_public) from public.assets where id=${literal(asset.id)};`));
  assert.equal(stored.bucket, "content-working");
  assert.equal(stored.public, false);
  const downloaded = await admin.storage.from(stored.bucket).download(stored.path);
  assert(!downloaded.error);
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  assert.equal(bytes.length, asset.size_bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert(!metadata.exif && !metadata.icc, "Normalized image must not retain private EXIF or ICC metadata.");
  await expect(targetPage.getByTestId(`visual-preview-${asset.id}`)).toBeVisible();
  return asset;
}

function storageCount(workId) {
  return Number(sql(`select count(*) from storage.objects where bucket_id='content-working' and name like '%' || ${literal(workId)} || '%';`));
}

try {
  testRun: {
  await startIsolatedPreview();
  const owner = await createUser("system_admin");
  const editor = await createUser("editor", [{ module: "news", create: true, update: true }]);
  const viewer = await createUser("viewer", [{ module: "news" }, { module: "scholarship" }]);
  const denied = await createUser("editor", [{ module: "travel", create: true, update: true }]);
  const ownerClient = await signedClient(owner);
  const editorClient = await signedClient(editor);
  const deniedClient = await signedClient(denied);
  sql(`insert into public.scholarships(id,title_th,title_en,publication_status,public_visible,internal_note,created_by)
    values(${literal(scholarshipId)},${literal(`${prefix} Published scholarship`)},'Published scholarship','published',true,${literal(`PRIVATE_CANONICAL_${runId}`)},${literal(owner.id)});
    insert into public.news_articles(id,title_th,title_en,publication_status,public_visible,internal_note,created_by)
    values(${literal(newsId)},${literal(`${prefix} Published news`)},'Published news','published',true,${literal(`PRIVATE_CANONICAL_${runId}`)},${literal(owner.id)});`);
  const canonicalBefore = canonicalSnapshot();
  const publicBefore = await publishedSnapshot();
  const news = await seedApproved(ownerClient, "news", newsId);
  const scholarship = await seedApproved(ownerClient, "scholarship", scholarshipId);
  page = await signedInPage(owner);
  const visualUrl = `${site}/content-production/news/${newsId}/visual`;
  await page.goto(visualUrl);
  if (process.argv.includes("--panel-regression-only")) {
    const panelForm = await fillBrief(page, { versionId: news.versionId, panels: 1 });
    await panelForm.getByRole("button", { name: "เพิ่มแผงภาพ", exact: true }).click();
    await panelForm.getByRole("button", { name: "เพิ่มแผงภาพ", exact: true }).click();
    await panelForm.locator('[name="panel_2_label"]').fill("Keep third panel");
    await panelForm.locator('[name="panel_2_notes"]').fill("Keep semantic notes after removing its predecessor");
    await panelForm.getByRole("button", { name: "ลบแผงที่ 2", exact: true }).click();
    await panelForm.getByRole("button", { name: "เพิ่มแผงภาพ", exact: true }).click();
    await panelForm.locator('[name="panel_2_label"]').fill("Replacement panel");
    const keys = await panelForm.locator('input[name^="panel_"][name$="_key"]').evaluateAll(inputs => inputs.map(input => input.value));
    assert.deepEqual(keys, ["hero", "panel_3", "panel_2"]);
    assert.equal(new Set(keys).size, 3);
    await expect(panelForm.locator('[name="panel_1_label"]')).toHaveValue("Keep third panel");
    await expect(panelForm.locator('[name="panel_1_notes"]')).toHaveValue("Keep semantic notes after removing its predecessor");
    const panelState = await saveForm(page, ownerClient, news.workItemId, "visual-brief-form");
    assert.deepEqual(panelState.briefs[0].brief.panels.map(panel => panel.key), keys);
    assert.equal(canonicalSnapshot(), canonicalBefore);
    assert.equal(await publishedSnapshot(), publicBefore);
    await screenshot(page, "panel-regression");
    checked("adding three panels, removing the middle and adding again keeps unique semantic keys and preserved notes through save");
    break testRun;
  }
  await fillBrief(page, { versionId: news.versionId });
  let state = await saveForm(page, ownerClient, news.workItemId, "visual-brief-form");
  let brief = state.briefs.find(item => item.is_latest);
  assert.equal(brief.content_version_id, news.versionId);
  assert.equal(brief.brief.prompt, "Manual prompt package; no provider has generated an image");
  assert.deepEqual(brief.brief.panels.map(item => item.key), ["hero", "details"]);
  checked("visual brief pins approved content and retains manual prompt package plus ordered semantic panels");
  state = await decide(page, ownerClient, news.workItemId, brief.id, "submit");
  assert.equal(state.briefs.find(item => item.id === brief.id).state, "under_review");
  state = await decide(page, ownerClient, news.workItemId, brief.id, "approve");
  assert.equal(state.briefs.find(item => item.id === brief.id).state, "approved");
  checked("brief has a separate submit and approval gate");

  const png = await sharp({ create: { width: 1200, height: 630, channels: 4, background: { r: 42, g: 73, b: 104, alpha: 1 } } }).png().toBuffer();
  const jpeg = await sharp({ create: { width: 1200, height: 630, channels: 3, background: { r: 226, g: 143, b: 53 } } }).jpeg().withMetadata().toBuffer();
  const invalidInputs = [
    { label: "forged MIME/signature", name: "spoof.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') },
    { label: "truncated PNG", name: "broken.png", mimeType: "image/png", buffer: png.subarray(0, 40) },
    { label: "mismatched brief dimensions", name: "small.png", mimeType: "image/png", buffer: await sharp({ create: { width: 32, height: 32, channels: 3, background: "red" } }).png().toBuffer() },
  ];
  for (const invalid of invalidInputs) {
    const form = await fillUpload(page, brief.id);
    const before = await inspect(ownerClient, news.workItemId);
    const objectCount = storageCount(news.workItemId);
    await form.locator('[name="image"]').setInputFiles(invalid);
    await form.locator('button[type="submit"]').click();
    await expect(form).toHaveAttribute("aria-busy", "false");
    await expect(form.getByTestId("visual-command-error")).toBeVisible();
    const after = await inspect(ownerClient, news.workItemId);
    assert.equal(after.work_item.row_version, before.work_item.row_version);
    assert.equal(after.assets.length, before.assets.length);
    assert.equal(storageCount(news.workItemId), objectCount);
  }
  checked("signature spoof, truncated image and wrong dimensions fail before any asset or binary is stored");

  const firstAsset = await upload(page, ownerClient, news.workItemId, brief.id, "manual-fixture.png", "image/png", png);
  const secondAsset = await upload(page, ownerClient, news.workItemId, brief.id, "manual-revision.jpg", "image/jpeg", jpeg, { parentId: firstAsset.id, sourceKind: "canva_export" });
  assert.equal(secondAsset.parent_asset_id, firstAsset.id);
  assert.equal(secondAsset.source_kind, "canva_export");
  assert.equal(secondAsset.rights_basis, "owned");
  checked("manual and Canva uploads preserve provenance and lineage with server-verified normalized bytes, dimensions and SHA256");

  const previewPath = `/api/content-visual/assets/${firstAsset.id}`;
  const preview = await page.request.get(`${site}${previewPath}`);
  assert.equal(preview.status(), 200);
  assert.match(preview.headers()["cache-control"] ?? "", /no-store/);
  assert.equal(createHash("sha256").update(await preview.body()).digest("hex"), firstAsset.sha256);
  const anonymousPreview = await fetch(`${site}${previewPath}`, { redirect: "manual" });
  assert(anonymousPreview.status !== 200);
  const storage = JSON.parse(sql(`select jsonb_build_object('bucket',storage_bucket,'path',storage_path) from public.assets where id=${literal(firstAsset.id)};`));
  const directRead = await ownerClient.storage.from(storage.bucket).download(storage.path);
  assert(directRead.error, "Authenticated direct storage access must not bypass per-request proxy authorization.");
  const overwrite = await ownerClient.storage.from(storage.bucket).upload(storage.path, png, { contentType: "image/png", upsert: true });
  assert(overwrite.error, "Authenticated overwrite must fail.");
  await ownerClient.storage.from(storage.bucket).remove([storage.path]);
  const stillStored = await admin.storage.from(storage.bucket).download(storage.path);
  assert(!stillStored.error, "Immutable binary must survive unauthorized delete.");
  const publicBinary = await fetch(`${api}/storage/v1/object/public/content-working/${storage.path}`);
  assert(publicBinary.status !== 200);
  checked("private image proxy serves exact bytes; anonymous/public access and direct authenticated storage read/overwrite/delete are denied");

  const setForm = page.getByTestId("visual-asset-set-form");
  for (const [index, asset] of [firstAsset, secondAsset].entries()) {
    await setForm.locator(`[name="slot_${index}_asset_id"]`).selectOption(asset.id);
    await setForm.locator(`[name="slot_${index}_alt_text_th"]`).fill(index ? "ภาพรายละเอียดประกอบข่าว" : "ภาพหลักประกอบข่าว");
    await setForm.locator(`[name="slot_${index}_alt_text_en"]`).fill(index ? "" : "Main news illustration");
  }
  state = await saveForm(page, ownerClient, news.workItemId, "visual-asset-set-form");
  const incompleteSet = state.asset_sets.find(item => item.is_latest);
  await page.getByTestId(`visual-review-${incompleteSet.id}`).locator('[name="decision"][value="submit"]').click();
  await expect(page.getByTestId(`visual-review-${incompleteSet.id}`)).toHaveAttribute("aria-busy", "false");
  await expect(page.getByTestId(`visual-review-${incompleteSet.id}`).getByTestId("visual-command-error")).toBeVisible();
  assert.equal(await revision(ownerClient, news.workItemId), state.work_item.row_version);
  await setForm.locator('[name="slot_1_alt_text_en"]').fill("Supporting news illustration");
  state = await saveForm(page, ownerClient, news.workItemId, "visual-asset-set-form");
  const originalSet = state.asset_sets.find(item => item.is_latest);
  assert.deepEqual(originalSet.slots.map(item => item.asset_id), [firstAsset.id, secondAsset.id]);
  await decide(page, ownerClient, news.workItemId, originalSet.id, "submit");
  state = await decide(page, ownerClient, news.workItemId, originalSet.id, "approve");
  assert.equal(state.asset_sets.find(item => item.id === originalSet.id).state, "approved");
  checked("incomplete bilingual alt text can be drafted but not submitted; complete ordered asset set requires its own approval");

  // Exact RPC retry tests the real actor-scoped receipt, independently of button disabling.
  const slots = [...originalSet.slots].reverse();
  await page.getByTestId("visual-slot-down-hero").click();
  await expect(setForm.locator('[name="slot_0_panel_key"]')).toHaveValue("details");
  await expect(setForm.locator('[name="slot_0_alt_text_en"]')).toHaveValue("Supporting news illustration");
  const setCommand = { op: "save_set", work_item_id: news.workItemId, expected_revision: await revision(ownerClient, news.workItemId),
    idempotency_key: randomUUID(), brief_id: brief.id, slots };
  const saved = await rpc(ownerClient, "content_visual_execute", { p_command: setCommand });
  assert.deepEqual(await rpc(ownerClient, "content_visual_execute", { p_command: setCommand }), saved);
  const collision = await ownerClient.rpc("content_visual_execute", { p_command: { ...setCommand, slots: originalSet.slots } });
  assert.match(collision.error?.message ?? "", /IDEMPOTENCY_CONFLICT/);
  state = await inspect(ownerClient, news.workItemId);
  const successorSet = state.asset_sets.find(item => item.id === saved.asset_set_id);
  assert.deepEqual(successorSet.slots, slots);
  assert.equal(successorSet.based_on_id, originalSet.id);
  assert.deepEqual(state.asset_sets.find(item => item.id === originalSet.id).slots, originalSet.slots);
  checked("reordering creates immutable asset-set successor; exact retry returns one receipt and altered payload conflicts");

  const viewerPage = await signedInPage(viewer);
  await viewerPage.goto(visualUrl);
  await expect(viewerPage.getByTestId("visual-readonly")).toBeVisible();
  await expect(viewerPage.getByTestId("visual-upload-form")).toHaveCount(0);
  await expect(viewerPage.getByTestId(`visual-preview-${firstAsset.id}`)).toBeVisible();
  assert.equal((await viewerPage.request.get(`${site}${previewPath}`)).status(), 200);
  const deniedPage = await signedInPage(denied);
  await deniedPage.goto(visualUrl);
  await expect(deniedPage.getByTestId("visual-upload-form")).toHaveCount(0);
  assert.notEqual((await deniedPage.request.get(`${site}${previewPath}`)).status(), 200);
  const deniedInspect = await deniedClient.rpc("content_visual_inspect", { p_work_item_id: news.workItemId });
  assert(deniedInspect.error || deniedInspect.data === null);
  sql(`update public.profiles set active=false where id=${literal(viewer.id)};`);
  assert.notEqual((await viewerPage.request.get(`${site}${previewPath}`)).status(), 200);
  checked("viewer can inspect private images; unrelated module and deactivated sessions cannot read through proxy or RPC");

  const editorPage = await signedInPage(editor);
  await editorPage.goto(visualUrl);
  await expect(editorPage.locator('[name="decision"][value="approve"]')).toHaveCount(0);
  const unauthorizedApproval = await editorClient.rpc("content_visual_execute", { p_command: {
    op: "review_set", work_item_id: news.workItemId, expected_revision: await revision(ownerClient, news.workItemId), idempotency_key: randomUUID(),
    asset_set_id: successorSet.id, decision: "approve", note: "Unauthorized QA attempt",
  } });
  assert.match(unauthorizedApproval.error?.message ?? "", /FORBIDDEN/);
  const unauthorizedFinalize = await editorClient.rpc("content_visual_finalize_upload", { p_actor_id: editor.id, p_upload_id: randomUUID(), p_verified: {} });
  assert(unauthorizedFinalize.error, "Browser role must not call trusted image finalizer.");
  checked("editor can author but cannot approve or invoke trusted upload finalization");

  await page.goto(visualUrl);
  await fillBrief(page, { title: `${prefix} successor brief` });
  const stalePage = await page.context().newPage();
  await stalePage.goto(visualUrl);
  await fillBrief(stalePage, { title: `${prefix} unsaved stale input` });
  state = await saveForm(page, ownerClient, news.workItemId, "visual-brief-form");
  await stalePage.getByTestId("visual-brief-form").locator('button[type="submit"]').click();
  await expect(stalePage.getByTestId("visual-brief-form")).toHaveAttribute("aria-busy", "false");
  await expect(stalePage.getByTestId("visual-brief-form").getByTestId("visual-command-error")).toBeVisible();
  await expect(stalePage.getByTestId("visual-brief-form").locator('[name="title"]')).toHaveValue(`${prefix} unsaved stale input`);
  assert.equal((await inspect(ownerClient, news.workItemId)).work_item.row_version, state.work_item.row_version);
  assert.equal(state.asset_sets.find(item => item.id === successorSet.id).state, "stale");
  checked("concurrent stale-tab save preserves unsaved input; new brief makes previous selected asset sets stale");

  // A new source observation supersedes the old verification without touching it.
  await rpc(ownerClient, "content_core_execute", { p_command: {
    op: "record_source", work_item_id: news.workItemId, expected_revision: state.work_item.row_version, idempotency_key: randomUUID(),
    source: { title: "Updated source result", publisher: "QA source owner", requested_url: news.sourceUrl, final_url: news.sourceUrl,
      observed_on: sql("select (now() at time zone 'Asia/Bangkok')::date;"), valid_until: sql("select (now() at time zone 'Asia/Bangkok')::date+7;"),
      official: true, result: "unverified", note: "Source is no longer verified" },
  } });
  state = await inspect(ownerClient, news.workItemId);
  assert(state.briefs.every(item => item.state === "stale"));
  assert(state.asset_sets.every(item => item.state === "stale"));
  const currentBrief = state.briefs.find(item => item.is_latest);
  const staleSubmit = await ownerClient.rpc("content_visual_execute", { p_command: {
    op: "review_brief", work_item_id: news.workItemId, expected_revision: state.work_item.row_version, idempotency_key: randomUUID(),
    brief_id: currentBrief.id, decision: "submit", note: "Attempt after source became stale",
  } });
  assert(staleSubmit.error);
  checked("superseding source verification dynamically stales downstream visuals and blocks further review");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${site}/content-production/scholarship/${scholarshipId}/visual`);
  await fillBrief(page, { versionId: scholarship.versionId, title: `${prefix} Scholarship mobile`, panels: 1 });
  await page.getByTestId("visual-brief-form").locator('[name="objective"]').focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" keyboard");
  await expect(page.getByTestId("visual-brief-form").locator('[name="objective"]')).toHaveValue(/keyboard$/);
  await noOverflow(page, "mobile visual workspace");
  await screenshot(page, "mobile");
  await saveForm(page, ownerClient, scholarship.workItemId, "visual-brief-form");
  checked("Scholarship visual brief works on 390px viewport with keyboard editing and no horizontal overflow");

  assert.equal(canonicalSnapshot(), canonicalBefore);
  assert.equal(await publishedSnapshot(), publicBefore);
  assert.equal(sql(`select count(*) from public.record_assets where scholarship_id=${literal(scholarshipId)} or news_id=${literal(newsId)};`), "0");
  for (const table of ["visual_brief_versions", "content_manual_assets", "content_asset_sets", "content_visual_reviews"]) {
    const read = await anonymous.from(table).select("*").limit(1);
    assert(read.error || read.data.length === 0, `Anonymous ${table} leak.`);
  }
  await page.goto(visualUrl);
  await screenshot(page, "history");
  checked("canonical/public projections and record_assets remain unchanged; anonymous clients cannot read visual metadata");
  }
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
      const userIds = users.map(user => literal(user.id)).join(",");
      for (const id of sql(`select id from public.content_work_items where created_by in (${userIds});`).split("\n").filter(Boolean)) {
        if (!workItemIds.includes(id)) workItemIds.push(id);
      }
      const workIds = workItemIds.map(literal).join(",");
      if (workItemIds.length) {
        for (const id of sql(`select asset_id from public.content_manual_assets where work_item_id in (${workIds});`).split("\n").filter(Boolean)) {
          if (!assetIds.includes(id)) assetIds.push(id);
        }
        const objects = JSON.parse(sql(`select coalesce(jsonb_agg(name),'[]'::jsonb) from storage.objects where bucket_id='content-working' and (${workItemIds.map(id => `name like '%' || ${literal(id)} || '%'`).join(" or ")});`));
        if (objects.length) {
          const removed = await admin.storage.from("content-working").remove(objects);
          assert(!removed.error, "Local Storage fixture removal failed.");
        }
        sql(`begin; set local session_replication_role=replica;
          delete from private.content_visual_receipts where work_item_id in (${workIds});
          delete from public.content_visual_reviews where work_item_id in (${workIds});
          delete from public.content_asset_sets where work_item_id in (${workIds});
          delete from public.content_manual_assets where work_item_id in (${workIds});
          delete from private.content_visual_uploads where work_item_id in (${workIds});
          delete from public.visual_brief_versions where work_item_id in (${workIds});
          ${assetIds.length ? `delete from public.assets where id in (${assetIds.map(literal).join(",")});` : ""}
          delete from private.content_command_receipts where work_item_id in (${workIds});
          delete from public.content_review_decisions where work_item_id in (${workIds});
          delete from public.content_versions where work_item_id in (${workIds});
          delete from public.content_snapshots where work_item_id in (${workIds});
          delete from public.content_source_verifications where work_item_id in (${workIds});
          delete from public.content_work_items where id in (${workIds});
          commit;`);
      }
      sql(`begin; set local session_replication_role=replica;
        delete from public.scholarships where id in (${canonicalIds.map(literal).join(",")});
        delete from public.news_articles where id in (${canonicalIds.map(literal).join(",")}); commit;`);
      for (const user of users) assert(!(await admin.auth.admin.deleteUser(user.id)).error, "Local Auth fixture cleanup failed.");
      sql(`delete from private.audit_logs where actor_id in (${userIds}) or record_id in (${[...canonicalIds, ...workItemIds, ...assetIds, ...users.map(user => user.id)].map(literal).join(",")});`);
      assert.equal(sql(`select count(*) from auth.users where id in (${userIds});`), "0");
      if (workItemIds.length) assert.equal(sql(`select count(*) from public.content_work_items where id in (${workIds});`), "0");
      if (assetIds.length) assert.equal(sql(`select count(*) from public.assets where id in (${assetIds.map(literal).join(",")});`), "0");
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
