// Integration test against the disposable local QA container only.
// Run: node tests/stability-concurrency.mjs
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const container = 'supabase_db_iroup-stability-local-20261021';
const inspected = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
assert.equal(inspected.Name, '/' + container);
const ports = Object.values(inspected.HostConfig.PortBindings || {}).flat();
assert.ok(ports.length && ports.every(port => port.HostIp === '127.0.0.1'), 'QA DB must bind loopback only');

function start(sql) {
  const process = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { stdio: ['pipe','pipe','pipe'] });
  let output = '', errors = '';
  process.stdout.on('data', data => output += data);
  process.stderr.on('data', data => errors += data);
  const done = new Promise((resolve, reject) => {
    process.on('error', reject);
    process.on('close', code => resolve({code, output:output.trim(), errors:errors.trim()}));
  });
  process.stdin.end(`set statement_timeout = '20s';\n${sql}`);
  return done;
}
async function run(sql) {
  const result = await start(sql);
  assert.equal(result.code, 0, result.errors);
  return result.output;
}
async function observe(sql, label) {
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    if (await run(sql) === 't') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Did not observe actual concurrent overlap: ${label}`);
}
const actor = randomUUID(), partner = randomUUID();
const contactA = randomUUID(), contactB = randomUUID(), master = randomUUID();
const unitCode = 'QA-CONCURRENCY-' + randomUUID();
const asActor = `set local role authenticated; set local "request.jwt.claims" = '{"sub":"${actor}","role":"authenticated"}';`;
const batches = [contactA, contactB, master].map(id => `'${id}'`).join(',');

try {
  await run(`
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('${actor}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${actor}@example.test','',now(),'{}','{"full_name":"Concurrency QA"}',now(),now());
    insert into private.user_roles(user_id,role) values('${actor}','system_admin');
    insert into public.partner_organizations(id,name_en,created_by) values('${partner}','Local concurrency fixture','${actor}');
    insert into public.import_batches(id,module,import_kind,source_file_name,source_file_path,status,created_by,total_rows)
    values('${contactA}','mou','module_data','local-fixture','legacy_partner_contacts','ready','${actor}',1),
          ('${contactB}','mou','module_data','local-fixture','legacy_partner_contacts','ready','${actor}',1),
          ('${master}','settings','master_data','local-fixture',null,'ready','${actor}',1);
    insert into public.import_rows(batch_id,row_number,status,review_status,change_action,source_data,normalized_data)
    select id,1,'valid','approved','insert','{}',jsonb_build_object('partnerOrganizationId','${partner}','fullName','Concurrent fixture','contactMethods',jsonb_build_array(jsonb_build_object('method_type','email','value','fixture@example.test')))
    from public.import_batches where id in('${contactA}','${contactB}');
    insert into public.import_rows(batch_id,row_number,status,review_status,change_action,master_entity,source_data,normalized_data)
    values('${master}',1,'valid','approved','insert','organization_unit','{}',jsonb_build_object('code','${unitCode}','name_th','Local concurrency fixture'));
  `);

  const firstContact = start(`set application_name='iroup_stability_contact_a'; begin; ${asActor}
    select public.commit_legacy_contact_import_batch('${contactA}'); select pg_sleep(5); commit;`);
  await observe("select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='iroup_stability_contact_a' and l.locktype='advisory' and l.granted)", 'first contact transaction holds advisory lock');
  const secondContact = start(`set application_name='iroup_stability_contact_b'; begin; ${asActor}
    select public.commit_legacy_contact_import_batch('${contactB}'); commit;`);
  await observe("select exists(select 1 from pg_stat_activity where application_name='iroup_stability_contact_b' and wait_event_type='Lock' and wait_event='advisory')", 'second contact import is waiting');
  const [first, second] = await Promise.all([firstContact, secondContact]);
  assert.equal(first.code, 0, first.errors);
  assert.notEqual(second.code, 0, 'duplicate import must fail');
  assert.match(second.errors, /LEGACY_CONTACT_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION/);
  assert.equal(await run(`select count(*) from public.partner_contacts where partner_organization_id='${partner}'`), '1');
  assert.equal(await run(`select status::text||':'||coalesce(committed_at::text,'null') from public.import_batches where id='${contactB}'`), 'ready:null');
  assert.equal(await run(`select status::text||':'||coalesce(target_record_id::text,'null') from public.import_rows where batch_id='${contactB}'`), 'valid:null');
  console.log('PASS: overlapping contact imports produce one contact, preserve first history, and roll back the second batch.');

  const committing = start(`set application_name='iroup_stability_master_commit'; begin; ${asActor}
    select public.commit_master_import_batch('${master}'); select pg_sleep(5); commit;`);
  await observe("select exists(select 1 from pg_stat_activity where application_name='iroup_stability_master_commit' and wait_event='PgSleep')", 'master commit holds uncommitted rows');
  const reviewing = start(`set application_name='iroup_stability_late_review'; begin; ${asActor}
    update public.import_rows set review_status='skipped',change_action='skip' where batch_id='${master}'; commit;`);
  await observe("select exists(select 1 from pg_stat_activity where application_name='iroup_stability_late_review' and wait_event_type='Lock')", 'late review waits on commit');
  const [committed, reviewed] = await Promise.all([committing, reviewing]);
  assert.equal(committed.code, 0, committed.errors);
  assert.notEqual(reviewed.code, 0, 'late review must not edit committed history');
  assert.match(reviewed.errors, /IMPORT_/);
  assert.equal(await run(`select status::text||':'||review_status::text||':'||change_action::text||':'||(target_record_id is not null)::text from public.import_rows where batch_id='${master}'`), 'imported:approved:insert:true');
  assert.equal(await run(`select count(*) from public.organization_units where code='${unitCode}'`), '1');
  console.log('PASS: overlapping late review is rejected after commit; imported state, decision and target ID remain consistent.');
} finally {
  await run(`delete from public.import_batches where id in (${batches});
    delete from public.partner_contacts where partner_organization_id='${partner}';
    delete from public.partner_organizations where id='${partner}';
    delete from public.organization_units where code='${unitCode}';
    delete from auth.users where id='${actor}';`);
}
