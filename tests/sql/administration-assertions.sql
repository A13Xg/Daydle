-- Phase 11: privileged API security, suggestions, audit and sample TTL.
DO $$
BEGIN
  IF has_function_privilege('anon','public.daydle_requests(uuid,integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.daydle_request_action(uuid,text,uuid,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.daydle_admin_view(uuid,text,integer,integer,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.daydle_admin_action(uuid,text,jsonb)','EXECUTE')
    OR has_table_privilege('authenticated','app_private.request_restrictions','SELECT')
    OR has_table_privilege('authenticated','app_private.request_limits','INSERT')
    OR has_table_privilege('authenticated','public.game_suggestions','INSERT')
    OR has_table_privilege('authenticated','public.suggestion_votes','INSERT')
  THEN RAISE EXCEPTION 'Phase 11 exposed privileged operations'; END IF;
  IF NOT has_function_privilege('service_role','public.daydle_admin_action(uuid,text,jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.daydle_requests(uuid,integer,integer)','EXECUTE')
    OR NOT (SELECT relrowsecurity FROM pg_class
      WHERE oid='app_private.request_restrictions'::regclass)
  THEN RAISE EXCEPTION 'Missing Phase 11 service grants/RLS'; END IF;
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
DO $$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.daydle_admin_view('11111111-1111-1111-1111-111111111111','sample',20,0,NULL);
  EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Browser can impersonate a service admin'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  alice constant uuid := '11111111-1111-1111-1111-111111111111';
  bob constant uuid := '22222222-2222-2222-2222-222222222222';
  carol constant uuid := '33333333-3333-3333-3333-333333333333';
  sample_id constant uuid := '92222222-2222-2222-2222-222222222222';
  new_id uuid;
  v jsonb;
  x jsonb;
BEGIN
  IF NOT public.daydle_admin_status(alice) OR public.daydle_admin_status(bob)
  THEN RAISE EXCEPTION 'Admin lookup allowed unauthorized user'; END IF;
  BEGIN
    PERFORM public.daydle_admin_view(bob,'sample',20,0,sample_id);
    RAISE EXCEPTION 'Nonadmin viewed retained raw sample';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF public.daydle_admin_view(alice,'sample',20,0,sample_id) IS NOT NULL
  THEN RAISE EXCEPTION 'Expired raw sample is still viewable'; END IF;

  v:=public.daydle_requests(NULL,20,0);
  IF jsonb_array_length(v)<>1
    OR v->0->>'name'<>'Puzzle Example'
    OR v->0->>'voted_by_me'<>'false'
    OR v->0->>'suggested_by_me'<>'false'
    OR v::text LIKE '%one@example.invalid%'
  THEN RAISE EXCEPTION 'Public suggestions leaked private values: %',v; END IF;

  v:=public.daydle_request_action(bob,'create',NULL,'New Puzzle','https://puzzle.example/new','Description');
  IF v->>'status'<>'created' THEN RAISE EXCEPTION 'Request submission failed: %',v; END IF;
  new_id:=(v->>'id')::uuid;
  v:=public.daydle_request_action(bob,'create',NULL,'Another','https://puzzle.example/new','');
  IF v->>'status'<>'duplicate' OR (v->>'id')::uuid<>new_id
  THEN RAISE EXCEPTION 'Duplicate URL was stored twice'; END IF;
  v:=public.daydle_request_action(carol,'vote',new_id);
  IF v->>'status'<>'voted' THEN RAISE EXCEPTION 'First vote failed: %',v; END IF;
  v:=public.daydle_request_action(carol,'vote',new_id);
  IF v->>'status'<>'voted' OR
     (SELECT count(*) FROM public.suggestion_votes
      WHERE suggestion_id=new_id AND user_id=carol)<>1
  THEN RAISE EXCEPTION 'Vote was not idempotent: %',v; END IF;
  v:=public.daydle_request_action(carol,'unvote',new_id);
  IF v->>'status'<>'unvoted'
    OR EXISTS(SELECT 1 FROM public.suggestion_votes WHERE suggestion_id=new_id AND user_id=carol)
  THEN RAISE EXCEPTION 'Unvote failed: %',v; END IF;

  v:=public.daydle_admin_action(alice,'moderate',
    jsonb_build_object('id',new_id,'status','rejected'));
  IF v->>'status'<>'saved'
    OR (SELECT status FROM public.game_suggestions WHERE id=new_id)<>'rejected'
    OR public.daydle_request_action(carol,'vote',new_id)->>'status'<>'not_found'
    OR public.daydle_requests(NULL,20,0)::text LIKE '%New Puzzle%'
  THEN RAISE EXCEPTION 'Rejected suggestion still public/votable'; END IF;

  v:=public.daydle_admin_action(alice,'restrict',
    jsonb_build_object('userId',bob,'reason','fixture abuse test'));
  IF v->>'status'<>'saved'
    OR public.daydle_request_action(bob,'vote',
      '41414141-4141-4141-4141-414141414141')->>'status'<>'restricted'
  THEN RAISE EXCEPTION 'Suggestion restriction bypass'; END IF;
  v:=public.daydle_admin_action(alice,'unrestrict',jsonb_build_object('userId',bob));
  IF v->>'status'<>'saved' THEN RAISE EXCEPTION 'Restriction removal failed'; END IF;

  v:=public.daydle_admin_action(alice,'save_game',
    jsonb_build_object('slug','phase11-demo','name','Phase 11 Demo',
    'url','https://games.example/puzzle','status','active','categories','word, numbers'));
  IF v->>'status'<>'saved' THEN RAISE EXCEPTION 'Admin catalog insert failed: %',v; END IF;
  new_id:=(v->>'id')::uuid;
  IF (SELECT count(*) FROM public.game_category_links WHERE game_id=new_id)<>2
  THEN RAISE EXCEPTION 'Catalog categories not saved atomically'; END IF;
  UPDATE public.games SET link_status='verified',link_checked_at=now() WHERE id=new_id;
  v:=public.daydle_admin_action(alice,'save_game',
    jsonb_build_object('id',new_id,'slug','phase11-demo','name','Phase 11 Demo',
      'url','https://games.example/changed','status','active','categories','word, numbers'));
  IF v->>'status'<>'saved' OR
      (SELECT link_status FROM public.games WHERE id=new_id)<>'unverified' OR
      (SELECT link_checked_at FROM public.games WHERE id=new_id) IS NOT NULL
  THEN RAISE EXCEPTION 'Catalog URL change inherited stale verified link'; END IF;
  v:=public.daydle_admin_action(alice,'retire_game',jsonb_build_object('id',new_id));
  IF v->>'status'<>'saved'
    OR (SELECT status FROM public.games WHERE id=new_id)<>'retired'
  THEN RAISE EXCEPTION 'Catalog retirement failed'; END IF;

  INSERT INTO public.raw_submissions(id,user_id,raw_share_text,disposition,parser_diagnostics)
  VALUES('93333333-3333-3333-3333-333333333333',bob,'Unrecognized private share','unsupported',
    '{"reason_code":"unknown_header","review_status":"pending"}');
  v:=public.daydle_admin_view(alice,'samples',20,0,NULL);
  IF v::text LIKE '%Unrecognized private share%' THEN
    RAISE EXCEPTION 'Raw share leaked through sample list'; END IF;
  v:=public.daydle_admin_view(alice,'sample',20,0,
    '93333333-3333-3333-3333-333333333333');
  IF v->>'raw_text'<>'Unrecognized private share' THEN
    RAISE EXCEPTION 'Explicit admin sample detail unavailable'; END IF;
  v:=public.daydle_admin_action(alice,'review_sample',
    '{"id":"93333333-3333-3333-3333-333333333333","status":"classified","gameSlug":"wordle"}');
  IF v->>'status'<>'saved' THEN RAISE EXCEPTION 'Sample classification failed'; END IF;
  IF (SELECT parser_diagnostics->>'review_status' FROM public.raw_submissions
    WHERE id='93333333-3333-3333-3333-333333333333')<>'classified'
  THEN RAISE EXCEPTION 'Sample review state missing'; END IF;
  v:=public.daydle_admin_view(alice,'diagnostics',20,0,NULL);
  IF jsonb_array_length(v)=0 OR (v->0 ? 'day') IS NOT TRUE
    OR (v->0 ? 'parser_version') IS NOT TRUE
  THEN RAISE EXCEPTION 'Parser trends lack date or version'; END IF;
  IF v::text LIKE '%Unrecognized private share%' THEN
    RAISE EXCEPTION 'Raw text leaked into diagnostics'; END IF;
  IF (SELECT count(*) FROM app_private.admin_events
      WHERE actor_id=alice AND action IN ('suggestion_moderated','requests_restrict',
        'requests_unrestrict','catalog_saved','catalog_retired','sample_reviewed'))<>7
  THEN RAISE EXCEPTION 'Admin mutation audit trail incomplete'; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: Phase 11 suggestions, admin, audit, raw privacy and restrictions' AS test_summary;
