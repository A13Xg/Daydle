-- Phase 9: private social RPC authorization, mutual edges, block and quota.
DO $$
BEGIN
  IF has_function_privilege('anon','public.social_public_profile(uuid)','EXECUTE')
  OR has_function_privilege('authenticated','public.social_public_profile(uuid)','EXECUTE')
  OR has_function_privilege('anon','public.social_my_network(uuid)','EXECUTE')
  OR has_function_privilege('authenticated','public.social_my_network(uuid)','EXECUTE')
  OR has_function_privilege('anon','public.social_connect_by_code(uuid,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.social_connect_by_code(uuid,text)','EXECUTE')
  OR has_function_privilege('anon','public.social_change_relation(uuid,uuid,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.social_change_relation(uuid,uuid,text)','EXECUTE')
  OR has_function_privilege('anon','public.social_regenerate_code(uuid)','EXECUTE')
  OR has_function_privilege('authenticated','public.social_regenerate_code(uuid)','EXECUTE')
  OR has_function_privilege('authenticated','app_private.consume_social_quota(uuid)','EXECUTE')
  OR has_table_privilege('authenticated','app_private.social_rate_limits','SELECT')
  OR has_table_privilege('authenticated','public.friend_codes','UPDATE')
  OR has_table_privilege('authenticated','public.friendships','INSERT')
  OR has_table_privilege('authenticated','public.blocks','INSERT')
  THEN RAISE EXCEPTION 'Phase 9 privileged social grants leaked to client'; END IF;
  IF NOT has_function_privilege('service_role','public.social_connect_by_code(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.social_public_profile(uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.social_regenerate_code(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Phase 9 service-role grants missing'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='app_private.social_rate_limits'::regclass)
  THEN RAISE EXCEPTION 'Social quota table has no RLS'; END IF;
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$
DECLARE prevented boolean:=false;
BEGIN
  BEGIN
    PERFORM public.social_connect_by_code(
      '22222222-2222-2222-2222-222222222222','AAAAA');
  EXCEPTION WHEN insufficient_privilege THEN prevented:=true;
  END;
  IF NOT prevented THEN RAISE EXCEPTION 'Browser can forge a social connection'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  alice constant uuid:='11111111-1111-1111-1111-111111111111';
  bob constant uuid:='22222222-2222-2222-2222-222222222222';
  carol constant uuid:='33333333-3333-3333-3333-333333333333';
  bob_code text;
  alice_code text;
  old_code text;
  new_code text;
  v jsonb;
  network jsonb;
  i integer;
BEGIN
  v:=public.social_public_profile(alice);
  IF v->>'display_name'<>'One'
    OR v->'games' IS NULL
    OR v ? 'email' OR v ? 'code' OR v ? 'score' OR v ? 'results'
    OR v::text LIKE '%one@example.invalid%'
    OR v::text LIKE '%Wordle 100%'
  THEN RAISE EXCEPTION 'Public profile privacy contract failed: %',v; END IF;
  IF public.social_public_profile('88888888-8888-8888-8888-888888888888') IS NOT NULL
  THEN RAISE EXCEPTION 'Missing profile should be absent'; END IF;

  network:=public.social_my_network(alice);
  IF jsonb_array_length(network->'friends')<>1
    OR network->>'code' IS NULL OR network ? 'email'
  THEN RAISE EXCEPTION 'Owner friend list/privileges incorrect'; END IF;
  SELECT code INTO bob_code FROM public.friend_codes WHERE user_id=bob;
  SELECT code INTO alice_code FROM public.friend_codes WHERE user_id=alice;
  v:=public.social_connect_by_code(alice,bob_code);
  IF v->>'status'<>'already_connected'
  THEN RAISE EXCEPTION 'Existing friend connection should be idempotent: %',v; END IF;
  IF public.social_connect_by_code(alice,alice_code)->>'status'<>'self'
  THEN RAISE EXCEPTION 'Self friendship was allowed'; END IF;
  IF public.social_connect_by_code(alice,'OOOOO')->>'status'<>'invalid_code'
  THEN RAISE EXCEPTION 'Ambiguous friend code accepted'; END IF;

  IF public.social_change_relation(alice,bob,'unfriend')->>'status'<>'unfriended'
  THEN RAISE EXCEPTION 'Unfriend not applied'; END IF;
  IF public.social_change_relation(alice,bob,'unfriend')->>'status'<>'already_unfriended'
  THEN RAISE EXCEPTION 'Unfriend replay not idempotent'; END IF;
  IF public.social_connect_by_code(bob,alice_code)->>'status'<>'connected'
  THEN RAISE EXCEPTION 'Immediate connection failed'; END IF;
  IF (SELECT count(*) FROM public.friendships WHERE user_low=alice AND user_high=bob)<>1
    OR (SELECT jsonb_array_length(public.social_my_network(bob)->'friends'))<>1
  THEN RAISE EXCEPTION 'Mutual friend edge missing or duplicated'; END IF;

  IF public.social_change_relation(alice,bob,'block')->>'status'<>'blocked'
  THEN RAISE EXCEPTION 'Block action failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.friendships WHERE user_low=alice AND user_high=bob)
  THEN RAISE EXCEPTION 'Block failed to remove mutual friendship'; END IF;
  IF public.social_connect_by_code(alice,bob_code)->>'status'<>'unavailable'
    OR public.social_connect_by_code(bob,alice_code)->>'status'<>'unavailable'
  THEN RAISE EXCEPTION 'Blocked pair could reconnect'; END IF;
  IF public.social_change_relation(alice,bob,'unblock')->>'status'<>'unblocked'
  THEN RAISE EXCEPTION 'Unblock failed'; END IF;
  IF public.social_connect_by_code(alice,bob_code)->>'status'<>'connected'
  THEN RAISE EXCEPTION 'Reconnect after unblock failed'; END IF;
  IF public.social_change_relation(alice,alice,'block')->>'status'<>'not_found'
  THEN RAISE EXCEPTION 'Self block was allowed'; END IF;
  IF public.social_change_relation(alice,bob,'invalid')->>'status'<>'invalid_action'
  THEN RAISE EXCEPTION 'Invalid mutation accepted'; END IF;

  old_code:=alice_code;
  v:=public.social_regenerate_code(alice);
  new_code:=v->>'code';
  IF v->>'status'<>'regenerated' OR new_code=old_code OR
    new_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$'
  THEN RAISE EXCEPTION 'Friend code regeneration invalid: %',v; END IF;
  IF EXISTS (SELECT 1 FROM public.friend_codes WHERE user_id=alice AND code=old_code)
  OR (SELECT count(*) FROM public.friendships WHERE user_low=alice AND user_high=bob)<>1
  THEN RAISE EXCEPTION 'Old code not revoked or friends were lost'; END IF;

  -- User 3 has no prior attempt budget consumption; 15 attempts may return
  -- not_found and the 16th must fail, even with a syntactically valid code.
  FOR i IN 1..15 LOOP
    v:=public.social_connect_by_code(carol,'AAAAA');
    IF v->>'status'<>'not_found'
    THEN RAISE EXCEPTION 'Unexpected quota attempt % response %',i,v; END IF;
  END LOOP;
  IF public.social_connect_by_code(carol,'AAAAA')->>'status'<>'rate_limited'
  THEN RAISE EXCEPTION 'Friend code enumeration limit not enforced'; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: Phase 9 public profile allowlist, symmetric friendship, idempotency, block and rate limits' AS test_summary;
