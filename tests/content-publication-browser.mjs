// Opt-in isolated QA only: node tests/content-publication-browser.mjs --run-local-content-publication
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

assert(process.argv.includes("--run-local-content-publication"), "Explicit --run-local-content-publication is required.");
const expect = playwrightExpect.configure({ timeout: 25000 });
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qaDir = path.join(process.env.LOCALAPPDATA ?? "", "Temp", "iroup-stability-local-20261021");
const container = "supabase_db_iroup-stability-local-20261021";
const api = "http://127.0.0.1:30321";
const site = "http://127.0.0.1:3105";
const runId = randomUUID().slice(0, 8);
const prefix = `QA Content Publication ${runId}`;
const scholarshipId = randomUUID();
const newsId = randomUUID();
const users = [];
const canonicalIds = [scholarshipId, newsId];
const workItemIds = [];
const assetIds = [];
let publishableKey;
const secrets = [];
const result = { checks: [], screenshots: [], externalBrowserRequestsBlocked: [], cleanup: false };
const logPath = path.join(qaDir, `content-publication-next-${runId}.log`);
const resultPath = path.join(qaDir, `content-publication-result-${runId}.json`);
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
  const file = path.join(qaDir, `content-publication-${name}-${runId}.png`);
  // Next navigation can briefly replace a just-observed panel with its loading
  // boundary; full-page capture also does not eagerly load off-screen images.
  await targetPage.waitForLoadState("networkidle");
  await expect(targetPage.getByTestId("bundle-workspace")).toBeVisible();
  const images = targetPage.getByTestId("bundle-preview").locator("img");
  for (let index = 0; index < await images.count(); index++) {
    await images.nth(index).scrollIntoViewIfNeeded();
    await expect.poll(() => images.nth(index).evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  // Fixed shell controls should appear at the top of a full-page capture.
  await targetPage.evaluate(() => window.scrollTo(0, 0));
  await targetPage.waitForLoadState("networkidle");
  await expect(targetPage.getByTestId("bundle-workspace")).toBeVisible();
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
  const email = `content-publication-${users.length}-${runId}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Local Content Publication ${role}` } });
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

async function visualInspect(client, workItemId) {
  return rpc(client, "content_visual_inspect", { p_work_item_id: workItemId });
}


async function inspect(client, workItemId, bundleId = null) {
  return rpc(client, "content_publication_inspect", { p_work_item_id: workItemId, p_bundle_id: bundleId });
}
async function revision(client, workId) { return (await visualInspect(client, workId)).work_item.row_version; }
async function command(client, name, workId, value) {
  return rpc(client, name, { p_command: { work_item_id: workId, expected_revision: await revision(client, workId), idempotency_key: randomUUID(), ...value } });
}
async function seedApproved(client, kind, recordId) {
  const current = await rpc(client, "content_core_execute", { p_command: { op: "open", kind, record_id: recordId, title_th: "", idempotency_key: randomUUID() } });
  const workItemId = current.work_item_id;
  workItemIds.push(workItemId);
  const sourceUrl = `https://example.test/${runId}/${kind}`;
  const source = { title: "Synthetic official source", publisher: "QA source owner", requested_url: sourceUrl, final_url: sourceUrl,
    observed_on: sql("select (now() at time zone 'Asia/Bangkok')::date;"), valid_until: sql("select (now() at time zone 'Asia/Bangkok')::date + 7;"),
    official: true, result: "verified", note: `PRIVATE_SOURCE_${runId}` };
  const sourceResult = await command(client, "content_core_execute", workItemId, { op: "record_source", source });
  const facts = { subject: `${prefix} ${kind} approved facts`, key_points: `PRIVATE_FACT_NOTES_${runId}`, category: "QA", scholarship_type: "", audience: "both",
    funding_type: "", study_level: "", eligibility: "", detail_url: "", apply_url: "" };
  const deadlines = kind === "scholarship" ? ["university_internal", "thai_nominating_body", "scholarship_owner"].map(deadlineKind => ({
    kind: deadlineKind, applicability: "not_applicable", reason: "Synthetic local fixture", cycle_key: "QA", raw_text: "", precision: "date_only", date: null,
    time: null, timezone: null, instant: null, source_verification_id: null,
  })) : [];
  const fixture = { kind, recordId, workItemId, source, sourceId: sourceResult.source_verification_id, facts, deadlines, versions: {}, visuals: {} };
  for (const channel of ["website", "facebook"]) {
    const locales = { th: { title: `${prefix} ${channel} ไทย`, summary: `สรุป ${channel}`, body: `เนื้อหาไทย ${channel}\n<script>fixture text only</script>`, coverage: "เนื้อหาทดสอบ" },
      en: { title: `${prefix} ${channel} English`, summary: `Summary ${channel}`, body: `English body ${channel}\n<script>fixture text only</script>`, coverage: "Synthetic coverage" } };
    const draft = await command(client, "content_core_execute", workItemId, { op: "save_draft", channel, facts, deadlines, locales, source_verification_ids: [fixture.sourceId] });
    for (const decision of ["submit", "approve"]) await command(client, "content_core_execute", workItemId, { op: "review", version_id: draft.version_id, decision, note: "Synthetic approved content" });
    fixture.versions[channel] = { id: draft.version_id, locales };
  }
  return fixture;
}
async function approvedVisual(client, actor, fixture, channel) {
  const briefInput = { title: `${channel} synthetic brief`, objective: "Approved visual for private preparation", audience: "Students and staff", key_message: "Verified synthetic content",
    design_notes: `PRIVATE_DESIGN_${runId}`, brand_notes: `PRIVATE_BRAND_${runId}`, prompt: `PRIVATE_PROMPT_${runId}`, negative_prompt: `PRIVATE_NEGATIVE_${runId}`,
    width: 320, height: 180, panels: [{ key: "hero", label: "ภาพหลัก", notes: `PRIVATE_PANEL_${runId}` }, { key: "details", label: "รายละเอียด", notes: "Private working guidance" }] };
  const brief = await command(client, "content_visual_execute", fixture.workItemId, { op: "save_brief", content_version_id: fixture.versions[channel].id, brief: briefInput });
  for (const decision of ["submit", "approve"]) await command(client, "content_visual_execute", fixture.workItemId, { op: "review_brief", brief_id: brief.brief_id, decision, note: "Synthetic approved brief" });
  const assets = [];
  for (const [index, color] of ["#244960", "#db9042"].entries()) {
    const bytes = await sharp({ create: { width: 320, height: 180, channels: 3, background: color } }).png().toBuffer();
    const digest = createHash("sha256").update(bytes).digest("hex");
    const file = { original_file_name: `PRIVATE_FILENAME_${runId}-${index}.png`, mime_type: "image/png", size_bytes: bytes.length, width: 320, height: 180,
      sha256: digest, uploaded_sha256: digest, transform: "visual-raster-v1" };
    const provenance = { source_kind: "manual_upload", rights_basis: "owned", rights_note: `PRIVATE_RIGHTS_${runId}`, attribution: `Synthetic credit ${index + 1}`,
      origin_url: `https://example.test/PRIVATE_ORIGIN_${runId}`, parent_asset_id: null };
    const reserved = await command(client, "content_visual_execute", fixture.workItemId, { op: "reserve_upload", brief_id: brief.brief_id, file, provenance });
    const uploaded = await admin.storage.from("content-working").upload(reserved.storage_path, bytes, { contentType: file.mime_type, upsert: false });
    assert(!uploaded.error, "Synthetic local upload failed.");
    const finalized = await rpc(admin, "content_visual_finalize_upload", { p_actor_id: actor.id, p_upload_id: reserved.upload_id, p_verified: file });
    assetIds.push(finalized.asset_id);
    assets.push({ id: finalized.asset_id, path: reserved.storage_path, bytes, file });
  }
  const slots = [{ panel_key: "details", asset_id: assets[1].id, alt_text_th: "ภาพรายละเอียดสำหรับทดสอบ", alt_text_en: "Supporting test image" },
    { panel_key: "hero", asset_id: assets[0].id, alt_text_th: "ภาพหลักสำหรับทดสอบ", alt_text_en: "Main test image" }];
  const saved = await command(client, "content_visual_execute", fixture.workItemId, { op: "save_set", brief_id: brief.brief_id, slots });
  for (const decision of ["submit", "approve"]) await command(client, "content_visual_execute", fixture.workItemId, { op: "review_set", asset_set_id: saved.asset_set_id, decision, note: "Synthetic approved set" });
  fixture.visuals[channel] = { briefId: brief.brief_id, setId: saved.asset_set_id, briefInput, assets, slots };
  return fixture.visuals[channel];
}
async function freezeThroughUi(targetPage, client, fixture, channel) {
  const form = targetPage.getByTestId("bundle-freeze-form");
  const before = await inspect(client, fixture.workItemId);
  await form.locator('[name="asset_set_id"]').selectOption(fixture.visuals[channel].setId);
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => revision(client, fixture.workItemId)).toBeGreaterThan(before.work_item.row_version);
  const after = await inspect(client, fixture.workItemId);
  const added = after.bundles.find(bundle => !before.bundles.some(previous => previous.id === bundle.id));
  assert(added, "Freeze should create a bundle.");
  await expect(targetPage.getByTestId("bundle-workspace")).toHaveAttribute("data-revision", String(after.work_item.row_version));
  await expect(targetPage.getByTestId("bundle-preview")).toHaveAttribute("data-bundle-id", added.id);
  return (await inspect(client, fixture.workItemId, added.id)).selected;
}
async function verifyUi(targetPage, shouldPass = true) {
  const form = targetPage.getByTestId("bundle-verify-form");
  await form.getByTestId("bundle-verify-button").click();
  if (shouldPass) await expect(form.getByTestId("bundle-verify-result")).toBeVisible();
  else await expect(form.getByTestId("bundle-verify-error")).toBeVisible();
  await expect(form).toHaveAttribute("aria-busy", "false");
}
async function failedReverificationHidesPreviousProof(targetPage) {
  const form = targetPage.getByTestId("bundle-verify-form");
  await expect(form.getByTestId("bundle-verify-result")).toBeVisible();
  let release;
  const heldRequest = new Promise(resolve => { release = resolve; });
  const matcher = url => url.origin === site && url.pathname.includes("/publication");
  const handler = async route => {
    if (route.request().method() === "POST") await heldRequest;
    return route.continue();
  };
  await targetPage.route(matcher, handler);
  try {
    await form.getByTestId("bundle-verify-button").click();
    await expect(form).toHaveAttribute("aria-busy", "true");
    await expect(form.getByTestId("bundle-verify-result")).toHaveCount(0);
  } finally {
    release();
  }
  await expect(form.getByTestId("bundle-verify-error")).toBeVisible();
  await expect(form).toHaveAttribute("aria-busy", "false");
  await expect(form.getByTestId("bundle-verify-result")).toHaveCount(0);
  await targetPage.unroute(matcher, handler);
}
function frozenSnapshot(bundleId) {
  return sql(`select to_jsonb(b)::text from public.content_publication_bundles b where id=${literal(bundleId)};`);
}
async function assertDeniedFreeze(client, fixture, setId, code = "FORBIDDEN") {
  const before = await revision(clientForReads, fixture.workItemId);
  const denied = await client.rpc("content_publication_execute", { p_command: { op: "freeze_bundle", work_item_id: fixture.workItemId,
    expected_revision: before, idempotency_key: randomUUID(), asset_set_id: setId } });
  assert.match(denied.error?.message ?? "", new RegExp(code));
  assert.equal(await revision(clientForReads, fixture.workItemId), before);
}
let clientForReads;
try {
  await startIsolatedPreview();
  const owner = await createUser("system_admin");
  const publisher = await createUser("editor", [{ module: "news", publish: true }]);
  const editor = await createUser("editor", [{ module: "news", update: true }]);
  const viewer = await createUser("viewer", [{ module: "news" }, { module: "scholarship" }]);
  const unrelated = await createUser("editor", [{ module: "travel", update: true, publish: true }]);
  const ownerClient = await signedClient(owner);
  clientForReads = ownerClient;
  const [publisherClient, editorClient, viewerClient, unrelatedClient] = await Promise.all([publisher, editor, viewer, unrelated].map(signedClient));
  sql(`insert into public.scholarships(id,title_th,title_en,publication_status,public_visible,internal_note,created_by)
    values(${literal(scholarshipId)},${literal(`${prefix} Published scholarship`)},'Published scholarship','published',true,${literal(`PRIVATE_CANONICAL_${runId}`)},${literal(owner.id)});
    insert into public.news_articles(id,title_th,title_en,publication_status,public_visible,internal_note,created_by)
    values(${literal(newsId)},${literal(`${prefix} Published news`)},'Published news','published',true,${literal(`PRIVATE_CANONICAL_${runId}`)},${literal(owner.id)});`);
  const canonicalBefore = canonicalSnapshot();
  const publicBefore = await publishedSnapshot();
  const news = await seedApproved(ownerClient, "news", newsId);
  const scholarship = await seedApproved(ownerClient, "scholarship", scholarshipId);
  for (const channel of ["website", "facebook"]) await approvedVisual(ownerClient, owner, news, channel);
  await approvedVisual(ownerClient, owner, scholarship, "website");
  const url = `${site}/content-production/news/${newsId}/publication`;
  page = await signedInPage(publisher);
  await page.goto(url);
  const website = await freezeThroughUi(page, publisherClient, news, "website");
  const facebook = await freezeThroughUi(page, publisherClient, news, "facebook");
  assert.equal(website.channel, "website");
  assert.equal(facebook.channel, "facebook");
  assert.equal(website.snapshot_id, facebook.snapshot_id);
  assert.equal(website.snapshot_digest, facebook.snapshot_digest);
  assert.notEqual(website.content_digest, facebook.content_digest);
  assert.deepEqual(website.payload.locales, news.versions.website.locales);
  assert.deepEqual(facebook.payload.locales, news.versions.facebook.locales);
  assert.equal(website.state, "current");
  assert.equal(facebook.state, "current");
  checked("publisher without update permission freezes separate Website/Facebook bundles pinned to one canonical facts snapshot and each approved channel copy");

  for (const frozen of [website, facebook]) {
    const body = JSON.stringify(frozen.payload);
    assert(!body.includes("PRIVATE_"), "Internal work metadata leaked into the frozen payload.");
    assert.deepEqual(frozen.payload.images.map(image => image.panel_key), ["details", "hero"]);
    assert.deepEqual(frozen.payload.images.map(image => image.order), [1, 2]);
    assert.deepEqual(frozen.payload.images.map(image => image.attribution), ["Synthetic credit 2", "Synthetic credit 1"]);
    assert.deepEqual(Object.keys(frozen.payload).sort(), ["channel", "images", "kind", "locales", "schema_version"]);
  }
  await page.goto(`${url}?bundle=${website.id}`);
  await expect(page.getByTestId("bundle-preview")).toHaveAttribute("data-state", "current");
  await expect(page.getByTestId("bundle-preview")).toContainText(news.versions.website.locales.th.body);
  await page.getByRole("tab", { name: "English", exact: true }).click();
  await expect(page.getByTestId("bundle-preview")).toContainText(news.versions.website.locales.en.body);
  const visibleImages = page.getByTestId("bundle-preview").locator("img");
  assert.equal(await visibleImages.count(), 2);
  assert.deepEqual(await visibleImages.evaluateAll(images => images.map(image => image.alt)), ["Supporting test image", "Main test image"]);
  await expect.poll(() => visibleImages.evaluateAll(images => images.every(image => image.complete && image.naturalWidth === 320))).toBe(true);
  assert.deepEqual(await visibleImages.evaluateAll(images => images.map(image => new URL(image.src).pathname)), news.visuals.website.slots.map(slot => `/api/content-visual/assets/${slot.asset_id}`));
  checked("private preview renders bilingual approved copy as text, real ordered images, localized alt text and attribution without internal draft/source/rights fields");

  const initialRevision = await revision(ownerClient, news.workItemId);
  await verifyUi(page);
  assert.equal(await revision(ownerClient, news.workItemId), initialRevision);
  const verifyProof = await page.getByTestId("bundle-verify-form").textContent();
  assert.match(verifyProof, /2/);
  checked("explicit byte verification checks both private image objects while leaving work revision and frozen bundle unchanged");

  const dedupeCommand = { op: "freeze_bundle", work_item_id: news.workItemId, expected_revision: initialRevision,
    idempotency_key: randomUUID(), asset_set_id: news.visuals.website.setId };
  const firstReplay = await rpc(publisherClient, "content_publication_execute", { p_command: dedupeCommand });
  const exactReplay = await rpc(publisherClient, "content_publication_execute", { p_command: dedupeCommand });
  assert.deepEqual(exactReplay, firstReplay);
  assert.equal(firstReplay.bundle_id, website.id);
  assert.equal(firstReplay.reused, true);
  const newKey = await rpc(publisherClient, "content_publication_execute", { p_command: { ...dedupeCommand, idempotency_key: randomUUID() } });
  assert.equal(newKey.bundle_id, website.id);
  assert.equal(await revision(ownerClient, news.workItemId), initialRevision);
  const collision = await publisherClient.rpc("content_publication_execute", { p_command: { ...dedupeCommand, asset_set_id: news.visuals.facebook.setId } });
  assert.match(collision.error?.message ?? "", /IDEMPOTENCY_CONFLICT/);
  assert.equal((await inspect(ownerClient, news.workItemId)).bundles.length, 2);
  checked("exact actor-key retry and same inputs under a new key reuse one immutable bundle; altered payload conflicts without revision changes");

  const viewerPage = await signedInPage(viewer);
  await viewerPage.goto(`${url}?bundle=${website.id}`);
  await expect(viewerPage.getByTestId("bundle-readonly")).toBeVisible();
  await expect(viewerPage.getByTestId("bundle-freeze-form")).toHaveCount(0);
  await verifyUi(viewerPage);
  const editorPage = await signedInPage(editor);
  await editorPage.goto(url);
  await expect(editorPage.getByTestId("bundle-freeze-form")).toHaveCount(0);
  await assertDeniedFreeze(viewerClient, news, news.visuals.website.setId);
  await assertDeniedFreeze(editorClient, news, news.visuals.website.setId);
  await assertDeniedFreeze(unrelatedClient, news, news.visuals.website.setId);
  const unrelatedInspect = await unrelatedClient.rpc("content_publication_inspect", { p_work_item_id: news.workItemId, p_bundle_id: website.id });
  assert(unrelatedInspect.error);
  const unrelatedPage = await signedInPage(unrelated);
  await unrelatedPage.goto(url);
  await expect(unrelatedPage.getByTestId("bundle-preview")).toHaveCount(0);
  const privatePath = `${site}/api/content-visual/assets/${news.visuals.website.assets[0].id}`;
  assert.notEqual((await unrelatedPage.request.get(privatePath)).status(), 200);
  assert.notEqual((await fetch(privatePath, { redirect: "manual" })).status, 200);
  checked("viewers may preview and verify but viewers/editors cannot freeze; unrelated module and anonymous sessions cannot access private bundle images");

  sql(`update private.module_permissions set can_view=false where user_id=${literal(viewer.id)} and module='news';`);
  await verifyUi(viewerPage, false);
  assert.notEqual((await viewerPage.request.get(privatePath)).status(), 200);
  sql(`update public.profiles set active=false where id=${literal(editor.id)};`);
  const inactiveInspect = await editorClient.rpc("content_publication_inspect", { p_work_item_id: news.workItemId, p_bundle_id: website.id });
  assert(inactiveInspect.error);
  sql(`update private.module_permissions set can_publish=false where user_id=${literal(publisher.id)} and module='news';`);
  const revokedRetry = await publisherClient.rpc("content_publication_execute", { p_command: dedupeCommand });
  assert.match(revokedRetry.error?.message ?? "", /FORBIDDEN/);
  sql(`update private.module_permissions set can_publish=true where user_id=${literal(publisher.id)} and module='news';`);
  checked("live role revocation blocks a previously successful verification and receipt replay; inactive profiles cannot inspect");

  const storedBefore = frozenSnapshot(website.id);
  const asset = news.visuals.website.assets[0];
  await page.goto(`${url}?bundle=${website.id}`);
  await verifyUi(page);
  // Explicitly corrupt only this synthetic object's bytes while preserving its
  // size/mime metadata. This exercises the server hash check beyond SQL readiness.
  const corrupted = Buffer.from(asset.bytes);
  corrupted[corrupted.length - 1] ^= 1;
  assert(!(await admin.storage.from("content-working").update(asset.path, corrupted, { contentType: "image/png" })).error);
  assert.equal((await inspect(ownerClient, news.workItemId, website.id)).selected.state, "current");
  await failedReverificationHidesPreviousProof(page);
  assert.notEqual((await page.request.get(privatePath)).status(), 200);
  assert.equal(frozenSnapshot(website.id), storedBefore);
  assert(!(await admin.storage.from("content-working").update(asset.path, asset.bytes, { contentType: "image/png" })).error);
  await page.reload();
  await verifyUi(page);
  checked("same-length corruption fails real byte/hash verification and delivery; pending/failed re-verification clears earlier green proof and frozen payload remains intact");

  assert(!(await admin.storage.from("content-working").remove([asset.path])).error);
  const missing = await inspect(ownerClient, news.workItemId, website.id);
  assert.equal(missing.selected.state, "stale");
  assert(missing.selected.issues.includes("ASSET_NOT_READY"));
  await page.reload();
  await expect(page.getByTestId("bundle-preview")).toHaveAttribute("data-state", "stale");
  assert(!(await admin.storage.from("content-working").upload(asset.path, asset.bytes, { contentType: "image/png", upsert: false })).error);
  assert.equal((await inspect(ownerClient, news.workItemId, website.id)).selected.state, "current");
  checked("missing private storage object marks the selected bundle stale; restoring only the owned synthetic object recovers availability without changing history");

  await page.goto(url);
  await page.getByTestId("bundle-freeze-form").locator('[name="asset_set_id"]').selectOption(news.visuals.website.setId);
  const staleRevision = await revision(ownerClient, news.workItemId);
  const nextSet = await command(ownerClient, "content_visual_execute", news.workItemId, { op: "save_set", brief_id: news.visuals.website.briefId,
    slots: [...news.visuals.website.slots].reverse() });
  const freezeForm = page.getByTestId("bundle-freeze-form");
  await freezeForm.locator('button[type="submit"]').click();
  await expect(freezeForm.getByTestId("bundle-command-error")).toBeVisible();
  await expect(freezeForm).toHaveAttribute("aria-busy", "false");
  await expect(freezeForm.locator('[name="asset_set_id"]')).toHaveValue(news.visuals.website.setId);
  assert.equal(await revision(ownerClient, news.workItemId), staleRevision + 1);
  assert.equal((await inspect(ownerClient, news.workItemId)).bundles.length, 2);
  assert.equal((await inspect(ownerClient, news.workItemId, website.id)).selected.state, "stale");
  assert.equal((await inspect(ownerClient, news.workItemId, facebook.id)).selected.state, "current");
  assert.equal(frozenSnapshot(website.id), storedBefore);
  assert.deepEqual(await rpc(publisherClient, "content_publication_execute", { p_command: dedupeCommand }), firstReplay);
  checked("stale-tab freeze preserves selected input and cannot overwrite; newer Website image set stales only its dependent bundle while exact original receipt still replays");

  for (const decision of ["submit", "approve"]) await command(ownerClient, "content_visual_execute", news.workItemId, { op: "review_set", asset_set_id: nextSet.asset_set_id, decision, note: "Approved successor" });
  const successor = await command(ownerClient, "content_publication_execute", news.workItemId, { op: "freeze_bundle", asset_set_id: nextSet.asset_set_id });
  const successorDetail = (await inspect(ownerClient, news.workItemId, successor.bundle_id)).selected;
  assert.equal(successorDetail.based_on_id, website.id);
  assert.equal(successorDetail.version_number, website.version_number + 1);
  assert.deepEqual(successorDetail.payload.images.map(image => image.panel_key), ["hero", "details"]);
  assert.equal(frozenSnapshot(website.id), storedBefore);
  checked("approving the successor image set creates a new linked bundle version with revised order and leaves the earlier frozen row byte-identical");

  const facebookBefore = frozenSnapshot(facebook.id);
  await command(ownerClient, "content_visual_execute", news.workItemId, { op: "save_brief", content_version_id: news.versions.facebook.id,
    brief: { ...news.visuals.facebook.briefInput, title: "New Facebook brief" } });
  assert.equal((await inspect(ownerClient, news.workItemId, facebook.id)).selected.state, "stale");
  assert.equal((await inspect(ownerClient, news.workItemId, successor.bundle_id)).selected.state, "current");
  assert.equal(frozenSnapshot(facebook.id), facebookBefore);
  await command(ownerClient, "content_core_execute", news.workItemId, { op: "record_source", source: { ...news.source, result: "unverified", note: "Superseding observation" } });
  assert((await inspect(ownerClient, news.workItemId)).bundles.every(bundle => bundle.state === "stale"));
  assert.equal(frozenSnapshot(website.id), storedBefore);
  assert.equal(frozenSnapshot(facebook.id), facebookBefore);
  checked("new brief and superseding source verification dynamically invalidate dependent bundles without rewriting their frozen facts, copy or image manifest");

  const ownerPage = await signedInPage(owner, { width: 390, height: 844 });
  const scholarshipUrl = `${site}/content-production/scholarship/${scholarshipId}/publication`;
  await ownerPage.goto(scholarshipUrl);
  const scholarshipBundle = await freezeThroughUi(ownerPage, ownerClient, scholarship, "website");
  await ownerPage.getByRole("tab", { name: "ไทย", exact: true }).focus();
  await ownerPage.keyboard.press("ArrowRight");
  await expect(ownerPage.getByRole("tab", { name: "English", exact: true })).toHaveAttribute("aria-selected", "true");
  await noOverflow(ownerPage, "mobile publication preview");
  await screenshot(ownerPage, "mobile");
  const scholarshipFrozen = frozenSnapshot(scholarshipBundle.id);
  await command(ownerClient, "content_core_execute", scholarship.workItemId, { op: "save_draft", channel: "website", facts: scholarship.facts, deadlines: scholarship.deadlines,
    locales: { ...scholarship.versions.website.locales, th: { ...scholarship.versions.website.locales.th, title: "New unapproved website copy" } }, source_verification_ids: [scholarship.sourceId] });
  await ownerPage.reload();
  await expect(ownerPage.getByTestId("bundle-preview")).toHaveAttribute("data-state", "stale");
  assert.equal(frozenSnapshot(scholarshipBundle.id), scholarshipFrozen);
  checked("Scholarship bundle works at 390px with keyboard locale tabs; a newer unapproved content version marks its frozen preview stale without changing it");

  await page.goto(`${url}?bundle=${website.id}`);
  await expect(page.getByTestId("bundle-preview")).toHaveAttribute("data-bundle-id", website.id);
  await expect(page.getByTestId("bundle-preview")).toContainText(news.versions.website.locales.th.title);
  await screenshot(page, "history");
  assert.equal(canonicalSnapshot(), canonicalBefore);
  assert.equal(await publishedSnapshot(), publicBefore);
  assert.equal(sql(`select count(*) from public.record_assets where scholarship_id=${literal(scholarshipId)} or news_id=${literal(newsId)};`), "0");
  const anonymousRead = await anonymous.from("content_publication_bundles").select("*").limit(1);
  assert(anonymousRead.error || anonymousRead.data.length === 0);
  const attemptedWrite = await publisherClient.from("content_publication_bundles").update({ payload: {} }).eq("id", website.id);
  assert(attemptedWrite.error);
  assert.equal(frozenSnapshot(website.id), storedBefore);
  checked("explicit historical preview remains accessible to current viewers; canonical/public projections, record_assets and public exposure remain unchanged throughout");
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
      for (const id of sql(`select id from public.content_work_items where created_by in (${userIds});`).split("\n").filter(Boolean)) if (!workItemIds.includes(id)) workItemIds.push(id);
      const workIds = workItemIds.map(literal).join(",");
      if (workItemIds.length) {
        for (const id of sql(`select asset_id from public.content_manual_assets where work_item_id in (${workIds});`).split("\n").filter(Boolean)) if (!assetIds.includes(id)) assetIds.push(id);
        const objects = JSON.parse(sql(`select coalesce(jsonb_agg(name),'[]'::jsonb) from storage.objects where bucket_id='content-working' and (${workItemIds.map(id => `name like '%' || ${literal(id)} || '%'`).join(" or ")});`));
        if (objects.length) assert(!(await admin.storage.from("content-working").remove(objects)).error, "Local Storage fixture removal failed.");
        sql(`begin; set local session_replication_role=replica;
          delete from private.content_publication_receipts where work_item_id in (${workIds});
          delete from public.content_publication_bundles where work_item_id in (${workIds});
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
          delete from public.content_work_items where id in (${workIds}); commit;`);
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
