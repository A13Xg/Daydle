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

  IF has_function_privilege('authenticated','app_private.random_friend_code()','EXECUTE')
    OR has_function_privilege('anon','app_private.random_friend_code()','EXECUTE')
    OR has_function_privilege('authenticated','app_private.allocate_friend_code(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','app_private.on_auth_user_created()','EXECUTE')
  THEN
    RAISE EXCEPTION 'privileged registration function exposed to browser role';
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
  IF total <> 253 THEN RAISE EXCEPTION 'friend-code collisions were not retried'; END IF;
END $$;

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

SELECT 'PASS: signup trigger, onboarding, friend-code entropy/uniqueness, grants' AS test_summary;
