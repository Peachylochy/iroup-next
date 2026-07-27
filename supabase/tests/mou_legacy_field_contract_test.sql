begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_column(
  'public', 'agreement_partners', 'country_id_snapshot',
  'agreement partners retain a country snapshot'
);

select has_column(
  'public', 'agreement_partners', 'partner_name_en_snapshot',
  'agreement partners retain a partner-name snapshot'
);

select is(
  private.mou_thai_fiscal_year('2026-09-30'::date),
  2569,
  'Thai fiscal year remains in the same calendar year before October'
);

select is(
  private.mou_thai_fiscal_year('2026-10-01'::date),
  2570,
  'Thai fiscal year advances in October'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mou-contract-admin@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into private.user_roles (user_id, role)
values ('c1000000-0000-0000-0000-000000000001', 'system_admin');

insert into private.module_permissions (
  user_id, module, can_view, can_create, can_update, can_publish, can_delete
) values (
  'c1000000-0000-0000-0000-000000000001', 'mou', true, true, true, true, true
);

insert into public.countries (id, iso2, iso3, name_th, name_en, continent_code)
values ('c2000000-0000-0000-0000-000000000001', 'JP', 'JPN', 'ญี่ปุ่น', 'Japan', 'AS');

insert into public.partner_organizations (id, name_th, name_en, country_id, verification_status)
values (
  'c3000000-0000-0000-0000-000000000001',
  'มหาวิทยาลัยทดสอบ', 'Test University',
  'c2000000-0000-0000-0000-000000000001', 'verified'
);

insert into public.agreements (
  id, title_th, agreement_type, start_date, fiscal_year, created_by
) values (
  'c4000000-0000-0000-0000-000000000001',
  'MOU snapshot test', 'MOU', '2026-10-01', 2500,
  'c1000000-0000-0000-0000-000000000001'
);

insert into public.agreement_partners (
  agreement_id, partner_organization_id, is_lead, created_by
) values (
  'c4000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000001', true,
  'c1000000-0000-0000-0000-000000000001'
);

select is(
  (select fiscal_year from public.agreements where id = 'c4000000-0000-0000-0000-000000000001'),
  2570,
  'agreement fiscal year is calculated from its start date'
);

select results_eq(
  $$ select partner_name_en_snapshot, country_name_en_snapshot, continent_code_snapshot
     from public.agreement_partners
     where agreement_id = 'c4000000-0000-0000-0000-000000000001' $$,
  $$ values ('Test University'::text, 'Japan'::text, 'AS'::text) $$,
  'partner and country values are snapshotted when linked to an MOU'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    do $delete$
    declare
      original_updated_at timestamptz;
      deleted_record jsonb;
    begin
      select updated_at into original_updated_at
      from public.agreements
      where id = 'c4000000-0000-0000-0000-000000000001';

      deleted_record := public.mou_soft_delete(
        'c4000000-0000-0000-0000-000000000001', original_updated_at, 'test retention'
      );

      if (deleted_record ->> 'purge_files_after') is null then
        raise exception 'missing purge deadline';
      end if;

      perform public.mou_restore('c4000000-0000-0000-0000-000000000001');

      if exists (
        select 1 from public.agreements
        where id = 'c4000000-0000-0000-0000-000000000001'
          and deleted_at is not null
      ) then
        raise exception 'MOU did not restore';
      end if;
    end;
  $delete$;
  $$,
  'System Admin can soft-delete and restore an MOU before its 30-day retention deadline'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.mou_soft_delete(uuid, timestamptz, text)',
    'EXECUTE'
  ),
  'anonymous users cannot delete MOU records'
);

select * from finish();
rollback;
