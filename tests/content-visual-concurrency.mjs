// Actual overlapping transactions, isolated local QA only. Storage metadata is
// synthetic here; the browser harness separately verifies real raster uploads.
// Run: node tests/content-visual-concurrency.mjs --run-local-visual
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

assert.ok(process.argv.includes('--run-local-visual'), 'Explicit --run-local-visual is required.');
const container = 'supabase_db_iroup-stability-local-20261021';
const inspected = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8', windowsHide: true }))[0];
assert.equal(inspected.Name, '/' + container);
const ports = Object.values(inspected.HostConfig.PortBindings || {}).flat();
assert.ok(ports.length && ports.every(port => port.HostIp === '127.0.0.1'), 'QA DB must bind loopback only.');
assert.ok(ports.some(port => port.HostPort === '30322'), 'Only the isolated QA database is permitted.');
const actor = randomUUID();
const marker = `visual_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
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
const execute = command => `select public.content_visual_execute(${json(command)});`;
const finalized = (upload, file) => `select public.content_visual_finalize_upload('${actor}','${upload.upload_id}',${json(file)});`;
async function callCore(command) {
  return JSON.parse(await run(`begin; ${asActor} select public.content_core_execute(${json(command)}); commit;`));
}
async function callVisual(command) {
  return JSON.parse(await run(`begin; ${asActor} ${execute(command)} commit;`));
}
async function object(upload, file) {
  await run(`insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('content-working',${literal(upload.storage_path)},'${actor}',${json({ size: file.size_bytes, mimetype: file.mime_type })});`);
}

try {
  await run(`insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('${actor}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${actor}@example.test','',now(),'{}','{"full_name":"Visual concurrency QA"}',now(),now());
    insert into private.user_roles(user_id,role) values('${actor}','system_admin');`);
  let state = await callCore({ op: 'open', kind: 'news', record_id: null, title_th: marker, idempotency_key: randomUUID() });
  const work = state.work_item_id;
  const record = state.record_id;
  const revision = async () => Number(await run(`select row_version from public.content_work_items where id='${work}'`));
  const command = async payload => ({ work_item_id: work, expected_revision: await revision(), idempotency_key: randomUUID(), ...payload });
  const today = await run("select (now() at time zone 'Asia/Bangkok')::date");
  const later = await run("select (now() at time zone 'Asia/Bangkok')::date+7");
  state = await callCore(await command({ op: 'record_source', source: { title: 'Synthetic verified source', publisher: 'QA publisher', requested_url: 'https://example.test/visual',
    final_url: 'https://example.test/visual', observed_on: today, valid_until: later, official: true, result: 'verified', note: 'Local concurrency fixture' } }));
  const source = state.source_verification_id;
  state = await callCore(await command({ op: 'save_draft', channel: 'website', facts: { subject: 'Verified subject', key_points: 'Verified fact', category: '', scholarship_type: '',
    audience: 'both', funding_type: '', study_level: '', eligibility: '', detail_url: '', apply_url: '' }, source_verification_ids: [source], deadlines: [],
    locales: { th: { title: 'ข่าวทดสอบ', summary: '', body: 'เนื้อหาทดสอบ', coverage: '' }, en: { title: 'Test news', summary: '', body: 'Test content', coverage: '' } } }));
  const version = state.version_id;
  await callCore(await command({ op: 'review', version_id: version, decision: 'submit', note: '' }));
  await callCore(await command({ op: 'review', version_id: version, decision: 'approve', note: 'Synthetic approval' }));
  state = await callVisual(await command({ op: 'save_brief', content_version_id: version, brief: { title: 'Concurrency brief', objective: 'Explain news', audience: 'Students', key_message: 'Verified facts',
    design_notes: '', brand_notes: 'Reviewed local fixture', prompt: '', negative_prompt: '', width: 1200, height: 630, panels: [{ key: 'cover', label: 'Cover', notes: '' }] } }));
  const brief = state.brief_id;
  await callVisual(await command({ op: 'review_brief', brief_id: brief, decision: 'submit', note: '' }));
  await callVisual(await command({ op: 'review_brief', brief_id: brief, decision: 'approve', note: 'Synthetic approval' }));
  const file = { original_file_name: 'fixture.png', mime_type: 'image/png', size_bytes: 1024, width: 1200, height: 630,
    sha256: 'c'.repeat(64), uploaded_sha256: 'd'.repeat(64), transform: 'visual-raster-v1' };
  const reserve = await command({ op: 'reserve_upload', brief_id: brief, file, provenance: { source_kind: 'manual_upload', rights_basis: 'owned',
    rights_note: 'Synthetic QA image', attribution: '', origin_url: '', parent_asset_id: null } });

  const reserving = start(`set application_name='${marker}_reserve_a'; begin; ${asActor} ${execute(reserve)} select pg_sleep(5); commit;`);
  await observe(`select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='${marker}_reserve_a' and l.locktype='advisory' and l.granted)`, 'initial reservation holds actor/key lock');
  const duplicateReserve = start(`set application_name='${marker}_reserve_b'; begin; ${asActor} ${execute(reserve)} commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_reserve_b' and wait_event_type='Lock' and wait_event='advisory')`, 'same-key reservation waits on advisory lock');
  const [reserved, duplicate] = await Promise.all([reserving, duplicateReserve]);
  assert.equal(reserved.code, 0, reserved.errors); assert.equal(duplicate.code, 0, duplicate.errors);
  const upload = response(reserved);
  assert.deepEqual(response(duplicate), upload);
  assert.equal(await revision(), reserve.expected_revision, 'operational reservation must not bump semantic revision');
  assert.equal(await run(`select count(*) from private.content_visual_uploads where actor_id='${actor}'`), '1');
  console.log('PASS: overlapping identical reservations wait on actor/key lock and produce one ticket/path without bumping the editorial revision.');

  await object(upload, file);
  const completing = start(`set application_name='${marker}_finish_a'; begin; ${asService} ${finalized(upload, file)} select pg_sleep(5); commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_finish_a' and wait_event='PgSleep')`, 'finalizer holds uncommitted work item revision');
  const retryFinish = start(`set application_name='${marker}_finish_b'; begin; ${asService} ${finalized(upload, file)} commit;`);
  const reserveDuringFinish = start(`set application_name='${marker}_reserve_finish'; begin; ${asActor} ${execute(reserve)} commit;`);
  await observe(`select count(*)=2 from pg_stat_activity where application_name in ('${marker}_finish_b','${marker}_reserve_finish') and wait_event_type='Lock'`, 'duplicate finalizer and reservation replay both wait on work item');
  const [completed, retried, replayed] = await Promise.all([completing, retryFinish, reserveDuringFinish]);
  for (const item of [completed, retried, replayed]) assert.equal(item.code, 0, item.errors);
  const asset = response(completed);
  assert.deepEqual(response(retried), asset);
  assert.equal(response(replayed).asset_id, asset.asset_id, 'replay waiting on finalizer must return completion instead of a stale ticket');
  assert.equal(await revision(), reserve.expected_revision + 1);
  assert.equal(await run(`select count(*) from public.content_manual_assets where work_item_id='${work}'`), '1');
  console.log('PASS: duplicate finalization and pending-ticket replay wait for the same row; all receive one asset and only one revision increment.');

  const candidateA = await command({ ...reserve, idempotency_key: randomUUID(), expected_revision: await revision() });
  const candidateB = { ...candidateA, idempotency_key: randomUUID() };
  const uploadA = await callVisual(candidateA), uploadB = await callVisual(candidateB);
  await object(uploadA, file); await object(uploadB, file);
  const winning = start(`set application_name='${marker}_compete_a'; begin; ${asService} ${finalized(uploadA, file)} select pg_sleep(5); commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_compete_a' and wait_event='PgSleep')`, 'first distinct upload holds work item');
  const losing = start(`\\set VERBOSITY verbose
    set application_name='${marker}_compete_b'; begin; ${asService} ${finalized(uploadB, file)} commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_compete_b' and wait_event_type='Lock')`, 'competing upload waits before comparing revision');
  const [winner, loser] = await Promise.all([winning, losing]);
  assert.equal(winner.code, 0, winner.errors); assert.notEqual(loser.code, 0);
  assert.match(loser.errors, /STALE_REVISION/); assert.match(loser.errors, /PT409/);
  assert.equal(await revision(), candidateA.expected_revision + 1);
  assert.equal(await run(`select count(*) from public.content_manual_assets where work_item_id='${work}'`), '2');
  assert.equal(await run(`select count(*) from public.content_manual_assets where upload_id='${uploadB.upload_id}'`), '0');
  const retryStale = await start(`begin; ${asActor} ${execute(candidateB)} commit;`);
  assert.notEqual(retryStale.code, 0); assert.match(retryStale.errors, /STALE_REVISION/);
  assert.equal(await run(`select count(*) from public.record_assets where news_id='${record}'`), '0');
  assert.equal(await run(`select publication_status::text||':'||public_visible::text from public.news_articles where created_by='${actor}'`), 'draft:false');
  console.log('PASS: distinct concurrent finalizers have one winner; the loser and its subsequent ticket replay fail with STALE_REVISION, with no duplicate assets or publication.');
} finally {
  await Promise.allSettled([...sessions]);
  await run(`begin; set local session_replication_role=replica;
    delete from storage.objects where bucket_id='content-working' and name in(select storage_path from private.content_visual_uploads where actor_id='${actor}');
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
  console.log('Cleanup: removed only this test actor, its metadata-only Storage objects and synthetic editorial records.');
}
