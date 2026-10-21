begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select ('b1100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'travel-list-' || n || '@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Travel list ' || n), now(), now()
from generate_series(1, 8) as users(n);
insert into private.user_roles (user_id, role) values
  ('b1100000-0000-0000-0000-000000000001', 'system_admin'),
  ('b1100000-0000-0000-0000-000000000002', 'office_admin'),
  ('b1100000-0000-0000-0000-000000000003', 'editor'),
  ('b1100000-0000-0000-0000-000000000004', 'viewer'),
  ('b1100000-0000-0000-0000-000000000005', 'editor'),
  ('b1100000-0000-0000-0000-000000000006', 'system_admin'),
  ('b1100000-0000-0000-0000-000000000007', 'editor'),
  ('b1100000-0000-0000-0000-000000000008', 'viewer');
insert into private.module_permissions (user_id, module, can_view, can_create, can_update) values
  ('b1100000-0000-0000-0000-000000000003', 'travel', true, true, true),
  ('b1100000-0000-0000-0000-000000000004', 'travel', true, false, false),
  ('b1100000-0000-0000-0000-000000000005', 'mobility', true, true, true),
  ('b1100000-0000-0000-0000-000000000007', 'travel', true, false, false);
update public.profiles set active = false where id = 'b1100000-0000-0000-0000-000000000006';

insert into public.countries (id, iso2, iso3, name_th, name_en, active) values
  ('b1200000-0000-0000-0000-000000000001', 'XZ', 'XZA', 'ประเทศอรุณ', 'Sunrise Republic', true),
  ('b1200000-0000-0000-0000-000000000002', 'XQ', 'XQA', 'ประเทศเมฆ', 'Cloud Republic', true),
  ('b1200000-0000-0000-0000-000000000003', 'XY', 'XYA', 'ประเทศปิดใช้งาน', 'Inactive master country', false),
  ('b1200000-0000-0000-0000-000000000004', 'XW', 'XWA', 'ประเทศโมดูลอื่น', 'Other module country', true);
insert into public.organization_units (id, code, name_th, name_en, active) values
  ('b1300000-0000-0000-0000-000000000001', 'TV2-A', 'คณะทดสอบหนึ่ง', 'Unit Alpha', true),
  ('b1300000-0000-0000-0000-000000000002', 'TV2-B', 'คณะทดสอบสอง', 'Unit Beta', true),
  ('b1300000-0000-0000-0000-000000000003', 'TV2-C', 'คณะปิดใช้งาน', 'Inactive master unit', false),
  ('b1300000-0000-0000-0000-000000000004', 'TV2-D', 'คณะโมดูลอื่น', 'Other module unit', true);
insert into public.partner_organizations (id, name_th, name_en) values
  ('b1400000-0000-0000-0000-000000000001', 'องค์กรปัจจุบัน', 'Current Partner');

insert into public.movement_cases (
  id, project_name, category, country_id, owner_unit_id, start_date, end_date,
  fiscal_year, workflow_status, internal_note, updated_at, created_by
)
select ('b1500000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'รายการ TV2 ' || lpad(n::text, 2, '0'), 'staff_official_travel',
  case when n % 2 = 1 then 'b1200000-0000-0000-0000-000000000001'::uuid else 'b1200000-0000-0000-0000-000000000002'::uuid end,
  case when n % 2 = 1 then 'b1300000-0000-0000-0000-000000000001'::uuid else 'b1300000-0000-0000-0000-000000000002'::uuid end,
  case when n = 45 then null else '2026-01-01'::date + n end,
  case when n = 45 then null else '2026-01-01'::date + n end,
  case when n % 2 = 1 then 2570 else 2571 end,
  case when n % 3 = 0 then 'active'::public.workflow_status when n % 3 = 1 then 'under_review'::public.workflow_status else 'draft'::public.workflow_status end,
  'SECRET_INTERNAL_NOTE', '2026-01-01'::timestamptz + n * interval '1 hour',
  'b1100000-0000-0000-0000-000000000001'
from generate_series(1, 45) as records(n);

insert into public.movement_cases (
  id, project_name, title_en, category, country_id, country_name_snapshot,
  owner_unit_id, partner_organization_id, partner_name_snapshot, approval_reference,
  fiscal_year, workflow_status, publication_status, public_visible, updated_at, created_by
) values
  ('b1500000-0000-0000-0000-000000000046', 'Special 100%_travel', 'English Search Title', 'staff_official_travel',
   'b1200000-0000-0000-0000-000000000001', 'Saved Country', 'b1300000-0000-0000-0000-000000000001',
   'b1400000-0000-0000-0000-000000000001', 'Saved Partner', 'REF-UNIQUE-46',
   2572, 'approved', 'published', true, '2026-01-10', 'b1100000-0000-0000-0000-000000000001'),
  ('b1500000-0000-0000-0000-000000000047', 'No visible masters', null, 'staff_official_travel',
   'b1200000-0000-0000-0000-000000000003', 'Inactive Country Snapshot', 'b1300000-0000-0000-0000-000000000003',
   null, 'Orphan Partner Snapshot', null,
   null, 'completed', 'draft', false, '2026-01-10', 'b1100000-0000-0000-0000-000000000001'),
  ('b1500000-0000-0000-0000-000000000048', 'Hidden mobility TV2', null, 'staff_mobility',
   'b1200000-0000-0000-0000-000000000004', null, 'b1300000-0000-0000-0000-000000000004',
   null, null, null,
   2599, 'active', 'published', true, now(), 'b1100000-0000-0000-0000-000000000001'),
  ('b1500000-0000-0000-0000-000000000049', 'Deleted travel TV2', null, 'staff_official_travel',
   'b1200000-0000-0000-0000-000000000004', null, 'b1300000-0000-0000-0000-000000000004',
   null, null, null,
   2599, 'active', 'published', true, now(), 'b1100000-0000-0000-0000-000000000001');
update public.movement_cases set deleted_at = now() where id = 'b1500000-0000-0000-0000-000000000049';
insert into public.movement_participants (movement_id, person_source, full_name_snapshot, created_by)
values ('b1500000-0000-0000-0000-000000000046', 'external', 'PRIVATE_PARTICIPANT_NAME', 'b1100000-0000-0000-0000-000000000001');
-- The timestamp trigger uses transaction time, giving these two rows an exact
-- tie regardless of the participant counter's earlier updated_at change.
update public.movement_cases set updated_at = now() where id in ('b1500000-0000-0000-0000-000000000046', 'b1500000-0000-0000-0000-000000000047');

select ok(not has_function_privilege('anon', 'public.travel_list_v2(text,text,uuid,uuid,integer,text,integer)', 'EXECUTE'), 'anonymous cannot execute workspace list');
select ok(not has_function_privilege('service_role', 'public.travel_list_v2(text,text,uuid,uuid,integer,text,integer)', 'EXECUTE'), 'service role is not granted this user endpoint');
select ok(has_function_privilege('authenticated', 'public.travel_list_v2(text,text,uuid,uuid,integer,text,integer)', 'EXECUTE'), 'authenticated can reach permission-checked endpoint');
select ok(not (select prosecdef from pg_proc where oid = 'public.travel_list_v2(text,text,uuid,uuid,integer,text,integer)'::regprocedure), 'list executes with caller RLS');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((public.travel_list_v2() ->> 'total')::integer, 47, 'System Admin sees only live Travel records');
select is(public.travel_list_v2() -> 'summary', '{"total":47,"active":15,"underReview":15}'::jsonb, 'summary counts all visible Travel rows, not only current page');
select is(jsonb_array_length(public.travel_list_v2() -> 'rows'), 20, 'first page is bounded at 20');
select is((public.travel_list_v2() ->> 'pageSize')::integer, 20, 'page size contract is fixed');
select is(jsonb_array_length(public.travel_list_v2(p_page => 2) -> 'rows'), 20, 'second page is bounded at 20');
select is(jsonb_array_length(public.travel_list_v2(p_page => 3) -> 'rows'), 7, 'last partial page has seven rows');
select is((public.travel_list_v2(p_page => 2147483647) ->> 'page')::integer, 3, 'very large page clamps to last available page');
select is(public.travel_list_v2(p_page => -10), public.travel_list_v2(p_page => 1), 'negative page clamps to first page');
select is(public.travel_list_v2(p_page => null), public.travel_list_v2(p_page => 1), 'null page defaults to first page');
select is((select count(distinct item ->> 'id')::integer from generate_series(1, 3) as pages(page), lateral jsonb_array_elements(public.travel_list_v2(p_page => page) -> 'rows') as item), 47, 'all pages cover unique rows with no gaps or repeats');
select is(public.travel_list_v2(p_q => 'TV2', p_sort => 'start_desc') #>> '{rows,0,id}', 'b1500000-0000-0000-0000-000000000044', 'descending start puts latest dated row first');
select is(public.travel_list_v2(p_q => 'TV2', p_sort => 'start_asc') #>> '{rows,0,id}', 'b1500000-0000-0000-0000-000000000001', 'ascending start puts earliest dated row first');
select is(public.travel_list_v2(p_q => 'TV2', p_sort => 'start_asc', p_page => 3) #>> '{rows,4,id}', 'b1500000-0000-0000-0000-000000000045', 'ascending dates keep null date last');
select is(public.travel_list_v2(p_q => 'TV2', p_sort => 'start_desc', p_page => 3) #>> '{rows,4,id}', 'b1500000-0000-0000-0000-000000000045', 'descending dates also keep null date last');
select is(public.travel_list_v2(p_q => 'TV2', p_sort => 'name_asc') #>> '{rows,0,id}', 'b1500000-0000-0000-0000-000000000001', 'name sort has expected lexical order');
select is(public.travel_list_v2() #>> '{rows,0,id}', 'b1500000-0000-0000-0000-000000000046', 'equal updated timestamps use ascending ID tie-break');
select is(public.travel_list_v2() #>> '{rows,1,id}', 'b1500000-0000-0000-0000-000000000047', 'equal updated timestamps retain a stable next row');
select is(public.travel_list_v2(p_sort => 'start_asc', p_page => 3) #>> '{rows,5,id}', 'b1500000-0000-0000-0000-000000000046', 'null date ties also use ascending ID');
select is(public.travel_list_v2(p_sort => 'invalid; DROP TABLE movement_cases'), public.travel_list_v2(), 'unknown sort falls back safely without dynamic SQL');
select is((public.travel_list_v2(p_q => '  english search TITLE ') ->> 'total')::integer, 1, 'search trims spaces and matches English case-insensitively');
select is((public.travel_list_v2(p_q => 'รายการ') ->> 'total')::integer, 45, 'Thai title search works');
select is((public.travel_list_v2(p_q => '%') ->> 'total')::integer, 1, 'percent search is literal');
select is((public.travel_list_v2(p_q => '_') ->> 'total')::integer, 1, 'underscore search is literal');
select is((public.travel_list_v2(p_q => $$' OR 1=1 --$$) ->> 'total')::integer, 0, 'SQL-looking search remains literal text');
select is((public.travel_list_v2(p_q => 'Saved Country') ->> 'total')::integer, 1, 'country snapshot is searchable');
select is((public.travel_list_v2(p_q => 'Sunrise Republic') ->> 'total')::integer, 24, 'current country name is searchable even with a snapshot');
select is((public.travel_list_v2(p_q => 'Saved Partner') ->> 'total')::integer, 1, 'partner snapshot is searchable');
select is((public.travel_list_v2(p_q => 'Current Partner') ->> 'total')::integer, 1, 'current partner name is searchable');
select is((public.travel_list_v2(p_q => 'Unit Alpha') ->> 'total')::integer, 24, 'owner unit English name is searchable');
select is((public.travel_list_v2(p_q => 'REF-UNIQUE-46') ->> 'total')::integer, 1, 'approval reference is searchable');
select is((public.travel_list_v2(p_status => 'active') ->> 'total')::integer, 15, 'workflow status filter applies before pagination');
select is((public.travel_list_v2(p_country => 'b1200000-0000-0000-0000-000000000002') ->> 'total')::integer, 22, 'country filter spans all pages');
select is((public.travel_list_v2(p_unit => 'b1300000-0000-0000-0000-000000000002') ->> 'total')::integer, 22, 'unit filter spans all pages');
select is((public.travel_list_v2(p_year => 2572) ->> 'total')::integer, 1, 'fiscal year filter applies');
select is((public.travel_list_v2(p_q => 'TV2', p_status => 'active', p_country => 'b1200000-0000-0000-0000-000000000001', p_unit => 'b1300000-0000-0000-0000-000000000001', p_year => 2570) ->> 'total')::integer, 8, 'search and filters combine with AND');
select is((public.travel_list_v2(p_q => 'no match', p_page => 9) ->> 'page')::integer, 1, 'no-results page clamps to one');
select is(public.travel_list_v2(p_q => 'no match') -> 'rows', '[]'::jsonb, 'no-results rows are an empty array');
select is(public.travel_list_v2(p_q => 'no match') -> 'summary', public.travel_list_v2() -> 'summary', 'summary remains the workspace summary when filters find nothing');
select is(public.travel_list_v2(p_q => 'no match') -> 'filters', public.travel_list_v2() -> 'filters', 'filter metadata is stable across filtering');
select is(jsonb_array_length(public.travel_list_v2() #> '{filters,countries}'), 3, 'country options are distinct and exclude deleted/other-category-only data');
select is(jsonb_array_length(public.travel_list_v2() #> '{filters,units}'), 3, 'unit options are distinct and exclude deleted/other-category-only data');
select is(public.travel_list_v2() #> '{filters,years}', '[2572,2571,2570]'::jsonb, 'year options omit null and hidden records and sort descending');
select is((public.travel_list_v2(p_q => 'PRIVATE_PARTICIPANT_NAME') ->> 'total')::integer, 0, 'participant names are not included in search');
select is((public.travel_list_v2(p_q => 'SECRET_INTERNAL_NOTE') ->> 'total')::integer, 0, 'private note is not included in search');
select ok(not (public.travel_list_v2()::text like '%PRIVATE_PARTICIPANT_NAME%'), 'participant PII is not returned');
select ok(not (public.travel_list_v2()::text like '%SECRET_INTERNAL_NOTE%'), 'private notes are not returned');
select is((select array_agg(key order by key) from jsonb_object_keys(public.travel_list_v2() #> '{rows,0}') as key),
  array['country_name','end_date','fiscal_year','id','owner_unit_name','participant_count','partner_name','project_name','start_date','title_en','updated_at','workflow_status']::text[], 'row projection contains only list fields');
select throws_ok($$select public.travel_list_v2(p_status => 'unknown')$$, '22023', 'TRAVEL_LIST_INVALID_FILTER', 'invalid direct status fails clearly');
select throws_ok($$select public.travel_list_v2(p_year => 9000)$$, '22023', 'TRAVEL_LIST_INVALID_FILTER', 'invalid direct year fails clearly');

set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((public.travel_list_v2() ->> 'total')::integer, 47, 'Office Admin can read Travel list');
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((public.travel_list_v2() ->> 'total')::integer, 47, 'Travel editor can read Travel list');
select is(public.travel_list_v2(p_q => 'No visible masters') #>> '{rows,0,country_name}', 'Inactive Country Snapshot', 'inactive joined country does not remove row or its snapshot');
select is(public.travel_list_v2(p_q => 'No visible masters') #>> '{rows,0,partner_name}', 'Orphan Partner Snapshot', 'missing partner FK preserves saved partner snapshot');
select is(public.travel_list_v2(p_q => 'No visible masters') #>> '{rows,0,owner_unit_name}', null, 'inactive unit name remains hidden under its RLS');
select is((public.travel_list_v2(p_q => 'Inactive master country') ->> 'total')::integer, 0, 'search does not bypass master RLS');
select is((select option ->> 'label' from jsonb_array_elements(public.travel_list_v2() #> '{filters,countries}') as option where option ->> 'id' = 'b1200000-0000-0000-0000-000000000003'), 'Inactive Country Snapshot', 'metadata falls back to visible snapshot for hidden country master');
select is((select option ->> 'label' from jsonb_array_elements(public.travel_list_v2() #> '{filters,units}') as option where option ->> 'id' = 'b1300000-0000-0000-0000-000000000003'), 'ไม่ระบุชื่อหน่วยงาน', 'metadata supplies a non-sensitive label for hidden unit master');
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((public.travel_list_v2() ->> 'total')::integer, 47, 'read-only Travel viewer needs no write permission');
select ok(not private.can_access_module('travel', 'create'), 'viewer read does not grant create permission');
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok($$select public.travel_list_v2()$$, '42501', 'TRAVEL_LIST_FORBIDDEN', 'Mobility-only editor cannot read workspace metadata despite a published Travel row');
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000006","role":"authenticated"}';
select throws_ok($$select public.travel_list_v2()$$, '42501', 'TRAVEL_LIST_FORBIDDEN', 'inactive System Admin cannot read workspace metadata');
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000008","role":"authenticated"}';
select throws_ok($$select public.travel_list_v2()$$, '42501', 'TRAVEL_LIST_FORBIDDEN', 'unassigned viewer cannot read workspace metadata');
set local "request.jwt.claims" = '{"role":"authenticated"}';
select throws_ok($$select public.travel_list_v2()$$, '42501', 'TRAVEL_LIST_FORBIDDEN', 'missing auth UID fails closed');
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000007","role":"authenticated"}';
select lives_ok($$select public.travel_list_v2()$$, 'permission initially authorizes current session');
reset role;
update private.module_permissions set can_view = false where user_id = 'b1100000-0000-0000-0000-000000000007';
set local role authenticated;
select throws_ok($$select public.travel_list_v2()$$, '42501', 'TRAVEL_LIST_FORBIDDEN', 'revocation blocks same JWT immediately');

-- An additional row restriction must affect rows, totals and metadata alike.
reset role;
create policy travel_list_test_restriction on public.movement_cases as restrictive for select to authenticated
  using (auth.uid() <> 'b1100000-0000-0000-0000-000000000004'::uuid or id = 'b1500000-0000-0000-0000-000000000002'::uuid);
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((public.travel_list_v2() ->> 'total')::integer, 1, 'caller RLS restriction reduces row count');
select is(public.travel_list_v2() -> 'summary', '{"total":1,"active":0,"underReview":0}'::jsonb, 'caller RLS restriction also reduces summary');
select is(jsonb_array_length(public.travel_list_v2() #> '{filters,countries}'), 1, 'caller RLS restriction also reduces country metadata');
select is(public.travel_list_v2() #> '{filters,years}', '[2571]'::jsonb, 'caller RLS restriction also reduces years');
reset role;
drop policy travel_list_test_restriction on public.movement_cases;

-- Empty database state returns the same complete response shape.
update public.movement_cases set deleted_at = now() where id::text like 'b1500000-%';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000004","role":"authenticated"}';
select is(public.travel_list_v2(), '{"rows":[],"total":0,"page":1,"pageSize":20,"summary":{"total":0,"active":0,"underReview":0},"filters":{"countries":[],"units":[],"years":[]}}'::jsonb, 'empty workspace retains complete bounded-list shape');
reset role;
select * from finish();
rollback;
