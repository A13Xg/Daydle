-- Phase 5 owner-private daily played markers; two clean PG17 databases.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='user_game_day_marks'
      AND c.relrowsecurity AND c.relkind='r'
  ) THEN RAISE EXCEPTION 'Manual played table has no RLS'; END IF;
  IF has_table_privilege('anon','public.user_game_day_marks','SELECT')
     OR has_table_privilege('authenticated','public.user_game_day_marks','UPDATE')
     OR has_any_column_privilege('authenticated','public.user_game_day_marks','UPDATE')
  THEN RAISE EXCEPTION 'Manual played markers have unsafe grants'; END IF;
  IF NOT has_table_privilege('authenticated','public.user_game_day_marks','INSERT')
     OR NOT has_table_privilege('authenticated','public.user_game_day_marks','DELETE')
  THEN RAISE EXCEPTION 'Owner mark/unmark grants missing'; END IF;
END $$;

-- One profile already selected Wordle in the Phase 2 fixture. The manual
-- mark does not write game_results or contain an outcome/score.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$
DECLARE n integer;
DECLARE rejected boolean:=false;
BEGIN
  INSERT INTO public.user_game_day_marks(user_id,game_id,local_date)
  VALUES (
    '11111111-1111-1111-1111-111111111111',
    '40000000-0000-4000-8000-000000000001',
    CURRENT_DATE
  );
  SELECT count(*) INTO n FROM public.user_game_day_marks;
  IF n<>1 THEN RAISE EXCEPTION 'Owner cannot see own day mark'; END IF;
  BEGIN
    INSERT INTO public.user_game_day_marks(user_id,game_id,local_date)
    VALUES ('11111111-1111-1111-1111-111111111111',
     '40000000-0000-4000-8000-000000000001',CURRENT_DATE);
  EXCEPTION WHEN unique_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Duplicate manual marker accepted'; END IF;
  IF EXISTS(SELECT 1 FROM public.game_results WHERE user_id='11111111-1111-1111-1111-111111111111'
   AND parser_version='manual') THEN
    RAISE EXCEPTION 'A manual marker fabricated a result';
  END IF;
END $$;
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
DO $$
DECLARE n integer;
DECLARE rejected boolean:=false;
BEGIN
  SELECT count(*) INTO n FROM public.user_game_day_marks;
  IF n<>0 THEN RAISE EXCEPTION 'Other user could read private marks'; END IF;

  BEGIN
    INSERT INTO public.user_game_day_marks(user_id,game_id,local_date)
    VALUES ('11111111-1111-1111-1111-111111111111',
     '40000000-0000-4000-8000-000000000001',CURRENT_DATE+1);
  EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Other user wrote a mark for owner'; END IF;

  rejected:=false;
  BEGIN
    INSERT INTO public.user_game_day_marks(user_id,game_id,local_date)
    VALUES ('22222222-2222-2222-2222-222222222222',
     '40000000-0000-4000-8000-000000000007',CURRENT_DATE);
  EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unselected game was marked played'; END IF;

  DELETE FROM public.user_game_day_marks;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Other user deleted owner marks'; END IF;
END $$;
ROLLBACK;

-- A selected game can be unmarked, and marks cascade when the user removes
-- that game, eliminating orphaned private activity without touching results.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$
DECLARE n integer;
BEGIN
  DELETE FROM public.user_game_day_marks
  WHERE game_id='40000000-0000-4000-8000-000000000001' AND local_date=CURRENT_DATE;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Owner could not unmark played'; END IF;
  INSERT INTO public.user_game_day_marks(user_id,game_id,local_date)
  VALUES ('11111111-1111-1111-1111-111111111111',
   '40000000-0000-4000-8000-000000000001', CURRENT_DATE);
END $$;
COMMIT;

-- Exercise cascade as database owner without changing user selections
-- permanently, then verify the original mark survived rollback.
BEGIN;
DELETE FROM public.user_games WHERE user_id='11111111-1111-1111-1111-111111111111'
  AND game_id='40000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.user_game_day_marks
    WHERE user_id='11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'Removing a selected game left private played markers'; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: owner-only daily marks, unmark, FK, cascade, no fabricated result' AS test_summary;
