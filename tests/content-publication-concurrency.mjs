// Actual overlapping transactions against the isolated loopback QA database.
// Synthetic Storage metadata here; the browser test verifies actual image bytes.
// Run: node tests/content-publication-concurrency.mjs --run-local-publication
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

assert.ok(process.argv.includes('--run-local-publication'), 'Explicit --run-local-publication is required.');
const container = 'supabase_db_iroup-stability-local-20261021';
const inspected = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8', windowsHide: true }))[0];
assert.equal(inspected.Name, '/' + container);
const ports = Object.values(inspected.HostConfig.PortBindings || {}).flat();
assert.ok(ports.length && ports.every(port => port.HostIp === '127.0.0.1'), 'QA database must bind loopback only.');
assert.ok(ports.some(port => port.HostPort === '30322'), 'Only the isolated QA database is permitted.');
const actor = randomUUID();
const marker = `publication_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const sessions = new Set();
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${literal(JSON.stringify(value))}::jsonb`;
const asActor = `set local role authenticated; set local "request.jwt.claims"=${literal(JSON.stringify({ sub: actor, role: 'authenticated' }))};`;
const asService = `set local role service_role; set local "request.jwt.claims"='{"role":"service_role"}';`;
function start(sql) {
  const child = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let output = '', errors = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { errors += data; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve({ code, output: output.trim(), errors: errors.trim() }));
  });
  sessions.add(done);
  done.then(() => sessions.delete(done), () => sessions.delete(done));
  child.stdin.end(`set statement_timeout='20s';\n${sql}`);
  return done;
}
async function run(sql) {
  const result = await start(sql);
  assert.equal(result.code, 0, result.errors);
  return result.output;
}
async function observe(sql, label) {
  const until = Date.now() + 4500;
  while (Date.now() < until) {
    if (await run(sql) === 't') return;
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  throw new Error(`No actual overlap observed: ${label}`);
}
const response = result => JSON.parse(result.output.split('\n').find(line => line.startsWith('{')));
const execute = command => `select public.content_publication_execute(${json(command)});`;
async function callCore(command) {
  return JSON.parse(await run(`begin; ${asActor} select public.content_core_execute(${json(command)}); commit;`));
}
async function callVisual(command) {
  return JSON.parse(await run(`begin; ${asActor} select public.content_visual_execute(${json(command)}); commit;`));
}

try {
  await run(`insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('${actor}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${actor}@example.test','',now(),'{}','{"full_name":"Publication concurrency QA"}',now(),now());
    insert into private.user_roles(user_id,role) values('${actor}','system_admin');`);
  let state = await callCore({ op: 'open', kind: 'news', record_id: null, title_th: marker, idempotency_key: randomUUID() });
  const work = state.work_item_id;
  const record = state.record_id;
  const revision = async () => Number(await run(`select row_version from public.content_work_items where id='${work}'`));
  const command = async payload => ({ work_item_id: work, expected_revision: await revision(), idempotency_key: randomUUID(), ...payload });
  const today = await run("select (now() at time zone 'Asia/Bangkok')::date");
  const later = await run("select (now() at time zone 'Asia/Bangkok')::date+7");
  state = await callCore(await command({ op: 'record_source', source: { title: 'Synthetic source', publisher: 'QA publisher', requested_url: 'https://example.test/publication',
    final_url: 'https://example.test/publication', observed_on: today, valid_until: later, official: true, result: 'verified', note: 'Local concurrency fixture' } }));
  const source = state.source_verification_id;
  state = await callCore(await command({ op: 'save_draft', channel: 'website', facts: { subject: 'Verified subject', key_points: 'Verified fact', category: '', scholarship_type: '',
    audience: 'both', funding_type: '', study_level: '', eligibility: '', detail_url: '', apply_url: '' }, source_verification_ids: [source], deadlines: [],
    locales: { th: { title: 'ข่าวทดสอบ', summary: '', body: 'เนื้อหาทดสอบ', coverage: '' }, en: { title: 'Test news', summary: '', body: 'Test content', coverage: '' } } }));
  const version = state.version_id;
  await callCore(await command({ op: 'review', version_id: version, decision: 'submit', note: '' }));
  await callCore(await command({ op: 'review', version_id: version, decision: 'approve', note: 'Synthetic approval' }));
  state = await callVisual(await command({ op: 'save_brief', content_version_id: version, brief: { title: 'Concurrency brief', objective: 'Explain news', audience: 'Students', key_message: 'Verified facts',
    design_notes: '', brand_notes: 'Reviewed fixture', prompt: '', negative_prompt: '', width: 1200, height: 630, panels: [{ key: 'cover', label: 'Cover', notes: '' }] } }));
  const brief = state.brief_id;
  await callVisual(await command({ op: 'review_brief', brief_id: brief, decision: 'submit', note: '' }));
  await callVisual(await command({ op: 'review_brief', brief_id: brief, decision: 'approve', note: 'Synthetic approval' }));
  const file = { original_file_name: 'fixture.png', mime_type: 'image/png', size_bytes: 1024, width: 1200, height: 630,
    sha256: 'c'.repeat(64), uploaded_sha256: 'd'.repeat(64), transform: 'visual-raster-v1' };
  const upload = await callVisual(await command({ op: 'reserve_upload', brief_id: brief, file, provenance: { source_kind: 'manual_upload', rights_basis: 'owned',
    rights_note: 'Synthetic QA image', attribution: '', origin_url: '', parent_asset_id: null } }));
  await run(`insert into storage.objects(bucket_id,name,owner_id,metadata) values('content-working',${literal(upload.storage_path)},'${actor}',${json({ size: file.size_bytes, mimetype: file.mime_type })});`);
  const asset = JSON.parse(await run(`begin; ${asService} select public.content_visual_finalize_upload('${actor}','${upload.upload_id}',${json(file)}); commit;`));
  const saveApprovedSet = async () => {
    const saved = await callVisual(await command({ op: 'save_set', brief_id: brief, slots: [{ panel_key: 'cover', asset_id: asset.asset_id, alt_text_th: 'ภาพทดสอบ', alt_text_en: 'Test image' }] }));
    await callVisual(await command({ op: 'review_set', asset_set_id: saved.asset_set_id, decision: 'submit', note: '' }));
    await callVisual(await command({ op: 'review_set', asset_set_id: saved.asset_set_id, decision: 'approve', note: 'Synthetic approval' }));
    return saved.asset_set_id;
  };
  const firstSet = await saveApprovedSet();
  const firstCommand = await command({ op: 'freeze_bundle', asset_set_id: firstSet });
  const first = start(`set application_name='${marker}_same_a'; begin; ${asActor} ${execute(firstCommand)} select pg_sleep(5); commit;`);
  await observe(`select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='${marker}_same_a' and a.wait_event='PgSleep' and l.locktype='advisory' and l.granted)`, 'initial freeze holds actor/key and work revision');
  const duplicate = start(`set application_name='${marker}_same_b'; begin; ${asActor} ${execute(firstCommand)} commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_same_b' and wait_event_type='Lock' and wait_event='advisory')`, 'duplicate freeze waits on advisory key');
  const [created, replayed] = await Promise.all([first, duplicate]);
  assert.equal(created.code, 0, created.errors); assert.equal(replayed.code, 0, replayed.errors);
  assert.deepEqual(response(created), response(replayed));
  assert.equal(response(created).reused, false);
  assert.equal(await revision(), firstCommand.expected_revision + 1);
  assert.equal(await run(`select count(*) from public.content_publication_bundles where work_item_id='${work}'`), '1');
  assert.equal(await run(`select count(*) from private.content_publication_receipts where actor_id='${actor}'`), '1');
  console.log('PASS: overlapping same-key freezes visibly wait on the advisory lock, returning one bundle and one revision increment.');

  const successorSet = await saveApprovedSet();
  const candidateA = await command({ op: 'freeze_bundle', asset_set_id: successorSet });
  const candidateB = { ...candidateA, idempotency_key: randomUUID() };
  const winning = start(`set application_name='${marker}_compete_a'; begin; ${asActor} ${execute(candidateA)} select pg_sleep(5); commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_compete_a' and wait_event='PgSleep')`, 'first distinct key holds changed work revision');
  const losing = start(`\\set VERBOSITY verbose
    set application_name='${marker}_compete_b'; begin; ${asActor} ${execute(candidateB)} commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_compete_b' and wait_event_type='Lock' and wait_event<>'advisory')`, 'different key waits on the same work item');
  const [winner, loser] = await Promise.all([winning, losing]);
  assert.equal(winner.code, 0, winner.errors); assert.notEqual(loser.code, 0);
  assert.match(loser.errors, /STALE_REVISION/); assert.match(loser.errors, /PT409/);
  assert.equal(await revision(), candidateA.expected_revision + 1);
  assert.equal(await run(`select count(*) from public.content_publication_bundles where work_item_id='${work}'`), '2');
  assert.equal(await run(`select count(*) from private.content_publication_receipts where actor_id='${actor}' and idempotency_key='${candidateB.idempotency_key}'`), '0');
  const reloaded = { ...candidateB, expected_revision: await revision() };
  const reused = JSON.parse(await run(`begin; ${asActor} ${execute(reloaded)} commit;`));
  assert.equal(reused.reused, true);
  assert.equal(reused.bundle_id, response(winner).bundle_id);
  assert.equal(await revision(), candidateA.expected_revision + 1);
  assert.equal(await run(`select count(*) from public.content_publication_bundles where work_item_id='${work}'`), '2');
  assert.equal(await run(`select count(*) from public.record_assets where news_id='${record}'`), '0');
  assert.equal(await run(`select publication_status::text||':'||public_visible::text from public.news_articles where id='${record}'`), 'draft:false');
  console.log('PASS: different keys overlap on the work lock; one wins, one returns PT409, and a reload safely reuses the winner without a second bump or publication.');
} finally {
  await Promise.allSettled([...sessions]);
  await run(`begin; set local session_replication_role=replica;
    delete from storage.objects where bucket_id='content-working' and name in(select storage_path from private.content_visual_uploads where actor_id='${actor}');
    delete from private.content_publication_receipts where actor_id='${actor}';
    delete from public.content_publication_bundles where created_by='${actor}';
    delete from public.content_visual_reviews where created_by='${actor}';
    delete from public.content_asset_sets where created_by='${actor}';
    delete from public.content_manual_assets where created_by='${actor}';
    delete from public.assets where created_by='${actor}';
    delete from private.content_visual_receipts where actor_id='${actor}';
    delete from private.content_visual_uploads where actor_id='${actor}';
    delete from public.visual_brief_versions where created_by='${actor}';
    delete from private.content_command_receipts where actor_id='${actor}';
    delete from public.content_review_decisions where created_by='${actor}';
    delete from public.content_versions where created_by='${actor}';
    delete from public.content_snapshots where created_by='${actor}';
    delete from public.content_source_verifications where created_by='${actor}';
    delete from public.content_work_items where created_by='${actor}';
    delete from private.audit_logs where actor_id='${actor}' or record_id='${actor}' or record_id in(select id from public.news_articles where created_by='${actor}');
    delete from public.news_articles where created_by='${actor}';
    delete from private.module_permissions where user_id='${actor}';
    delete from private.user_roles where user_id='${actor}';
    delete from public.profiles where id='${actor}';
    delete from auth.users where id='${actor}'; commit;`);
  console.log('Cleanup: removed only the synthetic test actor and its metadata-only objects, bundles and editorial fixtures.');
}
