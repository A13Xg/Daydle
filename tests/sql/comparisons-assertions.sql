-- Phase 10: isolated PostgreSQL viewer/puzzle masking, ranking and RLS gates.
DO $$
BEGIN
 IF has_function_privilege('anon','public.comparison_board(uuid,text,text,text,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated','public.comparison_board(uuid,text,text,text,integer,integer)','EXECUTE')
 OR has_function_privilege('anon','public.comparison_public_result(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.comparison_public_result(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.comparison_profile_summary(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.comparison_profile_summary(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.comparison_head_to_head(uuid,uuid,uuid,text,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated','public.comparison_head_to_head(uuid,uuid,uuid,text,integer,integer)','EXECUTE')
 OR has_function_privilege('anon','app_private.comparison_can_view(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','app_private.comparison_can_view(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','app_private.comparison_metric(text,text,integer,bigint,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Browser gained privileged viewer-spoiler RPC'; END IF;
 IF NOT has_function_privilege('service_role','public.comparison_board(uuid,text,text,text,integer,integer)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.comparison_public_result(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Worker comparison grants missing'; END IF;
END $$;

-- Direct RLS visibility is unchanged for strangers and anonymous viewers.
BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.game_results r
      WHERE r.puzzle_id='cccccccc-cccc-cccc-cccc-cccccccccccc')<>0
 THEN RAISE EXCEPTION 'Anonymous can read unreleased current puzzle'; END IF;
 IF (SELECT count(*) FROM public.game_results r
      WHERE r.puzzle_id='dddddddd-dddd-dddd-dddd-dddddddddddd')<>1
 THEN RAISE EXCEPTION 'Anonymous cannot read verified older puzzle'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
DO $$
DECLARE denied boolean:=false;
BEGIN
 IF EXISTS (SELECT 1 FROM public.game_results r
   WHERE r.puzzle_id='cccccccc-cccc-cccc-cccc-cccccccccccc')
 THEN RAISE EXCEPTION 'Stranger can read locked result via RLS'; END IF;
 BEGIN
  PERFORM public.comparison_board(
    '33333333-3333-3333-3333-333333333333',
    'wordle','wordle-100','global',20,0);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Browser could forge an authenticated viewer'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
 alice constant uuid:='11111111-1111-1111-1111-111111111111';
 bob constant uuid:='22222222-2222-2222-2222-222222222222';
 carol constant uuid:='33333333-3333-3333-3333-333333333333';
 current_puzzle constant uuid:='cccccccc-cccc-cccc-cccc-cccccccccccc';
 other_puzzle constant uuid:='ccccccc2-cccc-4ccc-8ccc-cccccccccccc';
 sample jsonb;
 list jsonb;
 i integer;
 profile jsonb;
 history jsonb;
BEGIN
 IF app_private.comparison_can_view(NULL,current_puzzle)
 OR app_private.comparison_can_view(carol,current_puzzle)
 THEN RAISE EXCEPTION 'Unreleased puzzle unlocked with no matching viewer result'; END IF;

 sample:=public.comparison_board(NULL,'wordle','wordle-100','global',20,0);
 IF sample->>'status'<>'locked' OR sample ? 'items' OR sample ? 'totalVisible'
 OR sample ? 'rankedCount'
 THEN RAISE EXCEPTION 'Locked board exposed participation or score: %',sample; END IF;
 IF public.comparison_public_result(NULL,
     'f1111111-1111-1111-1111-111111111111') IS NOT NULL
 THEN RAISE EXCEPTION 'Anonymous direct result leakage'; END IF;
 sample:=public.comparison_board(NULL,'wordle','wordle-99','global',20,0);
 IF sample->>'status'<>'ready' OR (sample->>'totalVisible')::integer<>1
 THEN RAISE EXCEPTION 'Verified historical reset did not unlock: %',sample; END IF;

 profile:=public.comparison_profile_summary(NULL,alice);
 IF profile->>'status'<>'ready' OR (profile->>'visibleResults')::integer<>1
 OR profile ? 'email' OR profile ? 'raw_share_text'
 THEN RAISE EXCEPTION 'Anonymous profile aggregate leaked current performance: %',profile; END IF;
 IF public.comparison_puzzles('wordle')->>'status'<>'ready'
 OR public.comparison_puzzles('fakegame')->>'status'<>'not_found'
 THEN RAISE EXCEPTION 'Public puzzle metadata contract failed'; END IF;

 INSERT INTO public.puzzles(id,game_id,puzzle_key,puzzle_date)
 VALUES (other_puzzle,'40000000-0000-4000-8000-000000000001','wordle:another',current_date);
 INSERT INTO public.game_results(user_id,game_id,puzzle_id,outcome,attempts,parser_version)
 VALUES
   (carol,'40000000-0000-4000-8000-000000000001',current_puzzle,'win',4,'test'),
   (carol,'40000000-0000-4000-8000-000000000001',other_puzzle,'win',2,'test');

 IF NOT app_private.comparison_can_view(bob,current_puzzle)
 OR app_private.comparison_can_view(bob,other_puzzle)
 THEN RAISE EXCEPTION 'Viewer unlocked wrong puzzle or failed own saved result'; END IF;

 sample:=public.comparison_board(bob,'wordle','wordle-100','global',20,0);
 IF sample->>'status'<>'ready' OR (sample->>'totalVisible')::integer<>3
 OR (sample->>'rankedCount')::integer<>3
 OR jsonb_array_length(sample->'items')<>3
 THEN RAISE EXCEPTION 'Unlocked same-puzzle board missing complete results: %',sample; END IF;
 IF (sample->'items'->0->>'rank')::integer<>1
 OR (sample->'items'->1->>'rank')::integer<>1
 OR (sample->'items'->2->>'rank')::integer<>3
 THEN RAISE EXCEPTION 'Tied competition ranking not 1,1,3: %',sample->'items'; END IF;
 IF (sample->'items'->0->>'metricValue')::numeric<>4
 OR sample::text LIKE '%raw_share_text%' OR sample::text LIKE '%@example.invalid%'
 THEN RAISE EXCEPTION 'Visible ranking leaked raw data or wrong metric'; END IF;
 sample:=public.comparison_board(bob,'wordle','wordle-100','global',1,1);
 IF sample->>'status'<>'ready' OR (sample->>'totalVisible')::integer<>3
 OR jsonb_array_length(sample->'items')<>1
 THEN RAISE EXCEPTION 'Pagination computed before allowed visibility: %',sample; END IF;
 sample:=public.comparison_board(bob,'wordle','wordle-100','friends',20,0);
 IF (sample->>'totalVisible')::integer<>2
 THEN RAISE EXCEPTION 'Friend scope incorrect or leaked blocked unrelated player: %',sample; END IF;
 sample:=public.comparison_board(bob,'wordle','wordle:another','global',20,0);
 IF sample->>'status'<>'locked' OR sample ? 'totalVisible'
 THEN RAISE EXCEPTION 'Different same-game puzzle unlocked: %',sample; END IF;
 sample:=public.comparison_board(NULL,'wordle','wordle-100','friends',20,0);
 IF sample->>'status'<>'invalid_request'
 THEN RAISE EXCEPTION 'Anonymous friend scope accepted'; END IF;
 sample:=public.comparison_public_result(bob,
     'f1111111-1111-1111-1111-111111111111');
 IF sample->>'displayName'<>'One' OR sample->>'metricValue'<>'4'
 OR sample ? 'email' OR sample ? 'metrics'
 THEN RAISE EXCEPTION 'Direct visible result API returned unsafe data: %',sample; END IF;
 profile:=public.comparison_profile_summary(bob,alice);
 IF (profile->>'visibleResults')::integer<>2
 THEN RAISE EXCEPTION 'Same-puzzle submission should unlock profile history: %',profile; END IF;
 history:=public.comparison_head_to_head(NULL,alice,bob,'wordle',20,0);
 IF (history->>'totalVisible')::integer<>0
 THEN RAISE EXCEPTION 'Anonymous head-to-head revealed unreleased result'; END IF;
 history:=public.comparison_head_to_head(bob,alice,bob,'wordle',20,0);
 IF (history->>'totalVisible')::integer<>1
 OR jsonb_array_length(history->'items')<>1
 OR history ? 'raw_share_text'
 THEN RAISE EXCEPTION 'Head-to-head same-puzzle unlock failed: %',history; END IF;

 UPDATE public.game_results SET attempts=3 WHERE user_id=bob AND puzzle_id=current_puzzle;
 sample:=public.comparison_board(bob,'wordle','wordle-100','global',20,0);
 IF (sample->'items'->0->>'userId')::uuid<>bob
 OR (sample->'items'->0->>'rank')::integer<>1
 OR (sample->'items'->1->>'rank')::integer<>2
 THEN RAISE EXCEPTION 'Replacement failed to re-rank from authoritative DB'; END IF;

 DELETE FROM public.game_results WHERE user_id=bob AND puzzle_id=current_puzzle;
 sample:=public.comparison_board(bob,'wordle','wordle-100','global',20,0);
 IF sample->>'status'<>'locked' OR sample ? 'items'
 THEN RAISE EXCEPTION 'Delete failed to revoke own unlock'; END IF;
 IF public.comparison_public_result(bob,
     'f1111111-1111-1111-1111-111111111111') IS NOT NULL
 THEN RAISE EXCEPTION 'Direct result still visible after viewer deletion'; END IF;

 IF app_private.comparison_metric('wordle','win',4,NULL,'{}'::jsonb)<>4
 OR app_private.comparison_metric('wordle','loss',6,NULL,'{}'::jsonb) IS NOT NULL
 OR app_private.comparison_metric('connections','win',NULL,NULL,'{"mistakes":2}'::jsonb)<>2
 OR app_private.comparison_metric('strands','complete',NULL,NULL,'{"hints":1}'::jsonb)<>1
 OR app_private.comparison_metric('mini-crossword','complete',NULL,69000,'{}'::jsonb)<>69000
 OR app_private.comparison_metric('quordle','win',NULL,NULL,
    '{"boardAttempts":[1,2,3,4]}'::jsonb)<>10
 OR app_private.comparison_metric('quordle','win',NULL,NULL,
    '{"boardAttempts":[1,null,3,4]}'::jsonb) IS NOT NULL
 THEN RAISE EXCEPTION 'Incompatible per-game metric mapping'; END IF;
END $$;
ROLLBACK;

-- The baseline fixture assertions already persist Bob's own current result.
-- Direct browser RLS uses the unified same-puzzle filter for that result.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.game_results WHERE puzzle_id='cccccccc-cccc-cccc-cccc-cccccccccccc')<>2
 THEN RAISE EXCEPTION 'Direct RLS did not unlock own matching puzzle'; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: Phase 10 unified viewer policy, game metrics, public/private aggregates, tie ranks, correction/deletion and RLS' AS test_summary;
