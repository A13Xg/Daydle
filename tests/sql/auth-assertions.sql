-- Phase 3: Assert registration trigger, friend code guarantees and onboarding.
-- Test-only Supabase-compatible auth.users stub. Never run on hosted Supabase.

DO $$
DECLARE
  total integer;
  distinct_codes integer;
BEGIN
  SELECT count(*) INTO total FROM public.profiles;
  IF total <> 3 THEN RAISE EXCEPTION 'auth trigger created % profiles instead of 3',total; END IF;
  SELECT count(*) INTO total FROM public.friend_codes;
  IF total <> 3 THEN RAISE EXCEPTION 'auth trigger created % friend codes instead of 3',total; END IF;
  SELECT count(DISTINCT code) INTO distinct_codes FROM public.friend_codes;
  IF distinct_codes <> 3 THEN RAISE EXCEPTION 'duplicate friend codes were generated'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.friend_codes
    WHERE code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$'
  ) THEN
    RAISE EXCEPTION 'friend-code character contract violated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id='11111111-1111-1111-1111-111111111111'
      AND display_name='One' AND onboarding_completed)
  OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id='22222222-2222-2222-2222-222222222222'
      AND display_name='Two' AND onboarding_completed)
  OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id='33333333-3333-3333-3333-333333333333'
      AND display_name='Player' AND NOT onboarding_completed)
  THEN
    RAISE EXCEPTION 'initial profile names/onboarding flags incorrect';
  END IF;

  -- has_function_privilege also reflects grants to PUBLIC, so this covers all
  -- three functions for both browser roles.
  IF has_function_privilege('authenticated','app_private.random_friend_code()','EXECUTE')
    OR has_function_privilege('anon','app_private.random_friend_code()','EXECUTE')
    OR has_function_privilege('authenticated','app_private.allocate_friend_code(uuid)','EXECUTE')
    OR has_function_privilege('anon','app_private.allocate_friend_code(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','app_private.on_auth_user_created()','EXECUTE')
    OR has_function_privilege('anon','app_private.on_auth_user_created()','EXECUTE')
  THEN
    RAISE EXCEPTION 'privileged registration function exposed to browser role';
  END IF;

  IF NOT has_function_privilege('service_role','app_private.random_friend_code()','EXECUTE')
    OR NOT has_function_privilege('service_role','app_private.allocate_friend_code(uuid)','EXECUTE')
  THEN
    RAISE EXCEPTION 'service_role lost its documented friend-code function grants';
  END IF;
END $$;

-- Trigger-on-auth-user creation is the only supported profile creation path.
-- Exercise substantially more than a handful of registrations; the unique
-- constraint + ON CONFLICT retry are the authoritative collision guarantee.
INSERT INTO auth.users (id,email,raw_user_meta_data)
SELECT gen_random_uuid(), 'bulk-' || i || '@example.invalid',
       jsonb_build_object('display_name','Bulk ' || i)
FROM generate_series(1,250) AS i;

DO $$
DECLARE
  total integer;
BEGIN
  SELECT count(*) INTO total FROM public.profiles;
  IF total <> 253 THEN RAISE EXCEPTION 'bulk profile creation count = %',total; END IF;
  SELECT count(*) INTO total FROM public.friend_codes;
  IF total <> 253 THEN RAISE EXCEPTION 'bulk friend code count = %',total; END IF;
  SELECT count(DISTINCT code) INTO total FROM public.friend_codes;
  -- The unique constraint makes this hold by construction; it guards against
  -- the constraint being dropped. Retry behaviour itself is tested below.
  IF total <> 253 THEN RAISE EXCEPTION 'friend codes are not unique'; END IF;
END $$;

-- Collision retry: force the first candidate to equal an existing code, then
-- return a fresh one. The new user must still get a different code, after
-- exactly two attempts. Everything is rolled back.
BEGIN;
SELECT set_config('daydle.used_code', (SELECT code FROM public.friend_codes LIMIT 1), true);
SELECT set_config('daydle.calls', '0', true);
CREATE OR REPLACE FUNCTION app_private.random_friend_code() RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE n integer;
BEGIN
  n := current_setting('daydle.calls')::integer + 1;
  PERFORM set_config('daydle.calls', n::text, true);
  IF n = 1 THEN RETURN current_setting('daydle.used_code'); END IF;
  RETURN 'ZZZZZ';
END;
$f$;
INSERT INTO auth.users (id,email,raw_user_meta_data)
VALUES ('44444444-4444-4444-4444-444444444444','retry@example.invalid','{"display_name":"Retry"}');
DO $$
DECLARE assigned text;
BEGIN
  SELECT code INTO assigned FROM public.friend_codes
  WHERE user_id = '44444444-4444-4444-4444-444444444444';
  IF assigned IS NULL THEN RAISE EXCEPTION 'retry user received no friend code'; END IF;
  IF assigned = current_setting('daydle.used_code') THEN
    RAISE EXCEPTION 'a colliding friend code was assigned instead of retrying';
  END IF;
  IF assigned <> 'ZZZZZ' OR current_setting('daydle.calls')::integer <> 2 THEN
    RAISE EXCEPTION 'expected a retry on the second attempt (calls=%)', current_setting('daydle.calls');
  END IF;
END $$;
ROLLBACK;

-- Allocation failure: if every candidate collides, the whole signup must abort
-- and leave no auth user, profile or friend code behind.
BEGIN;
SELECT set_config('daydle.used_code', (SELECT code FROM public.friend_codes LIMIT 1), true);
CREATE OR REPLACE FUNCTION app_private.random_friend_code() RETURNS text
LANGUAGE sql AS $f$ SELECT current_setting('daydle.used_code') $f$;
DO $$
DECLARE failed boolean := false;
BEGIN
  BEGIN
    INSERT INTO auth.users (id,email,raw_user_meta_data)
    VALUES ('55555555-5555-5555-5555-555555555555','fail@example.invalid','{}');
  EXCEPTION WHEN unique_violation THEN failed := true;
  END;
  IF NOT failed THEN
    RAISE EXCEPTION 'signup succeeded although no friend code could be allocated';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '55555555-5555-5555-5555-555555555555')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = '55555555-5555-5555-5555-555555555555')
    OR EXISTS (SELECT 1 FROM public.friend_codes WHERE user_id = '55555555-5555-5555-5555-555555555555')
  THEN
    RAISE EXCEPTION 'a partial registration was left behind after allocation failure';
  END IF;
END $$;
ROLLBACK;

-- Display-name edge cases from provider metadata: over-long names are cut to
-- 80 characters; whitespace-only names fall back to Player with onboarding open.
BEGIN;
INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES
  ('66666666-6666-6666-6666-666666666666','long@example.invalid',
   jsonb_build_object('display_name', repeat('x', 100))),
  ('77777777-7777-7777-7777-777777777777','blank@example.invalid',
   jsonb_build_object('display_name', '   '));
DO $$
BEGIN
  IF (SELECT length(display_name) FROM public.profiles
      WHERE id = '66666666-6666-6666-6666-666666666666') <> 80 THEN
    RAISE EXCEPTION 'over-long provider name was not truncated to 80 characters';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = '77777777-7777-7777-7777-777777777777'
        AND display_name = 'Player' AND NOT onboarding_completed) THEN
    RAISE EXCEPTION 'whitespace-only provider name did not fall back to Player';
  END IF;
END $$;
ROLLBACK;

-- The public account receives an explicit validated display-name update,
-- but no ability to change a different user's profile or retrieve codes.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
DO $$
DECLARE changed integer;
DECLARE allowed boolean := true;
BEGIN
  UPDATE public.profiles
  SET display_name='Player Three', onboarding_completed=true
  WHERE id='33333333-3333-3333-3333-333333333333';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'owner onboarding update denied'; END IF;

  UPDATE public.profiles
  SET display_name='Not authorized', onboarding_completed=true
  WHERE id='11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'other user profile update allowed'; END IF;

  BEGIN
    UPDATE public.friend_codes SET code='7KMP4'
    WHERE user_id='33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN insufficient_privilege THEN allowed := false;
  END;
  IF allowed THEN RAISE EXCEPTION 'friend code can be edited by a browser user'; END IF;

  IF (SELECT count(*) FROM public.friend_codes) <> 1 THEN
    RAISE EXCEPTION 'friend-code read RLS leaked other profiles';
  END IF;
END $$;
ROLLBACK;

SELECT 'PASS: signup trigger, onboarding, friend-code uniqueness, collision retry, allocation-failure abort, name edge cases, grants' AS test_summary;
