begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.uid(p_prefix integer,p_number integer) returns uuid language sql immutable as $$
select ('e'||lpad(p_prefix::text,2,'0')||'00000-0000-0000-0000-'||lpad(p_number::text,12,'0'))::uuid;
$$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select pg_temp.uid(11,n),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','publication-bundle-'||n||'@example.test','',now(),
 '{"provider":"email","providers":["email"]}',jsonb_build_object('full_name','Publication test '||n),now(),now() from generate_series(1,8) n;
insert into private.user_roles(user_id,role) values
 (pg_temp.uid(11,1),'system_admin'),(pg_temp.uid(11,2),'editor'),(pg_temp.uid(11,3),'viewer'),(pg_temp.uid(11,4),'editor'),
 (pg_temp.uid(11,5),'editor'),(pg_temp.uid(11,6),'editor'),(pg_temp.uid(11,7),'system_admin'),(pg_temp.uid(11,8),'office_admin');
insert into private.module_permissions(user_id,module,can_view,can_create,can_update,can_publish) values
 (pg_temp.uid(11,2),'news',true,true,true,false),(pg_temp.uid(11,3),'news',true,false,false,false),
 (pg_temp.uid(11,4),'scholarship',true,true,true,true),(pg_temp.uid(11,5),'news',false,true,true,true),(pg_temp.uid(11,6),'news',true,false,false,true);
update public.profiles set active=false where id=pg_temp.uid(11,7);
insert into public.news_articles(id,title_th,title_en,content_th,content_en,publication_status,public_visible,internal_note,created_by)
select pg_temp.uid(12,n),'ต้นฉบับ '||n,'Original '||n,'เนื้อหาเดิม','Original body','published',true,'PRIVATE_CANONICAL_NOTE',pg_temp.uid(11,1) from generate_series(1,8)n where n<>4;
insert into public.scholarships(id,title_th,created_by) values(pg_temp.uid(12,4),'ทุนเดิม',pg_temp.uid(11,1));
insert into public.content_work_items(id,kind,news_id,scholarship_id,title,row_version,created_by,updated_by)
select pg_temp.uid(13,n),case when n=4 then 'scholarship' else 'news' end,case when n<>4 then pg_temp.uid(12,n) end,
 case when n=4 then pg_temp.uid(12,n) end,'Bundle work '||n,20,pg_temp.uid(11,1),pg_temp.uid(11,1) from generate_series(1,8)n;
insert into public.content_source_verifications(id,work_item_id,requested_url,final_url,publisher,title,official,result,observed_on,valid_until,note,revision,created_by)
select pg_temp.uid(14,n),pg_temp.uid(13,n),'https://example.test/bundle/'||n,'https://example.test/bundle/'||n,'PRIVATE_PUBLISHER','PRIVATE_SOURCE_TITLE',true,'verified',current_date,current_date+30,'PRIVATE_SOURCE_NOTE',2,pg_temp.uid(11,1) from generate_series(1,8)n;
insert into public.content_snapshots(id,work_item_id,revision,facts,source_verification_ids,digest,created_by)
select pg_temp.uid(15,n),pg_temp.uid(13,n),3,'{"subject":"PRIVATE_SNAPSHOT_FACT"}',array[pg_temp.uid(14,n)],repeat('a',64),pg_temp.uid(11,1) from generate_series(1,8)n;
update public.content_work_items set current_snapshot_id=pg_temp.uid(15,right(id::text,12)::integer) where id::text like 'e1300000-%';
insert into public.content_versions(id,work_item_id,snapshot_id,channel,version_number,locales,digest,created_by)
select pg_temp.uid(16,n),pg_temp.uid(13,case when n=9 then 1 else n end),pg_temp.uid(15,case when n=9 then 1 else n end),case when n=9 then 'facebook' else 'website' end,1,
 '{"th":{"title":"ชื่อที่อนุมัติ","summary":"สรุป","body":"เนื้อหา","coverage":"สิทธิประโยชน์"},"en":{"title":"Approved title","summary":"Summary","body":"Body","coverage":"Coverage"}}',repeat('b',64),pg_temp.uid(11,1) from generate_series(1,9)n;
insert into public.content_review_decisions(work_item_id,version_id,decision,revision,created_by)
select pg_temp.uid(13,case when n=9 then 1 else n end),pg_temp.uid(16,n),'approved',case when n=9 then 6 else 5 end,pg_temp.uid(11,1) from generate_series(1,9)n;
create temporary table ctx(k text primary key,v jsonb);
grant select,insert,update on ctx to authenticated,service_role;
insert into ctx values
 ('brief','{"title":"Approved visual","objective":"Explain","audience":"Students","key_message":"Verified","design_notes":"PRIVATE_DESIGN","brand_notes":"PRIVATE_BRAND","prompt":"PRIVATE_PROMPT","negative_prompt":"PRIVATE_NEGATIVE","width":1200,"height":630,"panels":[{"key":"cover","label":"Cover label","notes":"PRIVATE_PANEL"},{"key":"detail","label":"Detail label","notes":"PRIVATE_PANEL"}]}'),
 ('canonical',(select jsonb_agg(to_jsonb(n) order by id) from public.news_articles n where id::text like 'e1200000-%')),
 ('public',(select jsonb_agg(to_jsonb(n) order by id) from public.news_public n where id::text like 'e1200000-%')),
 ('links',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.record_assets a where news_id::text like 'e1200000-%'));
create function pg_temp.val(p_key text) returns jsonb language sql as $$select v from pg_temp.ctx where k=p_key$$;
create function pg_temp.keep(p_key text,p_value jsonb) returns jsonb language plpgsql as $$begin insert into pg_temp.ctx values(p_key,p_value) on conflict(k) do update set v=excluded.v; return p_value; end;$$;
insert into public.visual_brief_versions(id,work_item_id,content_version_id,version_number,brief,digest,revision,created_by)
select pg_temp.uid(17,n),pg_temp.uid(13,case when n=9 then 1 else n end),pg_temp.uid(16,n),1,pg_temp.val('brief'),repeat('c',64),case when n=9 then 10 else 7 end,pg_temp.uid(11,1) from generate_series(1,9)n;
insert into private.content_visual_uploads(id,work_item_id,brief_id,actor_id,expected_revision,provenance,file,storage_path)
select pg_temp.uid(18,n),pg_temp.uid(13,case when (n+1)/2=9 then 1 else (n+1)/2 end),pg_temp.uid(17,(n+1)/2),pg_temp.uid(11,1),12,
 '{"source_kind":"manual_upload","rights_basis":"owned","rights_note":"PRIVATE_RIGHTS","attribution":"Visible attribution","origin_url":"https://example.test/PRIVATE_ORIGIN","parent_asset_id":null}',
 jsonb_build_object('original_file_name','PRIVATE_ORIGINAL.png','mime_type','image/png','size_bytes',1024,'width',1200,'height',630,'sha256',repeat('d',64),'uploaded_sha256',repeat('e',64),'transform','visual-raster-v1'),
 'work-items/'||pg_temp.uid(13,case when (n+1)/2=9 then 1 else (n+1)/2 end)::text||'/'||pg_temp.uid(18,n)::text||'.png' from generate_series(1,18)n;
insert into public.assets(id,storage_bucket,storage_path,original_file_name,mime_type,size_bytes,is_public,created_by,sha256,uploaded_sha256,width,height,source_kind,rights_basis,rights_note,attribution,origin_url)
select pg_temp.uid(19,n),'content-working',u.storage_path,'PRIVATE_ORIGINAL.png','image/png',1024,false,pg_temp.uid(11,1),repeat('d',64),repeat('e',64),1200,630,'manual_upload','owned','PRIVATE_RIGHTS','Visible attribution','https://example.test/PRIVATE_ORIGIN'
 from generate_series(1,18)n join private.content_visual_uploads u on u.id=pg_temp.uid(18,n);
insert into public.content_manual_assets(asset_id,work_item_id,brief_id,upload_id,revision,created_by)
select pg_temp.uid(19,n),u.work_item_id,u.brief_id,u.id,12,pg_temp.uid(11,1) from generate_series(1,18)n join private.content_visual_uploads u on u.id=pg_temp.uid(18,n);
insert into storage.objects(bucket_id,name,metadata)
select 'content-working',u.storage_path,'{"mimetype":"image/png","size":1024}' from private.content_visual_uploads u where id::text like 'e1800000-%';
insert into public.content_asset_sets(id,work_item_id,brief_id,version_number,slots,digest,revision,created_by)
select pg_temp.uid(20,n),b.work_item_id,b.id,1,jsonb_build_array(
 jsonb_build_object('panel_key','detail','asset_id',pg_temp.uid(19,n*2),'alt_text_th','รายละเอียด','alt_text_en','Details'),
 jsonb_build_object('panel_key','cover','asset_id',pg_temp.uid(19,n*2-1),'alt_text_th','ปก','alt_text_en','Cover')),repeat('f',64),case when n=9 then 15 else 13 end,pg_temp.uid(11,1)
 from generate_series(1,9)n join public.visual_brief_versions b on b.id=pg_temp.uid(17,n);
insert into public.content_visual_reviews(work_item_id,target_kind,brief_id,asset_set_id,decision,revision,created_by)
select b.work_item_id,'brief',b.id,null,'approved',case when n=9 then 11 else 8 end,pg_temp.uid(11,1) from generate_series(1,9)n join public.visual_brief_versions b on b.id=pg_temp.uid(17,n)
union all select s.work_item_id,'asset_set',null,s.id,case when n=8 then 'submitted' else 'approved' end,case when n=9 then 16 else 14 end,pg_temp.uid(11,1) from generate_series(1,9)n join public.content_asset_sets s on s.id=pg_temp.uid(20,n);
create function pg_temp.freeze(p_set integer default 1,p_overrides jsonb default '{}') returns jsonb language plpgsql as $$
declare command jsonb; work_id uuid:=pg_temp.uid(13,case when p_set=9 then 1 else p_set end); result jsonb;
begin
 command:=jsonb_build_object('op','freeze_bundle','work_item_id',work_id,'asset_set_id',pg_temp.uid(20,p_set),'expected_revision',coalesce((select row_version from public.content_work_items where id=work_id),20),'idempotency_key',gen_random_uuid())||p_overrides;
 result:=public.content_publication_execute(command); perform pg_temp.keep('last_command',command); perform pg_temp.keep('last_result',result); return result;
end;$$;
create function pg_temp.inspect(p_work integer default 1,p_bundle uuid default null) returns jsonb language sql as $$select public.content_publication_inspect(pg_temp.uid(13,p_work),p_bundle)$$;

select ok(not has_function_privilege('anon','public.content_publication_execute(jsonb)','EXECUTE'),'anonymous cannot freeze');
select ok(not has_function_privilege('anon','public.content_publication_inspect(uuid,uuid)','EXECUTE'),'anonymous cannot inspect');
select ok(not has_function_privilege('service_role','public.content_publication_execute(jsonb)','EXECUTE'),'service key alone cannot freeze as a user');
select ok(not has_function_privilege('authenticated','private.content_publication_assets_ready(uuid)','EXECUTE'),'readiness helper is private');
select ok(not has_function_privilege('authenticated','private.content_publication_issues(uuid)','EXECUTE'),'issue helper is private');
select ok(not has_table_privilege('authenticated','public.content_publication_bundles','INSERT'),'client bundle insert forbidden');
select ok(not has_table_privilege('authenticated','public.content_publication_bundles','UPDATE'),'client bundle update forbidden');
select ok(not has_table_privilege('authenticated','public.content_publication_bundles','DELETE'),'client bundle delete forbidden');
select ok(not has_table_privilege('service_role','public.content_publication_bundles','INSERT'),'service bypass insert forbidden');
select ok(not has_table_privilege('authenticated','private.content_publication_receipts','SELECT'),'receipts private');
select ok((select relrowsecurity from pg_class where oid='public.content_publication_bundles'::regclass),'bundle table RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.content_publication_receipts'::regclass),'receipt table RLS enabled');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$select pg_temp.freeze()$$,'42501','FORBIDDEN','update permission does not imply publication preparation');
select is(jsonb_array_length(pg_temp.inspect()->'candidates'),2,'editor can inspect both approved channels');
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$select pg_temp.freeze()$$,'42501','FORBIDDEN','viewer cannot freeze');
select lives_ok($$select pg_temp.inspect()$$,'viewer can inspect');
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$select pg_temp.freeze()$$,'42501','FORBIDDEN','other module publisher cannot freeze news');
select throws_ok($$select pg_temp.inspect()$$,'42501','FORBIDDEN','other module publisher cannot inspect news');
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok($$select pg_temp.freeze()$$,'42501','FORBIDDEN','publish without view is rejected');
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000007","role":"authenticated"}';
select throws_ok($$select pg_temp.freeze()$$,'42501','PROFILE_INACTIVE','inactive admin cannot freeze');
select throws_ok($$select pg_temp.inspect()$$,'42501','FORBIDDEN','inactive admin cannot inspect');
set local "request.jwt.claims"='{"role":"authenticated"}';
select throws_ok($$select pg_temp.inspect()$$,'42501','AUTH_REQUIRED','missing user identity rejected');
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select throws_ok($$select pg_temp.freeze(1,'{"actor_id":"forged"}')$$,'22023','POLICY_VIOLATION','command rejects actor injection');
select throws_ok($$select pg_temp.freeze(1,'{"payload":{"title":"forged"}}')$$,'22023','POLICY_VIOLATION','command never accepts payload from client');
select throws_ok($$select pg_temp.freeze(1,'{"op":"publish"}')$$,'22023','POLICY_VIOLATION','publication operation is absent');
select throws_ok($$select pg_temp.freeze(1,'{"expected_revision":"20"}')$$,'22023','POLICY_VIOLATION','revision requires a number');
select throws_ok($$select pg_temp.freeze(1,'{"expected_revision":19}')$$,'PT409','STALE_REVISION','stale editor must reload');
select throws_ok($$select pg_temp.freeze(1,jsonb_build_object('asset_set_id',pg_temp.uid(20,7)))$$,'P0002','NOT_FOUND','cross-work approved set rejected');
select throws_ok($$select pg_temp.freeze(8)$$,'22023','ASSET_SET_NOT_APPROVED','submitted set not eligible');
select is(jsonb_array_length(pg_temp.inspect(8)->'candidates'),0,'submitted set absent from candidates');
select lives_ok($$select pg_temp.keep('first',pg_temp.freeze())$$,'publish-only reviewer can freeze approved set');
select pg_temp.keep('first_command',pg_temp.val('last_command'));
select pg_temp.keep('first_payload',pg_temp.inspect()->'selected'->'payload');
select is(pg_temp.val('first')->>'row_version','21','new bundle increments shared revision once');
select is(pg_temp.val('first')->>'reused','false','new bundle reported as created');
select is(pg_temp.inspect()->'selected'->>'state','current','new bundle current');
select is(pg_temp.inspect()->'selected'->'issues','[]'::jsonb,'current bundle has no issues');
select is(pg_temp.inspect()->'selected'->>'bundle_id',null::text,'detail uses stable id rather than a duplicate result key');
select is(pg_temp.inspect()->'selected'->'payload'->>'channel','website','channel derived from pinned content');
select is(pg_temp.inspect()->'selected'->'payload'->'images'->0->>'panel_key','detail','approved slot order preserved');
select is(pg_temp.inspect()->'selected'->'payload'->'images'->0->>'order','1','order explicitly one based');
select is(pg_temp.inspect()->'selected'->'payload'->'images'->1->>'label','Cover label','labels projected from semantic panels');
select is(pg_temp.inspect()->'selected'->'payload'->'images'->0->>'attribution','Visible attribution','credit retained');
select is(pg_temp.inspect()->'selected'->'payload'->'images'->0->>'sha256',repeat('d',64),'normalized byte hash pinned');
select is(pg_temp.inspect()->'selected'->'payload'->'locales'->'en'->>'title','Approved title','approved bilingual content pinned');
select ok(pg_temp.inspect()::text not like '%PRIVATE_%','private notes filenames URLs prompts source facts absent from projection');
select ok(pg_temp.inspect()::text !~ 'storage_path|storage_bucket|rights_note|uploaded_sha256|created_by|requested_url|negative_prompt','inspection contains no operational/private fields');
select is(public.content_publication_execute(pg_temp.val('first_command')),pg_temp.val('first'),'same exact key returns original result');
select throws_ok($$select public.content_publication_execute(pg_temp.val('first_command')||'{"expected_revision":21}')$$,'22023','IDEMPOTENCY_CONFLICT','same key different command rejected');
select lives_ok($$select pg_temp.keep('reuse',pg_temp.freeze())$$,'fresh new key reuses same approved set');
select is(pg_temp.val('reuse')->>'bundle_id',pg_temp.val('first')->>'bundle_id','same set deduplicates to one bundle');
select is(pg_temp.val('reuse')->>'row_version','21','reused bundle does not bump revision');
select is(pg_temp.val('reuse')->>'reused','true','dedupe is explicit');
select is(jsonb_array_length(pg_temp.inspect()->'bundles'),1,'dedupe leaves one immutable bundle');
select lives_ok($$select pg_temp.keep('facebook',pg_temp.freeze(9))$$,'independent Facebook bundle supported');
select is(pg_temp.inspect()->'selected'->>'version_number','1','version numbers are per channel');
select is(pg_temp.inspect()->'selected'->>'channel','facebook','default selection follows revision');
select is(pg_temp.inspect()->'selected'->>'based_on_id',null::text,'first other-channel bundle has no cross-channel predecessor');
select is(pg_temp.inspect(1,(pg_temp.val('first')->>'bundle_id')::uuid)->'selected'->'payload',pg_temp.val('first_payload'),'explicit historical selection keeps exact payload');
select throws_ok($$select pg_temp.inspect(7,(pg_temp.val('first')->>'bundle_id')::uuid)$$,'P0002','NOT_FOUND','bundle ID cannot cross work boundary');
reset role;
select is((select count(*)::integer from public.content_publication_bundles where work_item_id=pg_temp.uid(13,1)),2,'two channels create exactly two rows');
select is((select digest from public.content_publication_bundles where id=(pg_temp.val('first')->>'bundle_id')::uuid),
 (select private.content_digest(jsonb_build_object('schema_version',1,'hash_algorithm','sha256','canonicalization','postgres-jsonb-text-v1','work_item_id',work_item_id,
 'snapshot_id',snapshot_id,'snapshot_digest',snapshot_digest,'content_version_id',content_version_id,'content_digest',content_digest,'brief_id',brief_id,'brief_digest',brief_digest,
 'asset_set_id',asset_set_id,'asset_set_digest',asset_set_digest,'payload',payload)) from public.content_publication_bundles where id=(pg_temp.val('first')->>'bundle_id')::uuid),'digest binds exact pinned graph and frozen projection');
select throws_ok($$update public.content_publication_bundles set payload='{}' where work_item_id=pg_temp.uid(13,1)$$,'55000','CONTENT_HISTORY_IMMUTABLE','owner cannot mutate frozen payload');
select throws_ok($$delete from public.content_publication_bundles where work_item_id=pg_temp.uid(13,1)$$,'55000','CONTENT_HISTORY_IMMUTABLE','owner cannot delete frozen history');
select throws_ok($$update private.content_publication_receipts set result='{}' where actor_id=pg_temp.uid(11,6)$$,'55000','CONTENT_HISTORY_IMMUTABLE','receipts immutable');
select throws_ok($$insert into public.content_publication_bundles(work_item_id,channel,version_number,content_version_id,snapshot_id,brief_id,asset_set_id,snapshot_digest,content_digest,brief_digest,asset_set_digest,payload,digest,revision,created_by)
 select pg_temp.uid(13,7),channel,1,content_version_id,snapshot_id,brief_id,asset_set_id,snapshot_digest,content_digest,brief_digest,asset_set_digest,payload,digest,30,created_by
 from public.content_publication_bundles where id=(pg_temp.val('first')->>'bundle_id')::uuid$$,'23503',null,'owner-bound foreign keys reject cross-work pinned graph');
insert into public.content_asset_sets(id,work_item_id,brief_id,version_number,based_on_id,slots,digest,revision,created_by)
select pg_temp.uid(20,101),work_item_id,brief_id,2,id,slots,repeat('4',64),23,created_by from public.content_asset_sets where id=pg_temp.uid(20,1);
insert into public.content_visual_reviews(work_item_id,target_kind,asset_set_id,decision,revision,created_by)
values(pg_temp.uid(13,1),'asset_set',pg_temp.uid(20,101),'approved',24,pg_temp.uid(11,1));
update public.content_work_items set row_version=24 where id=pg_temp.uid(13,1);
set local role authenticated;
select lives_ok($$select pg_temp.keep('successor',pg_temp.freeze(1,jsonb_build_object('asset_set_id',pg_temp.uid(20,101))))$$,'new approved asset selection freezes successor');
select is(pg_temp.inspect()->'selected'->>'version_number','2','successor version increments within original channel');
select is(pg_temp.inspect()->'selected'->>'based_on_id',pg_temp.val('first')->>'bundle_id','successor points to previous same-channel bundle');
select is(pg_temp.inspect()->'bundles'->0->>'id',pg_temp.val('successor')->>'bundle_id','history sorts semantic revision even for identical timestamps');
select is(pg_temp.inspect(1,(pg_temp.val('first')->>'bundle_id')::uuid)->'selected'->>'state','stale','old bundle stays inspectable with stale set status');
select is(public.content_publication_execute(pg_temp.val('first_command')),pg_temp.val('first'),'completed receipt replays after newer bundle');
select throws_ok($$select pg_temp.freeze()$$,'22023','ASSET_SET_NOT_APPROVED','new key cannot dedupe superseded image selection');
reset role;
update private.module_permissions set can_publish=false where user_id=pg_temp.uid(11,6) and module='news';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select throws_ok($$select public.content_publication_execute(pg_temp.val('first_command'))$$,'42501','FORBIDDEN','creator permission revocation wins over replay');
select lives_ok($$select pg_temp.inspect()$$,'revoked publisher can still inspect with retained view');
reset role;
update private.module_permissions set can_publish=true where user_id=pg_temp.uid(11,6) and module='news';
update public.profiles set active=false where id=pg_temp.uid(11,6);
set local role authenticated;
select throws_ok($$select public.content_publication_execute(pg_temp.val('first_command'))$$,'42501','PROFILE_INACTIVE','inactive creator cannot replay');
select is((select count(*)::integer from public.content_publication_bundles where work_item_id=pg_temp.uid(13,1)),0,'RLS hides history from inactive creator');
reset role;
update public.profiles set active=true where id=pg_temp.uid(11,6);
set local role authenticated;
select lives_ok($$select pg_temp.freeze(2)$$,'source-staleness fixture frozen');
select pg_temp.keep('source_command',pg_temp.val('last_command'));
select pg_temp.keep('source_result',pg_temp.val('last_result'));
select pg_temp.keep('source_payload',pg_temp.inspect(2)->'selected'->'payload');
select lives_ok($$select pg_temp.freeze(3)$$,'content-staleness fixture frozen');
select lives_ok($$select pg_temp.freeze(5)$$,'set-staleness fixture frozen');
select lives_ok($$select pg_temp.freeze(6)$$,'storage-staleness fixture frozen');
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000004","role":"authenticated"}';
select lives_ok($$select pg_temp.freeze(4)$$,'scholarship publisher can freeze exact domain');
select is(pg_temp.inspect(4)->'selected'->'payload'->>'kind','scholarship','scholarship kind preserved');
reset role;
insert into public.content_source_verifications(work_item_id,requested_url,final_url,publisher,title,official,result,observed_on,valid_until,note,revision,created_by)
values(pg_temp.uid(13,2),'https://example.test/bundle/2','https://example.test/bundle/2','Changed source','Recheck',false,'unverified',current_date,current_date+30,'Changed',22,pg_temp.uid(11,1));
insert into public.content_versions(work_item_id,snapshot_id,channel,version_number,locales,digest,created_by)
select work_item_id,snapshot_id,channel,2,locales,repeat('1',64),created_by from public.content_versions where id=pg_temp.uid(16,3);
insert into public.visual_brief_versions(work_item_id,content_version_id,version_number,based_on_id,brief,digest,revision,created_by)
select work_item_id,content_version_id,2,id,brief,repeat('2',64),22,created_by from public.visual_brief_versions where id=pg_temp.uid(17,4);
insert into public.content_asset_sets(work_item_id,brief_id,version_number,based_on_id,slots,digest,revision,created_by)
select work_item_id,brief_id,2,id,slots,repeat('3',64),22,created_by from public.content_asset_sets where id=pg_temp.uid(20,5);
update storage.objects set name=name||'.unavailable' where name=(select storage_path from public.assets where id=pg_temp.uid(19,11));
set local role authenticated;
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select is(pg_temp.inspect(2)->'selected'->>'state','stale','source recheck invalidates bundle dynamically');
select is(pg_temp.inspect(2)->'selected'->'issues','["CONTENT_NOT_APPROVED","BRIEF_NOT_APPROVED","ASSET_SET_NOT_APPROVED"]'::jsonb,'source issues deterministic without duplicates');
select is(pg_temp.inspect(2)->'selected'->'payload',pg_temp.val('source_payload'),'staleness never rewrites frozen payload');
select is(public.content_publication_execute(pg_temp.val('source_command')),pg_temp.val('source_result'),'exact completed receipt replays after source staleness');
select throws_ok($$select pg_temp.freeze(2)$$,'22023','CONTENT_NOT_APPROVED','new key cannot reuse stale source bundle');
select is(jsonb_array_length(pg_temp.inspect(2)->'candidates'),0,'stale source removes candidate');
select throws_ok($$select pg_temp.freeze(3)$$,'22023','CONTENT_NOT_APPROVED','new content version invalidates old bundle');
select is(pg_temp.inspect(3)->'selected'->>'state','stale','new content makes history stale');
select throws_ok($$select pg_temp.freeze(5)$$,'22023','ASSET_SET_NOT_APPROVED','new draft asset set invalidates old set');
select is(pg_temp.inspect(5)->'selected'->'issues','["ASSET_SET_NOT_APPROVED"]'::jsonb,'set-only staleness stays specific');
select throws_ok($$select pg_temp.freeze(6)$$,'22023','ASSET_NOT_READY','missing Storage object blocks fresh freeze');
select is(pg_temp.inspect(6)->'selected'->'issues','["ASSET_NOT_READY"]'::jsonb,'missing image makes historical bundle stale');
select is(jsonb_array_length(pg_temp.inspect(6)->'candidates'),0,'missing image removes candidate');
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$select pg_temp.freeze(4)$$,'22023','BRIEF_NOT_APPROVED','new brief invalidates old bundle');
select is(pg_temp.inspect(4)->'selected'->'issues','["BRIEF_NOT_APPROVED","ASSET_SET_NOT_APPROVED"]'::jsonb,'brief staleness propagated deterministically');
select is((select count(*)::integer from public.content_publication_bundles where work_item_id=pg_temp.uid(13,1)),0,'RLS hides news bundles from scholarship publisher');
reset role;
update storage.objects set metadata='{"mimetype":"image/png","size":"bad"}' where name=(select storage_path from public.assets where id=pg_temp.uid(19,13));
set local role authenticated;
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select throws_ok($$select pg_temp.freeze(7)$$,'22023','ASSET_NOT_READY','malformed storage size gives safe readiness failure');
reset role;
update storage.objects set metadata='{"mimetype":"image/jpeg","size":1024}' where name=(select storage_path from public.assets where id=pg_temp.uid(19,13));
set local role authenticated;
select throws_ok($$select pg_temp.freeze(7)$$,'22023','ASSET_NOT_READY','storage MIME mismatch rejected');
reset role;
update storage.objects set metadata='{"mimetype":"image/png","size":1024}' where name=(select storage_path from public.assets where id=pg_temp.uid(19,13));
update storage.buckets set public=true where id='content-working';
set local role authenticated;
select throws_ok($$select pg_temp.freeze(7)$$,'22023','ASSET_NOT_READY','public bucket cannot form a private bundle');
reset role;
update storage.buckets set public=false where id='content-working';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"e1100000-0000-0000-0000-000000000008","role":"authenticated"}';
select lives_ok($$select pg_temp.freeze(7)$$,'active office admin has domain authority');
reset role;
-- Resource bound: owner-seeded historical rows avoid hundreds of unrelated
-- editorial commands while exercising real command checks at the exact cap.
insert into public.content_asset_sets(id,work_item_id,brief_id,version_number,slots,digest,revision,created_by)
select pg_temp.uid(20,200+n),pg_temp.uid(13,8),pg_temp.uid(17,8),n+1,s.slots,repeat('6',64),30+n,pg_temp.uid(11,1)
from generate_series(1,100)n cross join public.content_asset_sets s where s.id=pg_temp.uid(20,8);
insert into public.content_visual_reviews(work_item_id,target_kind,asset_set_id,decision,revision,created_by)
values(pg_temp.uid(13,8),'asset_set',pg_temp.uid(20,300),'approved',200,pg_temp.uid(11,1));
insert into public.content_publication_bundles(work_item_id,channel,version_number,content_version_id,snapshot_id,brief_id,asset_set_id,
 snapshot_digest,content_digest,brief_digest,asset_set_digest,payload,digest,revision,created_by)
select pg_temp.uid(13,8),'website',n,pg_temp.uid(16,8),pg_temp.uid(15,8),pg_temp.uid(17,8),pg_temp.uid(20,200+n),
 repeat('a',64),repeat('b',64),repeat('c',64),repeat('6',64),'{}',repeat('7',64),300+n,pg_temp.uid(11,1) from generate_series(1,100)n;
update public.content_work_items set row_version=400 where id=pg_temp.uid(13,8);
set local role authenticated;
select is(pg_temp.freeze(8,jsonb_build_object('asset_set_id',pg_temp.uid(20,300)))->>'reused','true','already-frozen current set remains reusable at history cap');
select is((select row_version from public.content_work_items where id=pg_temp.uid(13,8)),400,'reuse at cap leaves revision unchanged');
reset role;
insert into public.content_asset_sets(id,work_item_id,brief_id,version_number,based_on_id,slots,digest,revision,created_by)
select pg_temp.uid(20,301),work_item_id,brief_id,102,id,slots,repeat('8',64),401,created_by from public.content_asset_sets where id=pg_temp.uid(20,300);
insert into public.content_visual_reviews(work_item_id,target_kind,asset_set_id,decision,revision,created_by)
values(pg_temp.uid(13,8),'asset_set',pg_temp.uid(20,301),'approved',402,pg_temp.uid(11,1));
update public.content_work_items set row_version=402 where id=pg_temp.uid(13,8);
set local role authenticated;
select throws_ok($$select pg_temp.freeze(8,jsonb_build_object('asset_set_id',pg_temp.uid(20,301)))$$,'22023','POLICY_VIOLATION','101st bundle rejected even when new selection is fully approved');
reset role;
select is((select jsonb_agg(to_jsonb(n) order by id) from public.news_articles n where id::text like 'e1200000-%'),pg_temp.val('canonical'),'canonical records unchanged');
select is((select jsonb_agg(to_jsonb(n) order by id) from public.news_public n where id::text like 'e1200000-%'),pg_temp.val('public'),'public mirror unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.record_assets a where news_id::text like 'e1200000-%'),pg_temp.val('links'),'public image links unchanged');
select is((select count(*)::integer from storage.objects where bucket_id<>'content-working' and name like '%e1300000%'),0,'no public Storage copies created');
select * from finish();
rollback;
