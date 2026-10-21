begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('c1100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','content-core-'||n||'@example.test','',now(),
  '{"provider":"email","providers":["email"]}',jsonb_build_object('full_name','Content core '||n),now(),now()
from generate_series(1,7) n;
insert into private.user_roles(user_id,role) values
 ('c1100000-0000-0000-0000-000000000001','system_admin'),
 ('c1100000-0000-0000-0000-000000000002','editor'),
 ('c1100000-0000-0000-0000-000000000003','viewer'),
 ('c1100000-0000-0000-0000-000000000004','editor'),
 ('c1100000-0000-0000-0000-000000000005','editor'),
 ('c1100000-0000-0000-0000-000000000006','system_admin'),
 ('c1100000-0000-0000-0000-000000000007','editor');
insert into private.module_permissions(user_id,module,can_view,can_create,can_update,can_publish) values
 ('c1100000-0000-0000-0000-000000000002','scholarship',true,true,true,false),
 ('c1100000-0000-0000-0000-000000000002','news',true,true,true,false),
 ('c1100000-0000-0000-0000-000000000003','scholarship',true,false,false,false),
 ('c1100000-0000-0000-0000-000000000004','news',true,true,true,false),
 ('c1100000-0000-0000-0000-000000000005','scholarship',true,false,false,true),
 ('c1100000-0000-0000-0000-000000000007','scholarship',false,true,true,true);
update public.profiles set active=false where id='c1100000-0000-0000-0000-000000000006';
insert into public.scholarships(id,title_th,title_en,content_th,content_en,publication_status,public_visible,internal_note,created_by)
values('c1200000-0000-0000-0000-000000000001','ทุนเดิม','Existing scholarship','เนื้อหาเดิม','Original body','published',true,'NEVER_EXPOSE_PRIVATE_NOTE','c1100000-0000-0000-0000-000000000001');
insert into public.news_articles(id,title_th,title_en,content_th,content_en,publication_status,public_visible,internal_note,created_by) values
 ('c1200000-0000-0000-0000-000000000002','ข่าวเดิม','Existing news','ข่าวเดิมฉบับเผยแพร่','Original published news','published',true,'NEVER_EXPOSE_PRIVATE_NOTE','c1100000-0000-0000-0000-000000000001'),
 ('c1200000-0000-0000-0000-000000000003','Unmanaged','Unmanaged','','','draft',false,'PRIVATE','c1100000-0000-0000-0000-000000000001');

create temporary table ctx(k text primary key,v jsonb);
grant select,insert,update on ctx to authenticated;
insert into ctx values
 ('canonical_scholarship',(select to_jsonb(s) from public.scholarships s where id='c1200000-0000-0000-0000-000000000001')),
 ('canonical_news',(select to_jsonb(n) from public.news_articles n where id='c1200000-0000-0000-0000-000000000002')),
 ('public_scholarship',(select to_jsonb(s) from public.scholarships_public s where id='c1200000-0000-0000-0000-000000000001')),
 ('facts','{"subject":"ข้อเท็จจริงสำหรับทุน","key_points":"Verified facts","category":"","scholarship_type":"Research","audience":"student","funding_type":"Full","study_level":"Master","eligibility":"Students","detail_url":"https://example.test/scholarship","apply_url":""}'),
 ('locales','{"th":{"title":"ทุนฉบับใหม่","summary":"สรุป","body":"เนื้อหาภาษาไทย","coverage":"ค่าเล่าเรียน"},"en":{"title":"New scholarship","summary":"Summary","body":"English body","coverage":"Tuition"}}');
create function pg_temp.value(p_k text) returns jsonb language sql as $$select v from pg_temp.ctx where k=p_k$$;
create function pg_temp.run(p_k text,p_command jsonb) returns jsonb language plpgsql as $$
declare command jsonb; result jsonb; previous jsonb:=pg_temp.value(p_k);
begin
  command:=jsonb_build_object('idempotency_key',gen_random_uuid());
  if p_command->>'op'<>'open' then command:=command||jsonb_build_object('work_item_id',previous->>'work_item_id','expected_revision',(previous->>'row_version')::integer); end if;
  command:=command||p_command;
  result:=public.content_core_execute(command);
  insert into pg_temp.ctx(k,v) values(p_k,result) on conflict(k) do update set v=excluded.v;
  insert into pg_temp.ctx(k,v) values('last_command',command) on conflict(k) do update set v=excluded.v;
  return result;
end;
$$;
create function pg_temp.source(p_url text default 'https://example.test/official',p_result text default 'verified') returns jsonb language sql as $$
 select jsonb_build_object('op','record_source','source',jsonb_build_object('title','Official source','publisher','Official publisher','requested_url',p_url,'final_url',p_url,
 'observed_on',(now() at time zone 'Asia/Bangkok')::date,'valid_until',(now() at time zone 'Asia/Bangkok')::date+7,'official',true,'result',p_result,'note','Manually inspected'));
$$;
create function pg_temp.save(p_k text,p_channel text default 'website',p_overrides jsonb default '{}') returns jsonb language sql as $$
 select pg_temp.run(p_k,jsonb_build_object('op','save_draft','channel',p_channel,'facts',pg_temp.value('facts'),'source_verification_ids',coalesce(pg_temp.value(p_k||'_sources'),'[]'::jsonb),
   'deadlines',coalesce(pg_temp.value(p_k||'_deadlines'),'[]'::jsonb),'locales',pg_temp.value('locales'))||p_overrides);
$$;
create function pg_temp.review(p_k text,p_decision text,p_version uuid default null) returns jsonb language sql as $$
 select pg_temp.run(p_k,jsonb_build_object('op','review','version_id',coalesce(p_version,(pg_temp.value(p_k)->>'version_id')::uuid),'decision',p_decision,'note','Review note'));
$$;

select ok(not has_table_privilege('anon','public.content_work_items','SELECT'),'anonymous has no editorial table access');
select ok(not has_table_privilege('authenticated','public.content_snapshots','INSERT'),'authenticated cannot insert snapshots directly');
select ok(not has_table_privilege('authenticated','public.content_work_items','UPDATE'),'authenticated cannot move editorial pointers directly');
select ok(not has_table_privilege('authenticated','private.content_command_receipts','SELECT'),'idempotency receipts are private');
select ok(not has_function_privilege('anon','public.content_core_execute(jsonb)','EXECUTE'),'anonymous cannot execute commands');
select ok(not has_function_privilege('service_role','public.content_core_execute(jsonb)','EXECUTE'),'service token cannot impersonate a human command actor');
select ok(not has_function_privilege('authenticated','private.content_digest(jsonb)','EXECUTE'),'private command internals not client executable');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$select pg_temp.run('scholarship','{"op":"open","kind":"scholarship","record_id":"c1200000-0000-0000-0000-000000000001","title_th":"ignored"}')$$,'editor opens an existing scholarship');
select lives_ok($$select pg_temp.run('news','{"op":"open","kind":"news","record_id":"c1200000-0000-0000-0000-000000000002","title_th":"ignored"}')$$,'editor opens existing news');
select is(public.content_core_execute(pg_temp.value('last_command')),pg_temp.value('news'),'exact retry returns original receipt');
select throws_ok($$select public.content_core_execute(pg_temp.value('last_command')||'{"title_th":"changed"}')$$,'22023','IDEMPOTENCY_CONFLICT','same key different payload fails');
select is((select count(*)::integer from public.content_work_items),2,'retry did not duplicate work items');
select throws_ok($$select pg_temp.run('scholarship','{"op":"record_source","source":{},"expected_revision":999}')$$,'PT409','STALE_REVISION','stale mutation returns a nonretryable HTTP conflict before any write');
select is((select count(*)::integer from public.content_source_verifications),0,'failed revision creates no source');
set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$update public.scholarships set title_th='Bypass' where id='c1200000-0000-0000-0000-000000000001'$$,'42501','CONTENT_MANAGED_RECORD','managed legacy editor cannot overwrite canonical record');
set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$delete from public.content_snapshots$$,'42501',null,'authenticated history deletion denied');
select lives_ok($$update public.news_articles set title_th='Unmanaged remains editable' where id='c1200000-0000-0000-0000-000000000003'$$,'unmanaged legacy records keep existing editing behavior');
select ok(public.content_core_inspect('scholarship','c1200000-0000-0000-0000-000000000001')::text not like '%NEVER_EXPOSE_PRIVATE_NOTE%','inspect uses explicit baseline allowlist');
select is((public.content_core_list('scholarship',1)->>'total')::integer,1,'bounded list includes existing scholarship');
select lives_ok($$select pg_temp.run('scholarship',pg_temp.source())$$,'manual source observation saved');
insert into ctx values('scholarship_sources',jsonb_build_array(pg_temp.value('scholarship')->>'source_verification_id'));
select lives_ok($$select pg_temp.save('scholarship')$$,'incomplete deadline draft allowed without publication');
insert into ctx values('first_version',pg_temp.value('scholarship')->'version_id');
select throws_ok($$select pg_temp.review('scholarship','submit')$$,'22023','DEADLINE_AMBIGUOUS','scholarship cannot submit without all three deadline decisions');
insert into ctx select 'scholarship_deadlines',jsonb_build_array(
 jsonb_build_object('kind','scholarship_owner','applicability','specified','reason','','cycle_key','2026','raw_text','30 November 2026','precision','date_only','date','2026-11-30','time',null,'timezone',null,'instant',null,'source_verification_id',pg_temp.value('scholarship_sources')->>0),
 jsonb_build_object('kind','thai_nominating_body','applicability','not_applicable','reason','Direct application','cycle_key','2026','raw_text','','precision','date_only','date',null,'time',null,'timezone',null,'instant',null,'source_verification_id',null),
 jsonb_build_object('kind','university_internal','applicability','not_applicable','reason','No university nomination','cycle_key','2026','raw_text','','precision','date_only','date',null,'time',null,'timezone',null,'instant',null,'source_verification_id',null));
select lives_ok($$select pg_temp.save('scholarship')$$,'typed three-level deadline fact sheet saved');
select is((select deadlines->0->>'instant' from public.content_snapshots where id=(select current_snapshot_id from public.content_work_items where id=(pg_temp.value('scholarship')->>'work_item_id')::uuid)),null::text,'date-only deadline has no invented instant');
select is((select count(*)::integer from public.content_snapshots),2,'changed facts/deadlines create a new immutable snapshot');
insert into ctx values('approved_candidate',pg_temp.value('scholarship')->'version_id');
select lives_ok($$select pg_temp.review('scholarship','submit')$$,'complete bilingual version submitted for review');
select throws_ok($$select pg_temp.review('scholarship','approve')$$,'42501','FORBIDDEN','editor cannot self-grant publish permission');

set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000005","role":"authenticated"}';
select lives_ok($$select pg_temp.review('scholarship','approve')$$,'publish reviewer can approve a submitted version');
select is((public.content_core_inspect('scholarship','c1200000-0000-0000-0000-000000000001')->'versions'->0->>'state') in ('approved','stale'),true,'version status is derived from append-only review events');
select throws_ok($$select pg_temp.save('scholarship')$$,'42501','FORBIDDEN','publish-only reviewer cannot edit facts');

set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select to_jsonb(s) from public.scholarships s where id='c1200000-0000-0000-0000-000000000001'),pg_temp.value('canonical_scholarship'),'editing and approval leave existing canonical scholarship byte-equivalent');
select is((select to_jsonb(s) from public.scholarships_public s where id='c1200000-0000-0000-0000-000000000001'),pg_temp.value('public_scholarship'),'public scholarship projection unchanged after approval');
select lives_ok($$select pg_temp.save('scholarship','facebook')$$,'Facebook channel version saved separately');
select is((select count(*)::integer from public.content_snapshots),2,'channel copy save reuses exact canonical snapshot');
select is((select count(*)::integer from public.content_versions),3,'channel versions preserve immutable history');
select lives_ok($$select pg_temp.save('scholarship','facebook',jsonb_build_object('facts',pg_temp.value('facts')||'{"key_points":"Corrected fact"}'))$$,'fact correction creates a fresh snapshot');
select throws_ok($$select pg_temp.review('scholarship','submit',(pg_temp.value('first_version')#>>'{}')::uuid)$$,'PT409','STALE_VERSION','older channel version returns a nonretryable HTTP conflict');
select throws_ok($$select pg_temp.review('scholarship','submit',(pg_temp.value('approved_candidate')#>>'{}')::uuid)$$,'22023','INVALID_TRANSITION','already-approved old version cannot be resubmitted');
select is((select s.facts->>'key_points' from public.content_snapshots s join public.content_versions v on v.snapshot_id=s.id where v.id=(pg_temp.value('approved_candidate')#>>'{}')::uuid),'Verified facts','old approved version retains original fact sheet');
select throws_ok($$select pg_temp.save('scholarship','website',jsonb_build_object('facts',pg_temp.value('facts')||jsonb_build_object('subject',repeat('x',501))))$$,'22023','POLICY_VIOLATION','direct RPC cannot exceed shared subject limit');
select throws_ok($$select pg_temp.save('scholarship','website',jsonb_build_object('facts',pg_temp.value('facts')||jsonb_build_object('subject',repeat(U&'\+01F600',251))))$$,'22023','POLICY_VIOLATION','astral characters use the same UTF16 length limit as the server schema');
select throws_ok($$select pg_temp.save('scholarship','website',jsonb_build_object('facts',pg_temp.value('facts')||jsonb_build_object('subject',U&'\00A0\FEFF\0009')))$$,'22023','POLICY_VIOLATION','Unicode whitespace cannot bypass required fact validation');
select throws_ok($$select pg_temp.save('scholarship','website',jsonb_build_object('facts',pg_temp.value('facts')||'{"actor_id":"forged"}'))$$,'22023','POLICY_VIOLATION','unknown fact fields cannot smuggle privileged context');
select throws_ok($$select pg_temp.run('scholarship',pg_temp.source()||'{"actor_id":"forged"}')$$,'22023','POLICY_VIOLATION','actor is never accepted from command payload');
select throws_ok($$select pg_temp.run('scholarship',pg_temp.source('https://example.test:bad/path'))$$,'22023','POLICY_VIOLATION','malformed URL authority cannot poison source read validation');
select throws_ok($$select pg_temp.run('scholarship',pg_temp.source('https://9999999999/path'))$$,'22023','POLICY_VIOLATION','malformed numeric hostname rejected');
select throws_ok($$select pg_temp.save('scholarship','website',jsonb_build_object('deadlines',jsonb_set(pg_temp.value('scholarship_deadlines'),'{0,time}','"12:00"')))$$,'22023','DEADLINE_AMBIGUOUS','date-only precision rejects invented time');
select throws_ok($$select pg_temp.save('scholarship','website',jsonb_build_object('deadlines',jsonb_set(pg_temp.value('scholarship_deadlines'),'{1,reason}','""')))$$,'22023','POLICY_VIOLATION','not-applicable deadline requires a reason');

select lives_ok($$select pg_temp.run('news',pg_temp.source('https://example.test/news'))$$,'news has independent official source');
insert into ctx values('news_sources',jsonb_build_array(pg_temp.value('news')->>'source_verification_id'));
select throws_ok($$select pg_temp.save('news','website',jsonb_build_object('source_verification_ids',pg_temp.value('scholarship_sources')))$$,'22023','POLICY_VIOLATION','source IDs cannot be borrowed from another work item');
select lives_ok($$select pg_temp.save('news','website',jsonb_build_object('locales',jsonb_set(pg_temp.value('locales'),'{en,body}','""')))$$,'missing English remains an editable draft');
select throws_ok($$select pg_temp.review('news','submit')$$,'22023','MISSING_LOCALE','missing English cannot be submitted');
select lives_ok($$select pg_temp.save('news')$$,'complete news draft saved');
select lives_ok($$select pg_temp.review('news','submit')$$,'complete news submitted');
insert into ctx values('news_pending',pg_temp.value('news')->'version_id');
select lives_ok($$select pg_temp.save('news','facebook',jsonb_build_object('facts',pg_temp.value('facts')||'{"key_points":"Facts corrected after submission"}'))$$,'another channel can correct shared facts while an earlier version awaits review');
set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.review('news','approve',(pg_temp.value('news_pending')#>>'{}')::uuid)$$,'PT409','STALE_SNAPSHOT','approval cannot use a submitted version pinned to superseded facts');
set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$select pg_temp.save('news','website',jsonb_build_object('facts',pg_temp.value('facts')||'{"key_points":"Facts corrected after submission"}'))$$,'new website version is pinned to the current corrected snapshot');
select lives_ok($$select pg_temp.review('news','submit')$$,'corrected news version can be submitted');
update ctx set v=pg_temp.value('news')->'version_id' where k='news_pending';
select lives_ok($$select pg_temp.run('news',pg_temp.source('https://example.test/news','unverified'))$$,'adverse source recheck creates immutable observation');

set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.review('news','approve',(pg_temp.value('news_pending')#>>'{}')::uuid)$$,'22023','SOURCE_STALE','new adverse check supersedes old verified source before expiry');
select lives_ok($$select pg_temp.review('news','return',(pg_temp.value('news_pending')#>>'{}')::uuid)$$,'reviewer can return a stale submitted version for correction');
select throws_ok($$update public.content_snapshots set facts='{}'$$,'42501',null,'authenticated admin has no direct history update grant');
select is((select to_jsonb(n) from public.news_articles n where id='c1200000-0000-0000-0000-000000000002'),pg_temp.value('canonical_news'),'news source and review workflow leave public canonical data untouched');

set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.content_work_items),1,'view-only user sees only exact module work items');
select lives_ok($$select public.content_core_inspect('scholarship','c1200000-0000-0000-0000-000000000001')$$,'view-only user can inspect history');
select throws_ok($$select pg_temp.save('scholarship')$$,'42501','FORBIDDEN','view-only user cannot mutate workflow');
select throws_ok($$select public.content_core_inspect('news','c1200000-0000-0000-0000-000000000002')$$,'42501','FORBIDDEN','published canonical does not expose editorial workspace cross-module');

set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.content_work_items),1,'news-only editor sees only news');
select is((select count(*)::integer from public.content_snapshots where work_item_id=(pg_temp.value('scholarship')->>'work_item_id')::uuid),0,'child RLS follows exact parent permission');
select throws_ok($$select pg_temp.save('scholarship')$$,'42501','FORBIDDEN','cross-module editor cannot modify scholarship');

set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000007","role":"authenticated"}';
select is((select count(*)::integer from public.content_work_items),0,'create/update/publish without view do not expose content');
select throws_ok($$select pg_temp.save('scholarship')$$,'42501','FORBIDDEN','mutations require module view too');
set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select is((select count(*)::integer from public.content_work_items),0,'inactive admin has no editorial reads');
select throws_ok($$select pg_temp.run('new','{"op":"open","kind":"news","record_id":null,"title_th":"Blocked"}')$$,'42501','PROFILE_INACTIVE','inactive admin blocked at command boundary');

reset role;
select throws_ok($$update public.content_snapshots set facts='{}'$$,'55000','CONTENT_HISTORY_IMMUTABLE','snapshot immutability is enforced for database owner too');
select throws_ok($$delete from public.content_review_decisions$$,'55000','CONTENT_HISTORY_IMMUTABLE','review decisions cannot be erased');
select throws_ok($$update public.content_source_verifications set note='rewritten'$$,'55000','CONTENT_HISTORY_IMMUTABLE','source observations are append-only');
select throws_ok($$update private.content_command_receipts set result='{}'$$,'55000','CONTENT_HISTORY_IMMUTABLE','command receipts cannot be rewritten');

-- A fresh new record is private; local authoring does not publish anything.
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$select pg_temp.run('new','{"op":"open","kind":"news","record_id":null,"title_th":"New local editorial record"}')$$,'editor creates a canonical draft and linked work item atomically');
select is((select publication_status::text||':'||public_visible::text from public.news_articles where id=(pg_temp.value('new')->>'record_id')::uuid),'draft:false','new canonical record remains private draft');
select is((select created_by from public.content_work_items where id=(pg_temp.value('new')->>'work_item_id')::uuid),'c1100000-0000-0000-0000-000000000002'::uuid,'actor is derived from authenticated session');
insert into ctx values('new_retry',pg_temp.value('last_command'));
reset role;
update private.module_permissions set can_create=false where user_id='c1100000-0000-0000-0000-000000000002' and module='news';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$select public.content_core_execute(pg_temp.value('new_retry'))$$,'42501','FORBIDDEN','idempotency replay rechecks revoked permission');
reset role;
select * from finish();
rollback;
