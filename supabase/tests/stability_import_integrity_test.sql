begin;
create extension if not exists pgtap with schema extensions;
-- All fixtures and writes roll back; these tests do not use production data.
select plan(72);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('a7100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stability-import-admin@example.test', '', now(), '{}', '{"full_name":"Import Admin"}', now(), now()),
('a7100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stability-import-office@example.test', '', now(), '{}', '{"full_name":"Import Office"}', now(), now());
insert into private.user_roles (user_id, role) values
('a7100000-0000-0000-0000-000000000001','system_admin'),
('a7100000-0000-0000-0000-000000000002','office_admin');
insert into public.countries (id,iso2,iso3,name_th,name_en) values
('a7300000-0000-0000-0000-000000000001','QK','QKK','Keep country','Keep country');
insert into public.organization_units (id,code,name_th) values
('a7300000-0000-0000-0000-000000000002','STABILITY-KEEP','Keep unit');
insert into public.partner_organizations (id,name_en,created_by) values
('a7300000-0000-0000-0000-000000000003','Stability partner','a7100000-0000-0000-0000-000000000001');

create function pg_temp.stage_import(batch_uuid uuid, module_name text, kind text, source_path text, rows_json jsonb)
returns void language plpgsql as $helper$
begin
  insert into public.import_batches (id,module,import_kind,source_file_name,source_file_path,status,created_by,total_rows)
  values (batch_uuid,module_name::public.module_key,kind::public.import_kind,'stability-fixture.xlsx',source_path,'ready',auth.uid(),jsonb_array_length(rows_json));
  insert into public.import_rows (batch_id,row_number,status,master_entity,review_status,change_action,source_data,normalized_data)
  select batch_uuid, ordinal::integer,
    coalesce(item->>'status','valid')::public.import_row_status,
    nullif(item->>'entity','')::public.master_entity_type,
    coalesce(item->>'review','approved')::public.import_review_status,
    coalesce(item->>'action','insert')::public.import_change_action,
    coalesce(item->'source','{"original":"retained"}'::jsonb),item->'normalized'
  from jsonb_array_elements(rows_json) with ordinality as data(item,ordinal);
end;
$helper$;

create temp table preserved_records (name text primary key, value jsonb);
grant all on preserved_records to authenticated;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated"}';


do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000001', 'settings', 'master_data', null, '[{"normalized": {"iso2": "QK", "iso3": "QKK", "name_th": "Overwrite country", "name_en": "Overwrite country"}, "entity": "country", "status": "warning", "review": "skipped", "action": "update", "source": {"country_id": "old-country"}}, {"normalized": {}, "entity": "country", "status": "invalid", "review": "skipped", "action": "skip"}, {"normalized": {"iso2": "QJ", "iso3": "QJJ", "name_th": "New country", "name_en": "New country"}, "entity": "country", "review": "pending", "source": {"country_id": "new-country"}}, {"normalized": {"code": "STABILITY-NEW", "name_th": "New unit"}, "entity": "organization_unit", "review": "pending", "source": {"unit_id": "new-unit"}}, {"normalized": {"code": "STABILITY-KEEP", "name_th": "Overwrite unit", "parent_source_id": "new-unit"}, "entity": "organization_unit", "status": "warning", "review": "skipped", "action": "update", "source": {"unit_id": "keep-unit"}}, {"normalized": {"legacy_id": "STABILITY-MASTER-PARTNER", "name_en": "Master partner", "country_source_id": "old-country"}, "entity": "partner_organization", "review": "pending"}, {"normalized": {"person_type": "student", "source_identifier": "STABILITY-STUDENT", "full_name_th": "Student", "unit_source_id": "new-unit"}, "entity": "student", "review": "pending"}, {"normalized": {"person_type": "staff", "source_identifier": "STABILITY-STAFF", "full_name_th": "Staff", "unit_source_id": "keep-unit"}, "entity": "staff", "review": "pending"}]'::jsonb); end $setup$;

select lives_ok($test$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000001') $test$, 'Master import accepts reviewed skips and normal pending valid rows');

select is((select name_en from public.countries where iso2='QK'), 'Keep country', 'Skipped existing country is never updated');

select is((select name_th from public.organization_units where code='STABILITY-KEEP'), 'Keep unit', 'Skipped existing unit is never updated');

select ok((select parent_id is null from public.organization_units where code='STABILITY-KEEP'), 'Skipped unit does not acquire an imported parent');

select is((select count(*)::integer from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000001' and status='imported' and target_record_id is not null), 5, 'Only five committed rows receive imported state and target IDs');

select is((select count(*)::integer from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000001' and review_status='skipped' and target_record_id is null and status <> 'imported'), 3, 'Skipped staging rows retain their review state and no false committed identity');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000001' and row_number=3), (select id from public.countries where iso2='QJ'), 'Master row 3 records its actual canonical identity');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000001' and row_number=4), (select id from public.organization_units where code='STABILITY-NEW'), 'Master row 4 records its actual canonical identity');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000001' and row_number=6), (select id from public.partner_organizations where legacy_id='STABILITY-MASTER-PARTNER'), 'Master row 6 records its actual canonical identity');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000001' and row_number=7), (select id from public.people where source_identifier='STABILITY-STUDENT'), 'Master row 7 records its actual canonical identity');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000001' and row_number=8), (select id from public.people where source_identifier='STABILITY-STAFF'), 'Master row 8 records its actual canonical identity');

select is((select country_id from public.partner_organizations where legacy_id='STABILITY-MASTER-PARTNER'), 'a7300000-0000-0000-0000-000000000001'::uuid, 'A skipped existing country can resolve a reference without being overwritten');

insert into preserved_records select 'master-id',to_jsonb(id) from public.countries where iso2='QJ';

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000002', 'settings', 'master_data', null, '[{"normalized": {"iso2": "QJ", "iso3": "QJJ", "name_th": "Updated country", "name_en": "Updated country"}, "entity": "country", "status": "warning", "action": "update", "review": "pending"}]'::jsonb); end $setup$;

select lives_ok($test$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000002') $test$, 'Intentional master upsert remains supported');

select is((select to_jsonb(target_record_id) from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000002'), (select value from preserved_records where name='master-id'), 'Master upsert records the existing canonical ID');

select is((select source_data from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000002'), '{"original": "retained"}'::jsonb, 'Master commit preserves the raw source snapshot');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000003', 'settings', 'master_data', null, '[{"normalized": {"code": "STABILITY-BLOCKED", "name_th": "Blocked"}, "entity": "organization_unit", "review": "needs_fix"}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000003') $test$, 'P0001', 'MASTER_IMPORT_HAS_UNRESOLVED_ROWS', 'Explicit needs-fix blocks a valid master row');

select is((select count(*)::integer from public.organization_units where code='STABILITY-BLOCKED'), 0, 'Blocked master row writes no destination data');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000004', 'settings', 'master_data', null, '[{"normalized": {}, "entity": "country", "status": "invalid", "action": "skip", "review": "pending"}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000004') $test$, 'P0001', 'MASTER_IMPORT_HAS_UNRESOLVED_ROWS', 'Unreviewed invalid rows cannot masquerade as deliberate skips');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000005', 'settings', 'master_data', null, '[{"normalized": {"code": "STABILITY-SKIPPED-NEW", "name_th": "Skipped"}, "entity": "organization_unit", "review": "skipped", "action": "skip", "source": {"unit_id": "missing-unit"}}, {"normalized": {"person_type": "student", "source_identifier": "STABILITY-NO-UNIT", "full_name_th": "Student", "unit_source_id": "missing-unit"}, "entity": "student"}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000005') $test$, 'P0001', 'MASTER_IMPORT_PERSON_UNIT_NOT_FOUND', 'A skipped new unit cannot silently turn a person reference into null');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000010', 'mobility', 'module_data', null, '[{"normalized": {"legacyId": "STABILITY-STUDENT-IMPORT", "projectName": "Student project", "direction": "outbound", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"sourceIdentifier": "STABILITY-STUDENT", "fullNameSnapshot": "Student participant"}]}}]'::jsonb); end $setup$;

select lives_ok($test$ select public.commit_student_mobility_import_batch('a7200000-0000-0000-0000-000000000010') $test$, 'First-time student import still commits');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000010'), (select id from public.movement_cases where legacy_id='STABILITY-STUDENT-IMPORT'), 'student import records its canonical identity');

update public.movement_cases set internal_note='Manually enriched; preserve me' where legacy_id='STABILITY-STUDENT-IMPORT';

update public.movement_participants set position_snapshot='Manually enriched position' where movement_id=(select id from public.movement_cases where legacy_id='STABILITY-STUDENT-IMPORT');

insert into preserved_records values ('student-parent',(select to_jsonb(p) from public.movement_cases p where legacy_id='STABILITY-STUDENT-IMPORT')),('student-children',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.movement_participants p where movement_id=(select id from public.movement_cases where legacy_id='STABILITY-STUDENT-IMPORT'))),('student-history',(select to_jsonb(r) from public.import_rows r where batch_id='a7200000-0000-0000-0000-000000000010'));

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000011', 'mobility', 'module_data', null, '[{"normalized": {"legacyId": "STABILITY-STUDENT-IMPORT-SHOULD-ROLLBACK", "projectName": "Student project", "direction": "outbound", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"sourceIdentifier": "STABILITY-STUDENT", "fullNameSnapshot": "Student participant"}]}}, {"normalized": {"legacyId": "STABILITY-STUDENT-IMPORT", "projectName": "Student project", "direction": "outbound", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"sourceIdentifier": "STABILITY-STUDENT", "fullNameSnapshot": "Student participant"}]}, "action": "update"}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_student_mobility_import_batch('a7200000-0000-0000-0000-000000000011') $test$, '23514', 'STUDENT_MOBILITY_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION', 'student re-import explicitly rejects an existing record');

select is((select count(*)::integer from public.movement_cases where legacy_id='STABILITY-STUDENT-IMPORT-SHOULD-ROLLBACK'), 0, 'student rejection rolls back earlier new rows in the same batch');

select is((select to_jsonb(p) from public.movement_cases p where legacy_id='STABILITY-STUDENT-IMPORT'), (select value from preserved_records where name='student-parent'), 'student re-import preserves the full enriched canonical record');

select is((select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.movement_participants p where movement_id=(select id from public.movement_cases where legacy_id='STABILITY-STUDENT-IMPORT')), (select value from preserved_records where name='student-children'), 'student re-import preserves child identities and manual fields');

select is((select to_jsonb(r) from public.import_rows r where batch_id='a7200000-0000-0000-0000-000000000010'), (select value from preserved_records where name='student-history'), 'student re-import preserves prior import provenance');

select is((select status::text from public.import_batches where id='a7200000-0000-0000-0000-000000000011'), 'ready', 'student rejected batch remains ready for review');

select is((select count(*)::integer from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000011' and target_record_id is null and status='valid'), 2, 'student rejected batch has no false imported row');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000012', 'mobility', 'module_data', null, '[{"normalized": {"legacyId": "STABILITY-STUDENT-IMPORT-DUPLICATE", "projectName": "Student project", "direction": "outbound", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"sourceIdentifier": "STABILITY-STUDENT", "fullNameSnapshot": "Student participant"}]}}, {"normalized": {"legacyId": "STABILITY-STUDENT-IMPORT-DUPLICATE", "projectName": "Student project", "direction": "outbound", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"sourceIdentifier": "STABILITY-STUDENT", "fullNameSnapshot": "Student participant"}]}}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_student_mobility_import_batch('a7200000-0000-0000-0000-000000000012') $test$, '23514', 'STUDENT_MOBILITY_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION', 'student duplicate identities within one batch are rejected');

select is((select count(*)::integer from public.movement_cases where legacy_id='STABILITY-STUDENT-IMPORT-DUPLICATE'), 0, 'student duplicate rejection is atomic');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000020', 'travel', 'module_data', 'legacy_staff_travel', '[{"normalized": {"legacyId": "STABILITY-TRAVEL-IMPORT", "projectName": "Travel project", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"fullNameSnapshot": "Travel participant", "personSource": "staff", "positionSnapshot": "Original position"}]}}]'::jsonb); end $setup$;

select lives_ok($test$ select public.commit_legacy_travel_import_batch('a7200000-0000-0000-0000-000000000020') $test$, 'First-time travel import still commits');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000020'), (select id from public.movement_cases where legacy_id='STABILITY-TRAVEL-IMPORT'), 'travel import records its canonical identity');

select is((select departure_date from public.movement_participants where movement_id=(select id from public.movement_cases where legacy_id='STABILITY-TRAVEL-IMPORT')), '2026-01-02'::date, 'First-time travel import preserves destination departure as the project end date');

select is((select arrival_date from public.movement_participants where movement_id=(select id from public.movement_cases where legacy_id='STABILITY-TRAVEL-IMPORT')), '2026-01-01'::date, 'First-time travel import preserves destination arrival as the project start date');

update public.movement_cases set internal_note='Manually enriched; preserve me' where legacy_id='STABILITY-TRAVEL-IMPORT';

update public.movement_participants set position_snapshot='Manually enriched position' where movement_id=(select id from public.movement_cases where legacy_id='STABILITY-TRAVEL-IMPORT');

insert into preserved_records values ('travel-parent',(select to_jsonb(p) from public.movement_cases p where legacy_id='STABILITY-TRAVEL-IMPORT')),('travel-children',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.movement_participants p where movement_id=(select id from public.movement_cases where legacy_id='STABILITY-TRAVEL-IMPORT'))),('travel-history',(select to_jsonb(r) from public.import_rows r where batch_id='a7200000-0000-0000-0000-000000000020'));

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000021', 'travel', 'module_data', 'legacy_staff_travel', '[{"normalized": {"legacyId": "STABILITY-TRAVEL-IMPORT-SHOULD-ROLLBACK", "projectName": "Travel project", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"fullNameSnapshot": "Travel participant", "personSource": "staff", "positionSnapshot": "Original position"}]}}, {"normalized": {"legacyId": "STABILITY-TRAVEL-IMPORT", "projectName": "Travel project", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"fullNameSnapshot": "Travel participant", "personSource": "staff", "positionSnapshot": "Original position"}]}, "action": "update"}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_legacy_travel_import_batch('a7200000-0000-0000-0000-000000000021') $test$, '23514', 'LEGACY_TRAVEL_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION', 'travel re-import explicitly rejects an existing record');

select is((select count(*)::integer from public.movement_cases where legacy_id='STABILITY-TRAVEL-IMPORT-SHOULD-ROLLBACK'), 0, 'travel rejection rolls back earlier new rows in the same batch');

select is((select to_jsonb(p) from public.movement_cases p where legacy_id='STABILITY-TRAVEL-IMPORT'), (select value from preserved_records where name='travel-parent'), 'travel re-import preserves the full enriched canonical record');

select is((select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.movement_participants p where movement_id=(select id from public.movement_cases where legacy_id='STABILITY-TRAVEL-IMPORT')), (select value from preserved_records where name='travel-children'), 'travel re-import preserves child identities and manual fields');

select is((select to_jsonb(r) from public.import_rows r where batch_id='a7200000-0000-0000-0000-000000000020'), (select value from preserved_records where name='travel-history'), 'travel re-import preserves prior import provenance');

select is((select status::text from public.import_batches where id='a7200000-0000-0000-0000-000000000021'), 'ready', 'travel rejected batch remains ready for review');

select is((select count(*)::integer from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000021' and target_record_id is null and status='valid'), 2, 'travel rejected batch has no false imported row');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000022', 'travel', 'module_data', 'legacy_staff_travel', '[{"normalized": {"legacyId": "STABILITY-TRAVEL-IMPORT-DUPLICATE", "projectName": "Travel project", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"fullNameSnapshot": "Travel participant", "personSource": "staff", "positionSnapshot": "Original position"}]}}, {"normalized": {"legacyId": "STABILITY-TRAVEL-IMPORT-DUPLICATE", "projectName": "Travel project", "sourceStatus": "completed", "startDate": "2026-01-01", "endDate": "2026-01-02", "fiscalYear": 2569, "participants": [{"fullNameSnapshot": "Travel participant", "personSource": "staff", "positionSnapshot": "Original position"}]}}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_legacy_travel_import_batch('a7200000-0000-0000-0000-000000000022') $test$, '23514', 'LEGACY_TRAVEL_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION', 'travel duplicate identities within one batch are rejected');

select is((select count(*)::integer from public.movement_cases where legacy_id='STABILITY-TRAVEL-IMPORT-DUPLICATE'), 0, 'travel duplicate rejection is atomic');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000030', 'mou', 'module_data', 'legacy_partner_contacts', '[{"normalized": {"partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "fullName": "Stability Contact", "contactMethods": [{"method_type": "email", "value": "original@example.test"}]}}]'::jsonb); end $setup$;

select lives_ok($test$ select public.commit_legacy_contact_import_batch('a7200000-0000-0000-0000-000000000030') $test$, 'First-time contact import still commits');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000030'), (select id from public.partner_contacts where full_name='Stability Contact'), 'contact import records its canonical identity');

update public.partner_contacts set internal_note='Manually enriched; preserve me' where full_name='Stability Contact';

update public.partner_contact_methods set label='Manual private contact detail' where partner_contact_id=(select id from public.partner_contacts where full_name='Stability Contact');

insert into preserved_records values ('contact-parent',(select to_jsonb(p) from public.partner_contacts p where full_name='Stability Contact')),('contact-children',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.partner_contact_methods p where partner_contact_id=(select id from public.partner_contacts where full_name='Stability Contact'))),('contact-history',(select to_jsonb(r) from public.import_rows r where batch_id='a7200000-0000-0000-0000-000000000030'));

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000031', 'mou', 'module_data', 'legacy_partner_contacts', '[{"normalized": {"partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "fullName": "Stability Contact-SHOULD-ROLLBACK", "contactMethods": [{"method_type": "email", "value": "original@example.test"}]}}, {"normalized": {"partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "fullName": "Stability Contact", "contactMethods": [{"method_type": "email", "value": "original@example.test"}]}, "action": "update"}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_legacy_contact_import_batch('a7200000-0000-0000-0000-000000000031') $test$, '23514', 'LEGACY_CONTACT_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION', 'contact re-import explicitly rejects an existing record');

select is((select count(*)::integer from public.partner_contacts where full_name='Stability Contact-SHOULD-ROLLBACK'), 0, 'contact rejection rolls back earlier new rows in the same batch');

select is((select to_jsonb(p) from public.partner_contacts p where full_name='Stability Contact'), (select value from preserved_records where name='contact-parent'), 'contact re-import preserves the full enriched canonical record');

select is((select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.partner_contact_methods p where partner_contact_id=(select id from public.partner_contacts where full_name='Stability Contact')), (select value from preserved_records where name='contact-children'), 'contact re-import preserves child identities and manual fields');

select is((select to_jsonb(r) from public.import_rows r where batch_id='a7200000-0000-0000-0000-000000000030'), (select value from preserved_records where name='contact-history'), 'contact re-import preserves prior import provenance');

select is((select status::text from public.import_batches where id='a7200000-0000-0000-0000-000000000031'), 'ready', 'contact rejected batch remains ready for review');

select is((select count(*)::integer from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000031' and target_record_id is null and status='valid'), 2, 'contact rejected batch has no false imported row');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000032', 'mou', 'module_data', 'legacy_partner_contacts', '[{"normalized": {"partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "fullName": "Stability Contact-DUPLICATE", "contactMethods": [{"method_type": "email", "value": "original@example.test"}]}}, {"normalized": {"partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "fullName": "Stability Contact-DUPLICATE", "contactMethods": [{"method_type": "email", "value": "original@example.test"}]}}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_legacy_contact_import_batch('a7200000-0000-0000-0000-000000000032') $test$, '23514', 'LEGACY_CONTACT_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION', 'contact duplicate identities within one batch are rejected');

select is((select count(*)::integer from public.partner_contacts where full_name='Stability Contact-DUPLICATE'), 0, 'contact duplicate rejection is atomic');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000040', 'mou', 'module_data', 'v2.public.mou.list', '[{"normalized": {"legacyId": "STABILITY-MOU-IMPORT", "titleTh": "Test agreement", "sourceStatus": "active", "partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "partnerNameEn": "Stability partner", "ownerUnitId": "a7300000-0000-0000-0000-000000000002"}}]'::jsonb); end $setup$;

select lives_ok($test$ select public.commit_legacy_mou_import_batch('a7200000-0000-0000-0000-000000000040') $test$, 'First-time mou import still commits');

select is((select target_record_id from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000040'), (select id from public.agreements where legacy_id='STABILITY-MOU-IMPORT'), 'mou import records its canonical identity');

update public.agreements set internal_note='Manually enriched; preserve me' where legacy_id='STABILITY-MOU-IMPORT';

insert into preserved_records values ('mou-parent',(select to_jsonb(p) from public.agreements p where legacy_id='STABILITY-MOU-IMPORT')),('mou-children',(select jsonb_build_object('partners',(select jsonb_agg(to_jsonb(p) order by p.partner_organization_id) from public.agreement_partners p where agreement_id=(select id from public.agreements where legacy_id='STABILITY-MOU-IMPORT')),'units',(select jsonb_agg(to_jsonb(p) order by p.organization_unit_id) from public.agreement_units p where agreement_id=(select id from public.agreements where legacy_id='STABILITY-MOU-IMPORT'))))),('mou-history',(select to_jsonb(r) from public.import_rows r where batch_id='a7200000-0000-0000-0000-000000000040'));

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000041', 'mou', 'module_data', 'v2.public.mou.list', '[{"normalized": {"legacyId": "STABILITY-MOU-IMPORT-SHOULD-ROLLBACK", "titleTh": "Test agreement", "sourceStatus": "active", "partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "partnerNameEn": "Stability partner", "ownerUnitId": "a7300000-0000-0000-0000-000000000002"}}, {"normalized": {"legacyId": "STABILITY-MOU-IMPORT", "titleTh": "Test agreement", "sourceStatus": "active", "partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "partnerNameEn": "Stability partner", "ownerUnitId": "a7300000-0000-0000-0000-000000000002"}, "action": "update"}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_legacy_mou_import_batch('a7200000-0000-0000-0000-000000000041') $test$, '23514', 'LEGACY_MOU_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION', 'mou re-import explicitly rejects an existing record');

select is((select count(*)::integer from public.agreements where legacy_id='STABILITY-MOU-IMPORT-SHOULD-ROLLBACK'), 0, 'mou rejection rolls back earlier new rows in the same batch');

select is((select to_jsonb(p) from public.agreements p where legacy_id='STABILITY-MOU-IMPORT'), (select value from preserved_records where name='mou-parent'), 'mou re-import preserves the full enriched canonical record');

select is((select jsonb_build_object('partners',(select jsonb_agg(to_jsonb(p) order by p.partner_organization_id) from public.agreement_partners p where agreement_id=(select id from public.agreements where legacy_id='STABILITY-MOU-IMPORT')),'units',(select jsonb_agg(to_jsonb(p) order by p.organization_unit_id) from public.agreement_units p where agreement_id=(select id from public.agreements where legacy_id='STABILITY-MOU-IMPORT')))), (select value from preserved_records where name='mou-children'), 'mou re-import preserves child identities and manual fields');

select is((select to_jsonb(r) from public.import_rows r where batch_id='a7200000-0000-0000-0000-000000000040'), (select value from preserved_records where name='mou-history'), 'mou re-import preserves prior import provenance');

select is((select status::text from public.import_batches where id='a7200000-0000-0000-0000-000000000041'), 'ready', 'mou rejected batch remains ready for review');

select is((select count(*)::integer from public.import_rows where batch_id='a7200000-0000-0000-0000-000000000041' and target_record_id is null and status='valid'), 2, 'mou rejected batch has no false imported row');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000042', 'mou', 'module_data', 'v2.public.mou.list', '[{"normalized": {"legacyId": "STABILITY-MOU-IMPORT-DUPLICATE", "titleTh": "Test agreement", "sourceStatus": "active", "partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "partnerNameEn": "Stability partner", "ownerUnitId": "a7300000-0000-0000-0000-000000000002"}}, {"normalized": {"legacyId": "STABILITY-MOU-IMPORT-DUPLICATE", "titleTh": "Test agreement", "sourceStatus": "active", "partnerOrganizationId": "a7300000-0000-0000-0000-000000000003", "partnerNameEn": "Stability partner", "ownerUnitId": "a7300000-0000-0000-0000-000000000002"}}]'::jsonb); end $setup$;

select throws_ok($test$ select public.commit_legacy_mou_import_batch('a7200000-0000-0000-0000-000000000042') $test$, '23514', 'LEGACY_MOU_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION', 'mou duplicate identities within one batch are rejected');

select is((select count(*)::integer from public.agreements where legacy_id='STABILITY-MOU-IMPORT-DUPLICATE'), 0, 'mou duplicate rejection is atomic');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000006', 'settings', 'master_data', null,
  '[{"entity":"organization_unit","normalized":{"name_th":"Missing identity"}}]'::jsonb); end $setup$;
select throws_ok($test$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000006') $test$,
  '23514', 'MASTER_IMPORT_IDENTITY_INVALID', 'Master rows without a canonical identity are rejected before inserting');
select is((select count(*)::integer from public.organization_units where name_th='Missing identity'), 0,
  'Malformed identity writes no destination row without provenance');

do $setup$ begin perform pg_temp.stage_import('a7200000-0000-0000-0000-000000000007', 'settings', 'master_data', null,
  '[{"entity":"staff","normalized":{"person_type":"student","source_identifier":"STABILITY-MISMATCH","full_name_th":"Mismatched type"}}]'::jsonb); end $setup$;
select throws_ok($test$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000007') $test$,
  '23514', 'MASTER_IMPORT_IDENTITY_INVALID', 'Master entity and canonical person type must match');

set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok($test$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000001') $test$, '42501', 'MASTER_IMPORT_FORBIDDEN', 'Office Admin cannot bypass the system-only commit_master_import_batch API boundary');

select throws_ok($test$ select public.commit_legacy_travel_import_batch('a7200000-0000-0000-0000-000000000001') $test$, '42501', 'LEGACY_TRAVEL_IMPORT_FORBIDDEN', 'Office Admin cannot bypass the system-only commit_legacy_travel_import_batch API boundary');

select throws_ok($test$ select public.commit_legacy_contact_import_batch('a7200000-0000-0000-0000-000000000001') $test$, '42501', 'LEGACY_CONTACT_IMPORT_FORBIDDEN', 'Office Admin cannot bypass the system-only commit_legacy_contact_import_batch API boundary');

select throws_ok($test$ select public.commit_legacy_mou_import_batch('a7200000-0000-0000-0000-000000000001') $test$, '42501', 'LEGACY_MOU_IMPORT_FORBIDDEN', 'Office Admin cannot bypass the system-only commit_legacy_mou_import_batch API boundary');

select * from finish();
rollback;