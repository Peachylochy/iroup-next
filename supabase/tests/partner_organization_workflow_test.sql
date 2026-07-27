begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select has_column('public', 'partner_organizations', 'verification_status', 'partner verification state exists');
select has_function('public', 'partner_organization_save', array['uuid', 'timestamptz', 'jsonb'], 'partner save RPC exists');
select ok(not has_function_privilege('anon', 'public.partner_organization_save(uuid, timestamptz, jsonb)', 'EXECUTE'), 'anonymous users cannot save partners');
select ok(has_function_privilege('authenticated', 'public.partner_organization_save(uuid, timestamptz, jsonb)', 'EXECUTE'), 'authenticated users may call guarded partner RPC');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'partner-editor@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
insert into private.user_roles (user_id, role) values ('c1000000-0000-0000-0000-000000000001', 'editor');
insert into private.module_permissions (user_id, module, can_view, can_create, can_update, can_publish) values ('c1000000-0000-0000-0000-000000000001', 'mou', true, true, true, false);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    do $test$
    declare saved jsonb;
    begin
      begin
        insert into public.partner_organizations (name_en) values ('direct write must fail');
        raise exception 'direct write unexpectedly succeeded';
      exception when insufficient_privilege then null;
      end;
      saved := public.partner_organization_save(null, null, jsonb_build_object('name_th', 'มหาวิทยาลัยทดสอบ', 'source_note', 'หนังสือขอลงนาม', 'verification_status', 'pending_verification'));
      if (saved ->> 'verification_status') <> 'pending_verification' then raise exception 'partner state is invalid'; end if;
      begin
        perform public.partner_organization_save(null, null, jsonb_build_object('name_th', 'มหาวิทยาลัยทดสอบ'));
        raise exception 'duplicate partner unexpectedly succeeded';
      exception when unique_violation then null;
      end;
      begin
        perform public.partner_organization_save((saved ->> 'id')::uuid, (saved ->> 'updated_at')::timestamptz, jsonb_build_object('name_th', 'มหาวิทยาลัยทดสอบ', 'verification_status', 'verified'));
        raise exception 'editor unexpectedly verified partner';
      exception when insufficient_privilege then null;
      end;
    end;
    $test$;
  $$,
  'editor can create pending partner but cannot direct-write, duplicate, or verify it'
);

select * from finish();
rollback;
