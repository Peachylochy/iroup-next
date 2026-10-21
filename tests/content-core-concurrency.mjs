// Real overlapping transactions against the disposable local QA database only.
// Run: node tests/content-core-concurrency.mjs --run-local-content
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

assert.ok(process.argv.includes('--run-local-content'), 'Explicit --run-local-content is required.');
const container = 'supabase_db_iroup-stability-local-20261021';
const inspected = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8', windowsHide: true }))[0];
assert.equal(inspected.Name, '/' + container);
const ports = Object.values(inspected.HostConfig.PortBindings || {}).flat();
assert.ok(ports.length && ports.every(port => port.HostIp === '127.0.0.1'), 'QA DB must bind loopback only.');
assert.ok(ports.some(port => port.HostPort === '30322'), 'This test only targets the isolated QA database.');

const actor = randomUUID();
const marker = `content_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const sessions = new Set();
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const claims = JSON.stringify({ sub: actor, role: 'authenticated' });
const asActor = `set local role authenticated; set local "request.jwt.claims" = ${literal(claims)};`;

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
  throw new Error(`No actual concurrent overlap observed: ${label}`);
}
const invoke = (command) => `select public.content_core_execute(${literal(JSON.stringify(command))}::jsonb);`;
const response = (result) => JSON.parse(result.output.split('\n').find(line => line.startsWith('{')));

try {
  await run(`insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('${actor}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${actor}@example.test','',now(),'{}','{"full_name":"Content concurrency QA"}',now(),now());
    insert into private.user_roles(user_id,role) values('${actor}','system_admin');`);

  const openCommand = { op: 'open', kind: 'news', record_id: null, title_th: `Content concurrency ${marker}`, idempotency_key: randomUUID() };
  const opening = start(`set application_name='${marker}_open_a'; begin; ${asActor}
    ${invoke(openCommand)} select pg_sleep(5); commit;`);
  await observe(`select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid
    where a.application_name='${marker}_open_a' and l.locktype='advisory' and l.granted)`, 'first open holds the idempotency lock');
  const retrying = start(`set application_name='${marker}_open_b'; begin; ${asActor} ${invoke(openCommand)} commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_open_b'
    and wait_event_type='Lock' and wait_event='advisory')`, 'duplicate open is waiting on the same key');
  const [opened, retried] = await Promise.all([opening, retrying]);
  assert.equal(opened.code, 0, opened.errors);
  assert.equal(retried.code, 0, retried.errors);
  const first = response(opened);
  assert.deepEqual(response(retried), first, 'concurrent retry must receive the exact original result');
  assert.equal(await run(`select count(*) from public.news_articles where created_by='${actor}'`), '1');
  assert.equal(await run(`select count(*) from public.content_work_items where created_by='${actor}'`), '1');
  assert.equal(await run(`select count(*) from private.content_command_receipts where actor_id='${actor}'`), '1');
  console.log('PASS: overlapping exact retries wait on an advisory lock, return one receipt, and create exactly one canonical record and work item.');

  const today = await run("select (now() at time zone 'Asia/Bangkok')::date");
  const later = await run("select (now() at time zone 'Asia/Bangkok')::date+7");
  const sourceCommand = {
    op: 'record_source', work_item_id: first.work_item_id, expected_revision: first.row_version,
    idempotency_key: randomUUID(),
    source: { title: 'Concurrency source A', publisher: 'QA publisher', requested_url: 'https://example.test/source-a', final_url: 'https://example.test/source-a',
      observed_on: today, valid_until: later, official: true, result: 'verified', note: 'Synthetic local verification' },
  };
  const competingCommand = { ...sourceCommand, idempotency_key: randomUUID(),
    source: { ...sourceCommand.source, title: 'Concurrency source B', requested_url: 'https://example.test/source-b', final_url: 'https://example.test/source-b' } };
  const changing = start(`set application_name='${marker}_edit_a'; begin; ${asActor}
    ${invoke(sourceCommand)} select pg_sleep(5); commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_edit_a' and wait_event='PgSleep')`, 'first edit holds the uncommitted work item revision');
  const competing = start(`\\set VERBOSITY verbose
    set application_name='${marker}_edit_b'; begin; ${asActor} ${invoke(competingCommand)} commit;`);
  await observe(`select exists(select 1 from pg_stat_activity where application_name='${marker}_edit_b' and wait_event_type='Lock')`, 'second edit waits for the locked work item');
  const [changed, rejected] = await Promise.all([changing, competing]);
  assert.equal(changed.code, 0, changed.errors);
  assert.notEqual(rejected.code, 0, 'the stale concurrent command must fail');
  assert.match(rejected.errors, /STALE_REVISION/);
  assert.match(rejected.errors, /PT409/, 'business conflicts must not use retryable SQLSTATE 40001');
  assert.equal(response(changed).row_version, first.row_version + 1);
  assert.equal(await run(`select row_version from public.content_work_items where id='${first.work_item_id}'`), '2');
  assert.equal(await run(`select count(*) from public.content_source_verifications where work_item_id='${first.work_item_id}'`), '1');
  assert.equal(await run(`select count(*) from private.content_command_receipts where actor_id='${actor}'`), '2');
  assert.equal(await run(`select title_th||':'||publication_status::text||':'||public_visible::text from public.news_articles where id='${first.record_id}'`), `${openCommand.title_th}:draft:false`);
  console.log('PASS: overlapping edits wait on the work item lock; only one source and revision commit, the other rolls back with STALE_REVISION, and canonical publication stays unchanged.');
} finally {
  // Await any test process before cleanup, including when an overlap assertion
  // fails. The server-side timeout bounds all outstanding test transactions.
  await Promise.allSettled([...sessions]);
  await run(`begin;
    set local session_replication_role=replica;
    delete from private.content_command_receipts where actor_id='${actor}';
    delete from public.content_review_decisions where work_item_id in (select id from public.content_work_items where created_by='${actor}');
    delete from public.content_versions where work_item_id in (select id from public.content_work_items where created_by='${actor}');
    delete from public.content_snapshots where work_item_id in (select id from public.content_work_items where created_by='${actor}');
    delete from public.content_source_verifications where work_item_id in (select id from public.content_work_items where created_by='${actor}');
    delete from public.content_work_items where created_by='${actor}';
    delete from private.audit_logs where actor_id='${actor}' or record_id='${actor}' or record_id in (select id from public.news_articles where created_by='${actor}');
    delete from public.news_articles where created_by='${actor}';
    delete from private.module_permissions where user_id='${actor}';
    delete from private.user_roles where user_id='${actor}';
    delete from public.profiles where id='${actor}';
    delete from auth.users where id='${actor}';
    commit;`);
  console.log('Cleanup: removed only this test actor and its synthetic editorial records.');
}
