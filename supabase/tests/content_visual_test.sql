begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('d1100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','content-visual-'||n||'@example.test','',now(),
  '{"provider":"email","providers":["email"]}',jsonb_build_object('full_name','Content visual '||n),now(),now() from generate_series(1,7) n;
insert into private.user_roles(user_id,role) values
 ('d1100000-0000-0000-0000-000000000001','system_admin'),
 ('d1100000-0000-0000-0000-000000000002','editor'),
 ('d1100000-0000-0000-0000-000000000003','viewer'),
 ('d1100000-0000-0000-0000-000000000004','editor'),
 ('d1100000-0000-0000-0000-000000000005','editor'),
 ('d1100000-0000-0000-0000-000000000006','editor'),
 ('d1100000-0000-0000-0000-000000000007','system_admin');
insert into private.module_permissions(user_id,module,can_view,can_create,can_update,can_publish) values
 ('d1100000-0000-0000-0000-000000000002','news',true,true,true,false),
 ('d1100000-0000-0000-0000-000000000003','news',true,false,false,false),
 ('d1100000-0000-0000-0000-000000000004','scholarship',true,true,true,true),
 ('d1100000-0000-0000-0000-000000000005','news',false,true,true,true),
 ('d1100000-0000-0000-0000-000000000006','news',true,false,false,true);
update public.profiles set active=false where id='d1100000-0000-0000-0000-000000000007';
insert into public.news_articles(id,title_th,title_en,content_th,content_en,publication_status,public_visible,internal_note,created_by) values
 ('d1200000-0000-0000-0000-000000000001','ข่าวต้นฉบับ','Original news','ฉบับเผยแพร่เดิม','Original published body','published',true,'PRIVATE_CANONICAL_NOTE','d1100000-0000-0000-0000-000000000001'),
 ('d1200000-0000-0000-0000-000000000002','ยังไม่อนุมัติ','Not approved','','','draft',false,'','d1100000-0000-0000-0000-000000000001');
insert into public.scholarships(id,title_th,created_by) values('d1200000-0000-0000-0000-000000000003','ทุนอีกโมดูล','d1100000-0000-0000-0000-000000000001');
insert into public.content_work_items(id,kind,news_id,scholarship_id,title,row_version,created_by,updated_by)
select ('d1300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,case when n=3 then 'scholarship' else 'news' end,
 case when n<>3 then ('d1200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid end,
 case when n=3 then 'd1200000-0000-0000-0000-000000000003'::uuid end,'Visual test '||n,5,'d1100000-0000-0000-0000-000000000001','d1100000-0000-0000-0000-000000000001' from generate_series(1,3) n;
insert into public.content_source_verifications(id,work_item_id,requested_url,final_url,publisher,title,official,result,observed_on,valid_until,note,revision,created_by)
select ('d1400000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('d1300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'https://example.test/visual/'||n,'https://example.test/visual/'||n,'Official source','Verified by test',true,'verified',current_date,current_date+30,'Private evidence note',2,'d1100000-0000-0000-0000-000000000001' from generate_series(1,3) n;
insert into public.content_snapshots(id,work_item_id,revision,facts,source_verification_ids,digest,created_by)
select ('d1500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('d1300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,3,
 '{"subject":"Verified facts"}',array[('d1400000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid],repeat('a',64),'d1100000-0000-0000-0000-000000000001' from generate_series(1,3) n;
update public.content_work_items set current_snapshot_id=('d1500000-0000-0000-0000-'||right(id::text,12))::uuid where id::text like 'd1300000-%';
insert into public.content_versions(id,work_item_id,snapshot_id,channel,version_number,locales,digest,created_by)
select ('d1600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('d1300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('d1500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'website',1,'{"th":{"title":"ไทย","body":"เนื้อหา"},"en":{"title":"English","body":"Body"}}',repeat('b',64),'d1100000-0000-0000-0000-000000000001' from generate_series(1,3) n;
insert into public.content_review_decisions(work_item_id,version_id,decision,revision,created_by)
select ('d1300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('d1600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'approved',5,'d1100000-0000-0000-0000-000000000001' from generate_series(1,3) n where n<>2;

create temporary table ctx(k text primary key,v jsonb);
grant select,insert,update on ctx to authenticated,service_role;
insert into ctx values
 ('canonical',(select to_jsonb(n) from public.news_articles n where id='d1200000-0000-0000-0000-000000000001')),
 ('public',(select to_jsonb(n) from public.news_public n where id='d1200000-0000-0000-0000-000000000001')),
 ('links',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.record_assets a where news_id='d1200000-0000-0000-0000-000000000001')),
 ('brief','{"title":"Manual visual","objective":"Explain the news","audience":"Students","key_message":"Verified message","design_notes":"Clear readable layout","brand_notes":"Human-reviewed local brand notes","prompt":"Manual prompt package only","negative_prompt":"No invented facts","width":1200,"height":630,"panels":[{"key":"cover","label":"ภาพปก","notes":"Cover"},{"key":"detail","label":"รายละเอียด","notes":"Details"}]}'),
 ('provenance','{"source_kind":"manual_upload","rights_basis":"owned","rights_note":"Created by our team","attribution":"Team","origin_url":"","parent_asset_id":null}'),
 ('file',jsonb_build_object('original_file_name','visual.png','mime_type','image/png','size_bytes',1024,'width',1200,'height',630,'sha256',repeat('c',64),'uploaded_sha256',repeat('d',64),'transform','visual-raster-v1'));
create function pg_temp.val(p_key text) returns jsonb language sql as $$select v from pg_temp.ctx where k=p_key$$;
create function pg_temp.keep(p_key text,p_value jsonb) returns jsonb language plpgsql as $$begin insert into pg_temp.ctx values(p_key,p_value) on conflict(k) do update set v=excluded.v; return p_value; end;$$;
create function pg_temp.run(p_command jsonb) returns jsonb language plpgsql as $$
declare command jsonb; work_id uuid:=coalesce((p_command->>'work_item_id')::uuid,'d1300000-0000-0000-0000-000000000001'::uuid); result jsonb;
begin
 command:=jsonb_build_object('work_item_id',work_id,'expected_revision',(select row_version from public.content_work_items where id=work_id),'idempotency_key',gen_random_uuid())||p_command;
 result:=public.content_visual_execute(command);
 perform pg_temp.keep('last_command',command); perform pg_temp.keep('last_result',result); return result;
end;$$;
create function pg_temp.save_brief(p_overrides jsonb default '{}') returns jsonb language sql as $$select pg_temp.run(jsonb_build_object('op','save_brief','content_version_id','d1600000-0000-0000-0000-000000000001','brief',pg_temp.val('brief'))||p_overrides)$$;
create function pg_temp.review_brief(p_decision text) returns jsonb language sql as $$select pg_temp.run(jsonb_build_object('op','review_brief','brief_id',pg_temp.val('brief_id'),'decision',p_decision,'note','Review note'))$$;
create function pg_temp.reserve(p_overrides jsonb default '{}') returns jsonb language sql as $$select pg_temp.run(jsonb_build_object('op','reserve_upload','brief_id',pg_temp.val('brief_id'),'provenance',pg_temp.val('provenance'),'file',pg_temp.val('file'))||p_overrides)$$;
create function pg_temp.save_set(p_overrides jsonb default '{}') returns jsonb language sql as $$select pg_temp.run(jsonb_build_object('op','save_set','brief_id',pg_temp.val('brief_id'),'slots',pg_temp.val('slots'))||p_overrides)$$;
create function pg_temp.review_set(p_decision text) returns jsonb language sql as $$select pg_temp.run(jsonb_build_object('op','review_set','asset_set_id',pg_temp.val('set_id'),'decision',p_decision,'note','Review note'))$$;

select is((select public from storage.buckets where id='content-working'),false,'content-working is private');
select ok(not has_function_privilege('authenticated','public.content_visual_finalize_upload(uuid,uuid,jsonb)','EXECUTE'),'clients cannot forge verified image metadata');
select ok(not has_function_privilege('authenticated','public.content_visual_asset_file(uuid,uuid)','EXECUTE'),'clients cannot spoof an actor for file lookup');
select ok(not has_function_privilege('anon','public.content_visual_inspect(uuid)','EXECUTE'),'anonymous cannot inspect visual drafts');
select ok(not has_table_privilege('authenticated','public.visual_brief_versions','INSERT'),'briefs cannot bypass command validation');
select ok(not has_table_privilege('authenticated','private.content_visual_uploads','SELECT'),'reservation paths are private');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$select pg_temp.save_brief('{"work_item_id":"d1300000-0000-0000-0000-000000000002","content_version_id":"d1600000-0000-0000-0000-000000000002"}')$$,'22023','VERSION_NOT_APPROVED','unapproved content cannot start a visual brief');
select throws_ok($$select pg_temp.save_brief(jsonb_build_object('brief',pg_temp.val('brief')||'{"width":4096,"height":4096}'))$$,'22023','POLICY_VIOLATION','pixel-area bound is enforced at RPC');
select throws_ok($$select pg_temp.save_brief(jsonb_build_object('brief',pg_temp.val('brief')||'{"actor_id":"forged"}'))$$,'22023','POLICY_VIOLATION','brief rejects hidden fields');
select throws_ok($$select pg_temp.save_brief(jsonb_build_object('brief',jsonb_set(pg_temp.val('brief'),'{panels,1,key}','"cover"')))$$,'22023','POLICY_VIOLATION','semantic panel keys must be unique');
select lives_ok($$select pg_temp.save_brief(jsonb_build_object('brief',pg_temp.val('brief')||'{"brand_notes":""}'))$$,'incomplete brand notes can remain a brief draft');
select pg_temp.keep('brief_id',pg_temp.val('last_result')->'brief_id');
select throws_ok($$select pg_temp.review_brief('submit')$$,'22023','POLICY_VIOLATION','review requires explicit brand notes');
select lives_ok($$select pg_temp.save_brief()$$,'editor saves a brief pinned to approved content');
select pg_temp.keep('brief_id',pg_temp.val('last_result')->'brief_id');
select pg_temp.keep('first_brief',pg_temp.val('brief_id'));
select pg_temp.keep('save_command',pg_temp.val('last_command'));
select is(public.content_visual_execute(pg_temp.val('last_command')),pg_temp.val('last_result'),'same command replays the same result');
select throws_ok($$select public.content_visual_execute(pg_temp.val('last_command')||'{"expected_revision":999}')$$,'22023','IDEMPOTENCY_CONFLICT','same key changed request is rejected');
select throws_ok($$select pg_temp.save_brief('{"expected_revision":5}')$$,'PT409','STALE_REVISION','outdated editor cannot overwrite visual work');
select throws_ok($$select pg_temp.reserve()$$,'22023','BRIEF_NOT_APPROVED','images require separately approved brief');
select lives_ok($$select pg_temp.review_brief('submit')$$,'editor submits a brief');
select throws_ok($$select pg_temp.review_brief('approve')$$,'42501','FORBIDDEN','editor cannot approve brief');
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select lives_ok($$select pg_temp.review_brief('approve')$$,'publish reviewer approves the exact submitted brief');
select throws_ok($$select pg_temp.save_brief()$$,'42501','FORBIDDEN','publish-only reviewer cannot author briefs');
select is(public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')->'briefs'->0->>'state','approved','inspect derives approved brief state');

set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$select pg_temp.reserve(jsonb_build_object('file',pg_temp.val('file')||'{"width":600}'))$$,'22023','ASSET_NOT_READY','wrong dimensions cannot be reserved');
select throws_ok($$select pg_temp.reserve(jsonb_build_object('file',pg_temp.val('file')||'{"original_file_name":"../escape.png"}'))$$,'22023','POLICY_VIOLATION','client cannot supply a path as filename');
select throws_ok($$select pg_temp.reserve(jsonb_build_object('provenance',pg_temp.val('provenance')||'{"rights_note":""}'))$$,'22023','POLICY_VIOLATION','manual asset requires rights evidence');
select pg_temp.keep('before_reserve',to_jsonb((select row_version from public.content_work_items where id='d1300000-0000-0000-0000-000000000001')));
select lives_ok($$select pg_temp.keep('upload1',pg_temp.reserve())$$,'authenticated actor reserves a safe private upload path');
select pg_temp.keep('reserve_command',pg_temp.val('last_command'));
select is(to_jsonb((select row_version from public.content_work_items where id='d1300000-0000-0000-0000-000000000001')),pg_temp.val('before_reserve'),'reservation is operational and does not change editorial revision');
select ok(pg_temp.val('upload1')->>'storage_path' ~ '^work-items/d1300000-0000-0000-0000-000000000001/[0-9a-f-]{36}\.png$','reservation generates an opaque contained path');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('content-working','unauthorized.png','d1100000-0000-0000-0000-000000000002')$$,'42501',null,'authenticated direct Storage upload is denied');
select throws_ok($$select public.content_visual_finalize_upload('d1100000-0000-0000-0000-000000000002',(pg_temp.val('upload1')->>'upload_id')::uuid,pg_temp.val('file'))$$,'42501',null,'authenticated cannot execute trusted finalizer');

reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('content-working',pg_temp.val('upload1')->>'storage_path','d1100000-0000-0000-0000-000000000002','{"mimetype":"image/png","size":1024}');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select throws_ok($$select public.content_visual_finalize_upload('d1100000-0000-0000-0000-000000000004',(pg_temp.val('upload1')->>'upload_id')::uuid,pg_temp.val('file'))$$,'42501','FORBIDDEN','trusted finalizer rejects actor/reservation mismatch');
select throws_ok($$select public.content_visual_finalize_upload('d1100000-0000-0000-0000-000000000002',(pg_temp.val('upload1')->>'upload_id')::uuid,pg_temp.val('file')||jsonb_build_object('sha256',repeat('e',64)))$$,'22023','IDEMPOTENCY_CONFLICT','trusted verification must match pinned upload fingerprint');
select lives_ok($$select pg_temp.keep('final1',public.content_visual_finalize_upload('d1100000-0000-0000-0000-000000000002',(pg_temp.val('upload1')->>'upload_id')::uuid,pg_temp.val('file')))$$,'trusted finalized raster creates an immutable asset');
select is(public.content_visual_finalize_upload('d1100000-0000-0000-0000-000000000002',(pg_temp.val('upload1')->>'upload_id')::uuid,pg_temp.val('file')),pg_temp.val('final1'),'finalize retry returns one original asset and revision');
select is(public.content_visual_asset_file('d1100000-0000-0000-0000-000000000003',(pg_temp.val('final1')->>'asset_id')::uuid)->>'storage_path',pg_temp.val('upload1')->>'storage_path','service file lookup admits current exact-module viewer');
select throws_ok($$select public.content_visual_asset_file('d1100000-0000-0000-0000-000000000004',(pg_temp.val('final1')->>'asset_id')::uuid)$$,'42501','FORBIDDEN','file lookup rejects a viewer of another module');
select throws_ok($$select public.content_visual_asset_file('d1100000-0000-0000-0000-000000000007',(pg_temp.val('final1')->>'asset_id')::uuid)$$,'42501','FORBIDDEN','file lookup rejects inactive admin');
reset role;
select is((select count(*)::integer from public.content_manual_assets where work_item_id='d1300000-0000-0000-0000-000000000001'),1,'repeated finalize created exactly one asset');
select throws_ok($$update public.assets set is_public=true where id=(pg_temp.val('final1')->>'asset_id')::uuid$$,'55000','CONTENT_HISTORY_IMMUTABLE','registered metadata cannot be mutated by owner');
select throws_ok($$delete from public.content_manual_assets where asset_id=(pg_temp.val('final1')->>'asset_id')::uuid$$,'55000','CONTENT_HISTORY_IMMUTABLE','registered image history cannot be deleted');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(public.content_visual_execute(pg_temp.val('reserve_command'))->>'asset_id',pg_temp.val('final1')->>'asset_id','reservation retry reveals completion and prevents reupload');
select is((select count(*)::integer from storage.objects where bucket_id='content-working'),0,'authenticated cannot bypass proxy with a Storage read');
select is((select count(*)::integer from public.assets where id=(pg_temp.val('final1')->>'asset_id')::uuid),0,'raw registry path is not exposed to content editor');
select ok(public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')::text not like '%storage_path%','inspect never exposes internal object paths');
select pg_temp.keep('upload2',pg_temp.reserve(jsonb_build_object('provenance',pg_temp.val('provenance')||jsonb_build_object('parent_asset_id',pg_temp.val('final1')->>'asset_id'))));
reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('content-working',pg_temp.val('upload2')->>'storage_path','d1100000-0000-0000-0000-000000000002','{"mimetype":"image/png","size":1024}');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select lives_ok($$select pg_temp.keep('final2',public.content_visual_finalize_upload('d1100000-0000-0000-0000-000000000002',(pg_temp.val('upload2')->>'upload_id')::uuid,pg_temp.val('file')))$$,'manual successor gets a new object/asset and parent lineage');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.keep('slots',jsonb_build_array(
 jsonb_build_object('panel_key','detail','asset_id',pg_temp.val('final2')->>'asset_id','alt_text_th','ภาพรายละเอียด','alt_text_en','Detail image'),
 jsonb_build_object('panel_key','cover','asset_id',pg_temp.val('final1')->>'asset_id','alt_text_th','ภาพปก','alt_text_en','Cover image')));
select throws_ok($$select pg_temp.save_set(jsonb_build_object('slots',jsonb_set(pg_temp.val('slots'),'{1,panel_key}','"detail"')))$$,'22023','POLICY_VIOLATION','asset set rejects duplicate semantic panel');
select lives_ok($$select pg_temp.save_set(jsonb_build_object('slots',jsonb_build_array(pg_temp.val('slots')->0)))$$,'incomplete asset selection can remain a draft');
select pg_temp.keep('set_id',pg_temp.val('last_result')->'asset_set_id');
select throws_ok($$select pg_temp.review_set('submit')$$,'22023','POLICY_VIOLATION','incomplete panel coverage cannot be submitted');
select lives_ok($$select pg_temp.save_set()$$,'complete ordered asset set saved as a new revision');
select pg_temp.keep('set_id',pg_temp.val('last_result')->'asset_set_id');
select is(public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')->'asset_sets'->0->'slots'->0->>'panel_key','detail','physical ordering is independent from semantic panel order');
select lives_ok($$select pg_temp.review_set('submit')$$,'complete bilingual asset set submitted');
select throws_ok($$select pg_temp.review_set('approve')$$,'42501','FORBIDDEN','image author cannot self-grant approval');
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select lives_ok($$select pg_temp.review_set('approve')$$,'publish reviewer approves the exact ordered asset set');
select is(public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')->'asset_sets'->0->>'state','approved','approved image set is distinct from publication');
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.keep('pending',pg_temp.reserve());
select pg_temp.keep('pending_command',pg_temp.val('last_command'));
select lives_ok($$select pg_temp.save_brief()$$,'brief correction creates an immutable successor');
select pg_temp.keep('brief_id',pg_temp.val('last_result')->'brief_id');
select is(public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')->'briefs'->0->'id',pg_temp.val('brief_id'),'history follows semantic revision even when transaction timestamps are identical');
select throws_ok($$select public.content_visual_execute(pg_temp.val('pending_command'))$$,'PT409','STALE_REVISION','pending upload retry stops before storage when another edit changed revision');
select is(public.content_visual_execute(pg_temp.val('reserve_command'))->>'asset_id',pg_temp.val('final1')->>'asset_id','completed upload retry still returns its asset after brief became stale');
select is(public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')->'asset_sets'->0->>'state','stale','new brief makes the old approved asset set stale');
select throws_ok($$select pg_temp.save_set()$$,'22023','BRIEF_NOT_APPROVED','successor brief must be approved before images may be selected');
select lives_ok($$select pg_temp.review_brief('submit')$$,'successor brief can be submitted');
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select lives_ok($$select pg_temp.review_brief('return')$$,'reviewer can return a brief with a reason');
select is(public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')->'briefs'->0->>'state','returned','return review remains visible as immutable history');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select throws_ok($$select public.content_visual_finalize_upload('d1100000-0000-0000-0000-000000000002',(pg_temp.val('pending')->>'upload_id')::uuid,pg_temp.val('file'))$$,'PT409','STALE_REVISION','upload finishing after another edit cannot overwrite revision');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$select pg_temp.review_brief('submit')$$,'returned current brief can be resubmitted');
select lives_ok($$select public.content_core_execute(jsonb_build_object('op','record_source','work_item_id','d1300000-0000-0000-0000-000000000001',
 'expected_revision',(select row_version from public.content_work_items where id='d1300000-0000-0000-0000-000000000001'),'idempotency_key',gen_random_uuid(),
 'source',jsonb_build_object('title','Adverse recheck','publisher','Official source','requested_url','https://example.test/visual/1','final_url','https://example.test/visual/1',
 'observed_on',current_date,'valid_until',current_date+30,'official',true,'result','unverified','note','Supersedes prior human verification')))$$,'source recheck remains in Core workflow');
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select throws_ok($$select pg_temp.review_brief('approve')$$,'22023','VERSION_NOT_APPROVED','source supersession blocks visual approval even with a previously approved content version');
select is(public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')->'briefs'->0->>'state','stale','brief status dynamically follows source freshness');
select lives_ok($$select pg_temp.review_brief('return')$$,'stale submitted brief can still be returned for correction');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$select public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')$$,'read-only viewer can inspect history');
select throws_ok($$select pg_temp.save_brief()$$,'42501','FORBIDDEN','read-only viewer cannot author visuals');
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.visual_brief_versions),0,'cross-module RLS hides visual history');
select throws_ok($$select public.content_visual_inspect('d1300000-0000-0000-0000-000000000001')$$,'42501','FORBIDDEN','cross-module read RPC is denied');
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok($$select public.content_visual_execute(pg_temp.val('save_command'))$$,'42501','FORBIDDEN','update without exact module view is insufficient');
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000007","role":"authenticated"}';
select throws_ok($$select public.content_visual_execute(pg_temp.val('save_command'))$$,'42501','PROFILE_INACTIVE','inactive admin cannot replay commands');

reset role;
update private.module_permissions set can_update=false where user_id='d1100000-0000-0000-0000-000000000002' and module='news';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"d1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$select public.content_visual_execute(pg_temp.val('reserve_command'))$$,'42501','FORBIDDEN','reservation replay rechecks revoked permission before returning result');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select throws_ok($$select public.content_visual_finalize_upload('d1100000-0000-0000-0000-000000000002',(pg_temp.val('upload1')->>'upload_id')::uuid,pg_temp.val('file'))$$,'42501','FORBIDDEN','finalization replay also rechecks revoked permission');
reset role;
select throws_ok($$update public.visual_brief_versions set brief='{}'$$,'55000','CONTENT_HISTORY_IMMUTABLE','brief history cannot be rewritten');
select throws_ok($$delete from public.content_asset_sets$$,'55000','CONTENT_HISTORY_IMMUTABLE','ordered asset history cannot be deleted');
select throws_ok($$update public.content_visual_reviews set note='erased'$$,'55000','CONTENT_HISTORY_IMMUTABLE','review audit cannot be rewritten');
select throws_ok($$update private.content_visual_uploads set storage_path='elsewhere.png'$$,'55000','CONTENT_HISTORY_IMMUTABLE','upload path and provenance cannot be changed');
select is((select to_jsonb(n) from public.news_articles n where id='d1200000-0000-0000-0000-000000000001'),pg_temp.val('canonical'),'visual workflow leaves existing canonical news byte-equivalent');
select is((select to_jsonb(n) from public.news_public n where id='d1200000-0000-0000-0000-000000000001'),pg_temp.val('public'),'visual workflow leaves anonymous public projection byte-equivalent');
select is((select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.record_assets a where news_id='d1200000-0000-0000-0000-000000000001'),pg_temp.val('links'),'visual workflow does not mutate public record_assets');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is((select count(*)::integer from public.assets where storage_bucket='content-working'),0,'anonymous cannot discover private content asset metadata');
select is((select count(*)::integer from storage.objects where bucket_id='content-working'),0,'anonymous cannot access working image objects');
reset role;
select * from finish();
rollback;
