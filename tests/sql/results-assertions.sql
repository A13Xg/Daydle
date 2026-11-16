-- Phase 7: isolated PG17 authoritative result persistence + owner-only RPC tests.
-- All changes in these tests are rolled back; never execute against hosted data.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.games WHERE parser_status='supported';
  IF n <> 5 THEN RAISE EXCEPTION 'Expected exactly five real parser-backed games, got %',n; END IF;
  IF EXISTS (SELECT 1 FROM public.games WHERE parser_status='supported'
             AND slug NOT IN ('wordle','connections','strands','mini-crossword','quordle'))
  THEN RAISE EXCEPTION 'Unsupported catalog entry marked parseable'; END IF;

  IF has_function_privilege('anon','public.ingest_parsed_share(uuid,text,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.ingest_parsed_share(uuid,text,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.retain_unknown_share(uuid,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.retain_unknown_share(uuid,text,text)','EXECUTE')
    OR has_function_privilege('anon','public.my_result_history(uuid,text,integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.my_result_history(uuid,text,integer,integer)','EXECUTE')
    OR has_function_privilege('anon','public.my_result_detail(uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.my_result_detail(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.delete_my_result(uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.delete_my_result(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon','app_private.consume_result_quota(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','app_private.consume_result_quota(uuid)','EXECUTE')
    OR has_table_privilege('authenticated','app_private.result_events','SELECT')
    OR has_table_privilege('authenticated','app_private.result_rate_limits','INSERT')
    OR has_table_privilege('authenticated','public.game_results','INSERT')
    OR has_any_column_privilege('authenticated','public.game_results','UPDATE')
    OR has_table_privilege('authenticated','public.raw_submissions','SELECT')
  THEN RAISE EXCEPTION 'Phase 7 server-only result capabilities leaked to browser role'; END IF;
  IF NOT has_function_privilege('service_role','public.ingest_parsed_share(uuid,text,jsonb,uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.delete_my_result(uuid,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Worker service-only result methods missing'; END IF;
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.ingest_parsed_share(
      '11111111-1111-1111-1111-111111111111',
      'Wordle example','{"gameSlug":"wordle","puzzleKey":"wordle:number:1406",
      "outcome":"win","parserVersion":"1.0.0","formatVersion":"wordle-v1"}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Browser could ingest a fabricated result'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  user_one constant uuid := '11111111-1111-1111-1111-111111111111';
  user_two constant uuid := '22222222-2222-2222-2222-222222222222';
  payload jsonb :=
    '{"gameSlug":"wordle","puzzleKey":"wordle:number:1406","puzzleDate":null,
    "outcome":"win","attempts":4,"score":null,"completionTimeMs":null,
    "metrics":{"hardMode":true},"parserVersion":"1.0.0","formatVersion":"wordle-v1"}';
  next_payload jsonb;
  r jsonb;
  saved uuid;
  n integer;
  denied boolean;
BEGIN
  r:=public.ingest_parsed_share(user_one,'Wordle 1406 4/6*',payload);
  IF r->>'status'<>'saved' THEN RAISE EXCEPTION 'Expected saved, got %',r; END IF;
  saved := (r->>'id')::uuid;
  IF saved IS NULL THEN RAISE EXCEPTION 'No ID after save'; END IF;
  IF (SELECT count(*) FROM public.puzzles WHERE game_id='40000000-0000-4000-8000-000000000001'
       AND puzzle_key='wordle:number:1406' AND puzzle_date IS NULL)<>1
  THEN RAISE EXCEPTION 'Canonical publisher number incorrectly inferred date'; END IF;

  r:=public.ingest_parsed_share(user_one,'same result with changed whitespace',payload);
  IF r->>'status'<>'duplicate' OR (r->>'id')::uuid<>saved
  THEN RAISE EXCEPTION 'Exact replay not idempotent: %',r; END IF;
  IF (SELECT count(*) FROM public.raw_submissions WHERE result_id=saved)<>1
  THEN RAISE EXCEPTION 'Duplicate stored redundant raw input'; END IF;

  next_payload:=jsonb_set(payload,'{attempts}','3'::jsonb);
  r:=public.ingest_parsed_share(user_one,'Wordle 1406 3/6',next_payload);
  IF r->>'status'<>'conflict' OR (r->>'id')::uuid<>saved
  THEN RAISE EXCEPTION 'Conflicting submission silently overwritten: %',r; END IF;
  r:=public.ingest_parsed_share(user_one,'Wordle 1406 3/6',next_payload,
                                'dddddddd-dddd-dddd-dddd-dddddddddddd');
  IF r->>'status'<>'replace_target_mismatch'
  THEN RAISE EXCEPTION 'Wrong target was allowed to replace result: %',r; END IF;
  r:=public.ingest_parsed_share(user_one,'Wordle 1406 3/6',next_payload,saved);
  IF r->>'status'<>'replaced'
  THEN RAISE EXCEPTION 'Explicit replacement failed: %',r; END IF;
  IF (SELECT attempts FROM public.game_results WHERE id=saved)<>3
    OR (SELECT count(*) FROM public.result_corrections WHERE result_id=saved)<>1
    OR (SELECT count(*) FROM public.raw_submissions WHERE result_id=saved)<>2
  THEN RAISE EXCEPTION 'Correction lineage or raw provenance missing'; END IF;
  IF public.my_result_detail(user_one,saved)->>'attempts'<>'3'
  THEN RAISE EXCEPTION 'Owner detail wrong after correction'; END IF;
  IF public.my_result_detail(user_two,saved) IS NOT NULL
    OR public.my_result_detail(user_two,'f1111111-1111-1111-1111-111111111111') IS NOT NULL
  THEN RAISE EXCEPTION 'Cross-account result detail leak'; END IF;
  IF jsonb_array_length(public.my_result_history(user_one,'wordle',20,0))<1
    OR public.my_result_history(user_two,'wordle',20,0)::text LIKE '%wordle:number:1406%'
  THEN RAISE EXCEPTION 'User history ownership/filter broken'; END IF;
  IF public.my_result_history(user_one,NULL,20,0)::text LIKE '%raw_share_text%'
  THEN RAISE EXCEPTION 'Raw text exposed through history'; END IF;
  IF public.delete_my_result(user_two,saved)->>'status'<>'not_found'
  THEN RAISE EXCEPTION 'Cross-account deletion was allowed'; END IF;
  IF public.delete_my_result(user_one,saved)->>'status'<>'deleted'
  THEN RAISE EXCEPTION 'Owner deletion failed'; END IF;
  IF public.my_result_detail(user_one,saved) IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.raw_submissions WHERE result_id=saved)
    OR EXISTS(SELECT 1 FROM public.result_corrections WHERE result_id=saved)
  THEN RAISE EXCEPTION 'Deleted result or private raw remained'; END IF;
  IF NOT EXISTS(SELECT 1 FROM app_private.result_events
    WHERE user_id=user_one AND result_id=saved AND action='deleted')
  THEN RAISE EXCEPTION 'Delete event did not survive cascade'; END IF;

  r:=public.retain_unknown_share(user_one,'Unknown game share',NULL);
  IF r->>'status'<>'retained'
  THEN RAISE EXCEPTION 'Explicit unsupported retention failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.raw_submissions
    WHERE id=(r->>'id')::uuid AND disposition='unsupported'
      AND expires_at>received_at AND expires_at<=received_at+interval '90 days')
  THEN RAISE EXCEPTION 'Unknown sample TTL not bounded to 90 days'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.retain_unknown_share(user_one,'Unrecognized',
                                        'non-existent-catalog-game');
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unknown catalog slug accepted'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.ingest_parsed_share(user_one,'Wordle 0',jsonb_set(payload,
                                 '{gameSlug}','"globle"'::jsonb));
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unsupported parser game saved'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.ingest_parsed_share(user_one,'Wordle 0',jsonb_set(payload,
                                 '{puzzleKey}','"../../not-a-puzzle"'::jsonb));
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unsafe puzzle key accepted'; END IF;

  SELECT count(*) INTO n FROM app_private.result_events
  WHERE user_id=user_one AND result_id=saved;
  IF n<>3 THEN RAISE EXCEPTION 'Expected save/replace/delete events, got %',n; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: Phase 7 service RPCs, private grant boundaries, owner history, idempotent corrections, deletion and TTL' AS test_summary;
