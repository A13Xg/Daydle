-- Fail fast on ANY unexpected visibility, privilege or integrity regression.
-- psql runs this script as database owner, with transaction-local SET ROLE
-- simulating Supabase request roles and auth.uid() claims.

DO $$
DECLARE missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count FROM (
    SELECT unnest(ARRAY[
      'profiles','friend_codes','games','game_categories','game_category_links',
      'user_games','puzzles','game_results','raw_submissions','result_corrections',
      'friendships','blocks','achievement_definitions','user_achievements',
      'game_suggestions','suggestion_votes'
    ]) AS name
  ) expected
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = expected.name
      AND c.relrowsecurity
  );
  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'RLS missing for % public tables', missing_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION 'Email leaked into public profiles';
  END IF;

  IF has_table_privilege('authenticated','public.raw_submissions','SELECT')
    OR has_table_privilege('anon','public.raw_submissions','SELECT')
    OR has_table_privilege('authenticated','app_private.admin_events','SELECT')
    OR has_table_privilege('anon','public.friend_codes','SELECT') THEN
    RAISE EXCEPTION 'Private table has an unauthorized SELECT grant';
  END IF;

  IF has_table_privilege('authenticated','public.game_results','INSERT')
    OR has_table_privilege('authenticated','public.game_results','UPDATE')
    OR has_table_privilege('anon','public.game_results','INSERT') THEN
    RAISE EXCEPTION 'Direct authoritative-result writes are exposed';
  END IF;
END $$;

-- Negative constraint checks. An expected SQLSTATE is caught; any other
-- exception or unexpectedly successful insert fails the suite.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.friend_codes(user_id, code)
      VALUES ('11111111-1111-1111-1111-111111111111','0O1IL');
    RAISE EXCEPTION 'invalid friend code was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.friend_codes(user_id, code)
      VALUES ('33333333-3333-3333-3333-333333333333','7KMP4');
    RAISE EXCEPTION 'duplicate friend code was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.game_results(user_id,game_id,puzzle_id,parser_version)
      VALUES ('11111111-1111-1111-1111-111111111111',
              'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              'cccccccc-cccc-cccc-cccc-cccccccccccc','2');
    RAISE EXCEPTION 'duplicate result accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.game_results(user_id,game_id,puzzle_id,parser_version)
      VALUES ('22222222-2222-2222-2222-222222222222',
              'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              'cccccccc-cccc-cccc-cccc-cccccccccccc','1');
    RAISE EXCEPTION 'game/puzzle mismatch accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.friendships(user_low,user_high)
      VALUES ('22222222-2222-2222-2222-222222222222',
              '11111111-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'unordered friendship accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.raw_submissions(user_id, raw_share_text, disposition,
                                       received_at, expires_at)
      VALUES ('11111111-1111-1111-1111-111111111111','bad ttl','invalid',
              now(),now()+interval '91 days');
    RAISE EXCEPTION 'raw text retention > 90d accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.game_results(user_id,game_id,puzzle_id,parser_version,metrics)
      VALUES ('22222222-2222-2222-2222-222222222222',
              'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              'cccccccc-cccc-cccc-cccc-cccccccccccc','1','[]'::jsonb);
    RAISE EXCEPTION 'array metrics accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM public.games WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'game deletion destroyed historical puzzle records';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- Anonymous: public profiles and stale results only. Current puzzles hidden.
BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE result_count integer;
DECLARE achievement_count integer;
BEGIN
  SELECT count(*) INTO result_count FROM public.profiles;
  IF result_count <> 3 THEN RAISE EXCEPTION 'public profiles hidden'; END IF;

  SELECT count(*) INTO result_count FROM public.game_results;
  IF result_count <> 1 THEN RAISE EXCEPTION 'anonymous spoiler leak: % results',result_count; END IF;

  SELECT count(*) INTO achievement_count FROM public.user_achievements;
  IF achievement_count <> 1 THEN RAISE EXCEPTION 'anonymous achievement leak: %',achievement_count; END IF;

  IF EXISTS (SELECT 1 FROM public.game_results WHERE puzzle_id='cccccccc-cccc-cccc-cccc-cccccccccccc') THEN
    RAISE EXCEPTION 'active result visible to anonymous';
  END IF;
END $$;
COMMIT;

-- Authentication without submission cannot see other players' active scores.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
DO $$
DECLARE total integer;
DECLARE authorized boolean := true;
BEGIN
  SELECT count(*) INTO total FROM public.game_results;
  IF total <> 1 THEN RAISE EXCEPTION 'unplayed result leaked: %',total; END IF;

  SELECT count(*) INTO total FROM public.friendships;
  IF total <> 1 THEN RAISE EXCEPTION 'own friendship invisible'; END IF;

  SELECT count(*) INTO total FROM public.friend_codes;
  IF total <> 1 THEN RAISE EXCEPTION 'friend codes not scoped to self'; END IF;

  SELECT count(*) INTO total FROM public.blocks;
  IF total <> 0 THEN RAISE EXCEPTION 'another user block visible'; END IF;

  SELECT count(*) INTO total FROM public.suggestion_votes;
  IF total <> 1 THEN RAISE EXCEPTION 'vote scoped incorrectly'; END IF;

  BEGIN PERFORM 1 FROM public.raw_submissions;
  EXCEPTION WHEN insufficient_privilege THEN authorized := false;
  END;
  IF authorized THEN RAISE EXCEPTION 'raw submissions accessible'; END IF;

  authorized := true;
  BEGIN
    INSERT INTO public.game_results(user_id, game_id,puzzle_id,parser_version)
    VALUES ('22222222-2222-2222-2222-222222222222',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'cccccccc-cccc-cccc-cccc-cccccccccccc','forged');
  EXCEPTION WHEN insufficient_privilege THEN authorized := false;
  END;
  IF authorized THEN RAISE EXCEPTION 'user inserted authoritative score'; END IF;

  UPDATE public.profiles SET display_name='Invalid change'
    WHERE id='11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS total = ROW_COUNT;
  IF total <> 0 THEN RAISE EXCEPTION 'edited another user profile'; END IF;

  UPDATE public.profiles SET display_name='Two Updated'
    WHERE id='22222222-2222-2222-2222-222222222222';
  GET DIAGNOSTICS total = ROW_COUNT;
  IF total <> 1 THEN RAISE EXCEPTION 'own profile update denied'; END IF;
END $$;
ROLLBACK;

-- Owner can see own active result. Friend data is not additional permission.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM public.game_results;
  IF total <> 2 THEN RAISE EXCEPTION 'owner result visibility failed'; END IF;
  SELECT count(*) INTO total FROM public.friend_codes;
  IF total <> 1 THEN RAISE EXCEPTION 'owner friend code visibility failed'; END IF;
  SELECT count(*) INTO total FROM public.user_achievements;
  IF total <> 2 THEN RAISE EXCEPTION 'owner achievement visibility failed'; END IF;
END $$;
COMMIT;

-- Once the viewer legitimately submits the SAME puzzle, RLS reveals peers'
-- results without relying on friendship; unrelated third users stay masked.
INSERT INTO public.game_results(user_id,game_id,puzzle_id,outcome,attempts,parser_version)
VALUES ('22222222-2222-2222-2222-222222222222',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'cccccccc-cccc-cccc-cccc-cccccccccccc','win',5,'1.0.0');

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM public.game_results;
  IF total <> 3 THEN RAISE EXCEPTION 'viewer same-puzzle unlock failed: %',total; END IF;
  SELECT count(*) INTO total FROM public.user_achievements;
  IF total <> 2 THEN RAISE EXCEPTION 'viewer achievement unlock failed'; END IF;
END $$;
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM public.game_results;
  IF total <> 1 THEN RAISE EXCEPTION 'unrelated authenticated user saw spoiler'; END IF;
  SELECT count(*) INTO total FROM public.friendships;
  IF total <> 0 THEN RAISE EXCEPTION 'unrelated friendship visible'; END IF;
END $$;
COMMIT;

-- Service-role access is intentionally privileged but cannot be reached
-- through a publishable API key. A browser/client role must never inherit it.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM public.raw_submissions;
  IF total <> 2 THEN
    RAISE EXCEPTION 'service role cannot read private raw submissions';
  END IF;
  SELECT count(*) INTO total FROM app_private.admin_events;
  IF total <> 0 THEN
    RAISE EXCEPTION 'unexpected admin event fixture';
  END IF;
  IF NOT has_function_privilege(
    current_user, 'app_private.purge_expired_raw_submissions()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service role cannot perform raw purge';
  END IF;
END $$;
COMMIT;

-- Purge primitive: expires old raw text without deleting parsed history.
DO $$
DECLARE removed bigint;
DECLARE total integer;
BEGIN
  removed := app_private.purge_expired_raw_submissions();
  IF removed <> 1 THEN RAISE EXCEPTION 'expected one expired raw row, got %',removed; END IF;
  SELECT count(*) INTO total FROM public.raw_submissions;
  IF total <> 1 THEN RAISE EXCEPTION 'current raw row wrongly purged'; END IF;
  SELECT count(*) INTO total FROM public.game_results;
  IF total <> 3 THEN RAISE EXCEPTION 'raw purge deleted historical result'; END IF;
END $$;

-- All security tests passed if psql reaches this point with ON_ERROR_STOP.
SELECT 'PASS: schema, constraints, RLS, spoilers, privileges, TTL' AS test_summary;
