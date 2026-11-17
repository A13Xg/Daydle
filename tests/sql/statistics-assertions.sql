-- Phase 8: complete-dataset, owner-scoped statistics contract.
-- These tests are executed only on disposable isolated PostgreSQL databases.
DO $$
BEGIN
  IF has_function_privilege('anon','public.my_personal_statistics(uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.my_personal_statistics(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.my_personal_statistics(uuid,text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'Statistics RPC grant boundary is incorrect';
  END IF;
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
DO $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.my_personal_statistics(
      '11111111-1111-1111-1111-111111111111','UTC'
    );
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Browser can read privileged statistics RPC'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  user_one constant uuid := '11111111-1111-1111-1111-111111111111';
  user_two constant uuid := '22222222-2222-2222-2222-222222222222';
  fixture jsonb :=
    '{"gameSlug":"wordle","puzzleKey":"wordle:number:980001","puzzleDate":null,
    "outcome":"win","attempts":4,"score":null,"completionTimeMs":null,
    "metrics":{},"parserVersion":"1.0.0","formatVersion":"wordle-v1"}';
  result jsonb;
  saved uuid;
  summary jsonb;
  previous_count integer;
  invalid_zone boolean := false;
BEGIN
  summary := public.my_personal_statistics(user_one,'UTC');
  previous_count := (summary->>'totalResults')::integer;
  result := public.ingest_parsed_share(user_one,'Wordle fixture 980001',fixture);
  IF result->>'status' <> 'saved' THEN
    RAISE EXCEPTION 'Failed to save fixture %',result;
  END IF;
  saved := (result->>'id')::uuid;
  UPDATE public.game_results
    SET submitted_at = '2026-03-08T07:30:00Z'
    WHERE id = saved;
  summary := public.my_personal_statistics(user_one,'America/Los_Angeles');
  IF (summary->>'totalResults')::integer <> previous_count + 1
    OR (summary->>'gamesRecorded')::integer < 1
    OR (summary->>'daysActive')::integer < 1
    OR summary->>'timezone' <> 'America/Los_Angeles'
    OR summary::text LIKE '%Wordle fixture 980001%'
    OR summary::text LIKE '%raw_share_text%'
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(summary->'activityDays') d
      WHERE d #>> '{}' = '2026-03-07'
    )
  THEN
    RAISE EXCEPTION 'Stats count, timezone, privacy or DST-day grouping wrong: %',summary;
  END IF;

  IF public.my_personal_statistics(user_two,'UTC')::text LIKE '%980001%'
  THEN RAISE EXCEPTION 'Cross-user statistics leaked'; END IF;

  result := public.ingest_parsed_share(
    user_one,'Wordle fixture 980001 corrected',
    pg_catalog.jsonb_set(fixture,'{attempts}','2'::jsonb),saved
  );
  IF result->>'status' <> 'replaced'
  THEN RAISE EXCEPTION 'Correction fixture failed'; END IF;
  summary := public.my_personal_statistics(user_one,'UTC');
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(summary->'games') g
    WHERE g->>'slug'='wordle' AND (g->>'bestAttempts')::integer = 2
  )
  THEN RAISE EXCEPTION 'Correction did not recompute best-attempt metric'; END IF;

  IF public.delete_my_result(user_one,saved)->>'status'<>'deleted'
  THEN RAISE EXCEPTION 'Stats deletion fixture failed'; END IF;
  summary := public.my_personal_statistics(user_one,'UTC');
  IF (summary->>'totalResults')::integer <> previous_count
  THEN RAISE EXCEPTION 'Deletion did not update derived counts'; END IF;

  BEGIN
    PERFORM public.my_personal_statistics(user_one,'../../invalid_timezone');
  EXCEPTION WHEN invalid_parameter_value THEN invalid_zone := true;
  END;
  IF NOT invalid_zone THEN RAISE EXCEPTION 'Unsafe timezone accepted'; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: Phase 8 private full-dataset aggregates, DST days, correction and deletion' AS test_summary;
