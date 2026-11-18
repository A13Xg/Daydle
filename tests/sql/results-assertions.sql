-- Phase 7: isolated PG17 authoritative result persistence + owner-only RPC tests.
-- All changes in these tests are rolled back; never execute against hosted data.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.games WHERE parser_status='supported';
  IF n <> 7 THEN RAISE EXCEPTION 'Expected seven real parser-backed games after Phase 15, got %',n; END IF;
  IF EXISTS (SELECT 1 FROM public.games WHERE parser_status='supported'
             AND slug NOT IN ('wordle','connections','strands','mini-crossword','quordle','worldle','flagle'))
  THEN RAISE EXCEPTION 'Unsupported catalog entry marked parseable'; END IF;

  IF has_function_privilege('anon','public.ingest_parsed_share(uuid,text,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.ingest_parsed_share(uuid,text,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.capture_unparsed_share(uuid,text,text,text,text[],text)','EXECUTE')
    OR has_function_privilege('authenticated','public.capture_unparsed_share(uuid,text,text,text,text[],text)','EXECUTE')
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
  blocked:=false;
  BEGIN
    PERFORM public.capture_unparsed_share(
      '11111111-1111-1111-1111-111111111111','hidden','unsupported','unknown_header');
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Browser could store raw submissions directly'; END IF;
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

  r:=public.capture_unparsed_share(user_one,'Unknown Daily Game #17',
    'unsupported','unknown_header');
  IF r->>'status'<>'captured' OR r->>'classification'<>'unknown_header'
  THEN RAISE EXCEPTION 'Unknown submit was not categorized: %',r; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.raw_submissions
    WHERE disposition='unsupported' AND result_id IS NULL
      AND raw_share_text='Unknown Daily Game #17'
      AND parser_diagnostics->>'review_status'='pending'
      AND parser_diagnostics->>'reason_code'='unknown_header'
      AND parser_diagnostics->>'source'='explicit_submit'
      AND expires_at>received_at AND expires_at<=received_at+interval '90 days')
  THEN RAISE EXCEPTION 'Unknown capture diagnostics/TTL incorrect'; END IF;
  r:=public.capture_unparsed_share(user_one,'Unknown Daily Game #17',
    'unsupported','unknown_header');
  IF r->>'status'<>'already_captured'
    OR (SELECT count(*) FROM public.raw_submissions
        WHERE user_id=user_one AND raw_share_text='Unknown Daily Game #17')<>1
  THEN RAISE EXCEPTION 'Repeated unknown text was not idempotent: %',r; END IF;

  r:=public.capture_unparsed_share(user_one,'Wordle #987 missing score lines',
    'invalid','invalid_format',ARRAY[]::text[],'wordle');
  IF r->>'status'<>'captured'
  THEN RAISE EXCEPTION 'Recognized malformed share not retained: %',r; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.raw_submissions
    WHERE user_id=user_one AND disposition='invalid'
      AND parser_diagnostics->>'reason_code'='invalid_format'
      AND game_id=(SELECT id FROM public.games WHERE slug='wordle')
      AND raw_share_text='Wordle #987 missing score lines')
  THEN RAISE EXCEPTION 'Malformed share category/game hint missing'; END IF;

  r:=public.capture_unparsed_share(user_one,'Overlapping share header',
    'unsupported','ambiguous_match',ARRAY['wordle','quordle']);
  IF r->>'status'<>'captured'
  THEN RAISE EXCEPTION 'Ambiguous input not retained: %',r; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.raw_submissions
    WHERE raw_share_text='Overlapping share header'
      AND parser_diagnostics->'candidate_game_slugs'='["wordle","quordle"]'::jsonb)
  THEN RAISE EXCEPTION 'Ambiguous parser candidates missing'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.capture_unparsed_share(user_one,'Malformed',
      'unsupported','bad_client_supplied_reason');
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unrecognized diagnostic reason accepted'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.capture_unparsed_share(user_one,'Malformed',
      'unsupported','ambiguous_match',ARRAY['invalid/../../slug']);
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unsafe parser candidate accepted'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.capture_unparsed_share(user_one,'Malformed',
      'unsupported','unknown_header',ARRAY[]::text[],'unknown-game');
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unknown catalog hint accepted'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.capture_unparsed_share(user_one,'',
      'invalid','invalid_format');
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Empty raw capture accepted'; END IF;
  IF (SELECT count(*) FROM public.raw_submissions
      WHERE user_id=user_two AND result_id IS NULL)<>0
  THEN RAISE EXCEPTION 'Captured sample assigned to wrong owner'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.ingest_parsed_share(user_one,'Wordle 0',jsonb_set(payload,
                                 '{gameSlug}','"globle"'::jsonb));
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
  END;
  r:=public.capture_unparsed_share(user_two,'Unknown Daily Game #17',
    'unsupported','unknown_header');
  IF r->>'status'<>'captured'
    OR (SELECT count(*) FROM public.raw_submissions
        WHERE raw_share_text='Unknown Daily Game #17' AND result_id IS NULL)<>2
  THEN RAISE EXCEPTION 'Same raw share was deduplicated across distinct owners'; END IF;
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

SELECT 'PASS: Phase 7 service RPCs, private grant boundaries, owner history, idempotent corrections, categorized raw failure captures, deletion and TTL' AS test_summary;
