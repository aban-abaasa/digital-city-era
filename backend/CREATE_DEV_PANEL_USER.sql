-- Creates (or resets the password for) a real Supabase Auth user for
-- agrobone0@gmail.com / @1997God, used by the Supermartkera dev-panel
-- intercept in CustomerLogin.jsx / UnifiedAuth.jsx.
--
-- Run this once in the Supabase SQL Editor for this project
-- (https://hswxazpxcgtqbxeqcxxw.supabase.co -> SQL Editor).

do $$
declare
  v_user_id uuid;
  v_email   text := 'agrobone0@gmail.com';
  v_password text := '@1997God';
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, crypt(v_password, gen_salt('bf')),
      now(), '', '',
      '{"provider":"email","providers":["email"]}', '{"full_name":"Supermartkera Dev"}',
      now(), now()
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', now(), now(), now()
    );

    raise notice 'Created new auth user % (%)', v_email, v_user_id;
  else
    update auth.users
      set encrypted_password = crypt(v_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_user_id;

    raise notice 'Updated password for existing auth user % (%)', v_email, v_user_id;
  end if;
end $$;
