-- Phase 4 catalog and selection authorization tests (isolated PG17 only).
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.games WHERE id::text LIKE '40000000-%';
 IF n <> 12 THEN RAISE EXCEPTION 'Expected 12 curated games, got %',n; END IF;
 SELECT count(*) INTO n FROM public.game_categories;
 IF n <> 6 THEN RAISE EXCEPTION 'Expected six curated categories, got %',n; END IF;
 SELECT count(*) INTO n FROM public.games
 WHERE id::text LIKE '40000000-%' AND parser_status='unsupported' AND link_status='unverified';
 IF n <> 12 THEN RAISE EXCEPTION 'Seed falsely claims parser or live link support'; END IF;
 IF has_table_privilege('authenticated','public.games','UPDATE')
   OR has_table_privilege('authenticated','public.user_games','INSERT')
   OR has_table_privilege('authenticated','public.user_games','DELETE')
   OR has_any_column_privilege('authenticated','public.user_games','UPDATE')
   OR has_function_privilege('anon','public.set_my_games(uuid[])','EXECUTE')
   OR has_function_privilege('anon','public.admin_retire_game(uuid)','EXECUTE')
   OR has_function_privilege('anon','public.admin_save_game(uuid,text,text,text,text,text,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Catalog/selection privileges were exposed'; END IF;
 IF app_private.safe_publisher_url('https://user:password@example.com/')
   OR app_private.safe_publisher_url('http://example.com')
   OR app_private.safe_publisher_url('javascript:alert(1)')
   OR app_private.safe_publisher_url('https://127.0.0.1/')
   OR app_private.safe_publisher_url('https://example.com@evil.com/')
   OR NOT app_private.safe_publisher_url('https://www.nytimes.com/games/connections')
 THEN RAISE EXCEPTION 'URL validation contract broken'; END IF;
END $$;

-- Nonadmins cannot mutate the catalog even with the authenticated RPC grant.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
DO $$
DECLARE denied boolean := false;
BEGIN
 BEGIN
   PERFORM public.admin_retire_game('40000000-0000-4000-8000-000000000010');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Nonadmin catalog mutation was allowed'; END IF;
END $$;
COMMIT;

-- Admin membership lives in the private schema and requires an authenticated
-- user to pass a separate explicit DB authorization check.
INSERT INTO app_private.admin_members(user_id)
VALUES ('11111111-1111-1111-1111-111111111111');

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$
DECLARE saved_id uuid;
DECLARE attempted boolean := false;
BEGIN
 saved_id:=public.admin_save_game(NULL,'sample-admin','Sample Admin','https://example.org/game',
                  'Sample','Publisher','daily','active','verified');
 IF NOT EXISTS(SELECT 1 FROM public.games WHERE id=saved_id AND slug='sample-admin'
     AND link_status='verified' AND link_checked_at IS NOT NULL
     AND parser_status='unsupported') THEN
     RAISE EXCEPTION 'Admin creation failed'; END IF;
 IF public.admin_save_game(saved_id,'sample-admin','Updated Name','https://example.org/new',
                  'Sample','Publisher','daily','active','unverified') <> saved_id THEN
     RAISE EXCEPTION 'Admin updated canonical ID'; END IF;
 PERFORM public.admin_set_game_categories(saved_id,ARRAY['word','numbers']);
 IF (SELECT count(*) FROM public.game_category_links WHERE game_id=saved_id)<>2 THEN
   RAISE EXCEPTION 'Admin categories not saved'; END IF;
 PERFORM public.admin_retire_game(saved_id);
 IF (SELECT status FROM public.games WHERE id=saved_id)<>'retired' THEN
   RAISE EXCEPTION 'Admin retire failed'; END IF;
 BEGIN
   PERFORM public.admin_save_game(saved_id,'new-slug','Broken','https://example.org/',
                 'Sample','Publisher','daily','active','unverified');
 EXCEPTION WHEN invalid_parameter_value THEN attempted:=true;
 END;
 IF NOT attempted THEN RAISE EXCEPTION 'Admin renamed a stable slug'; END IF;
 attempted:=false;
 BEGIN
   PERFORM public.admin_save_game(NULL,'unsafe-url','Broken','https://evil.com@different.example/path',
                 'Sample','Publisher','daily','active','unverified');
 EXCEPTION WHEN invalid_parameter_value THEN attempted:=true;
 END;
 IF NOT attempted THEN RAISE EXCEPTION 'Admin accepted credential-in-URL'; END IF;
END $$;
ROLLBACK;

-- Signed-in owner may only change their own selections via a single atomic RPC.
-- Order reflects array order and is persisted as sort_order.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
DO $$
DECLARE n integer;
DECLARE rejected boolean := false;
BEGIN
 SELECT count(*) INTO n FROM public.set_my_games(ARRAY[
  '40000000-0000-4000-8000-000000000001'::uuid,
  '40000000-0000-4000-8000-000000000007'::uuid
 ]);
 IF n<>2 THEN RAISE EXCEPTION 'Selection failed'; END IF;
 IF (SELECT sort_order FROM public.user_games WHERE
      user_id='22222222-2222-2222-2222-222222222222' AND
      game_id='40000000-0000-4000-8000-000000000007')<>1 THEN
   RAISE EXCEPTION 'Selection order failed'; END IF;

 SELECT count(*) INTO n FROM public.set_my_games(ARRAY[
  '40000000-0000-4000-8000-000000000007'::uuid,
  '40000000-0000-4000-8000-000000000001'::uuid
 ]);
 IF (SELECT sort_order FROM public.user_games WHERE
      user_id='22222222-2222-2222-2222-222222222222' AND
      game_id='40000000-0000-4000-8000-000000000007')<>0 THEN
   RAISE EXCEPTION 'Reorder failed'; END IF;

 BEGIN
   PERFORM public.set_my_games(ARRAY[
     '40000000-0000-4000-8000-000000000007'::uuid,
     '40000000-0000-4000-8000-000000000007'::uuid
   ]);
 EXCEPTION WHEN invalid_parameter_value THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Duplicate selection accepted'; END IF;

 rejected:=false;
 BEGIN
   PERFORM public.set_my_games(ARRAY['deadbeef-dead-4ee1-8eed-abcdefabcdef'::uuid]);
 EXCEPTION WHEN invalid_parameter_value THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unknown game selected'; END IF;
 IF (SELECT count(*) FROM public.user_games
     WHERE user_id='22222222-2222-2222-2222-222222222222')<>2 THEN
   RAISE EXCEPTION 'Invalid request partly mutated selection'; END IF;

 rejected:=false;
 BEGIN
   INSERT INTO public.user_games(user_id,game_id) VALUES
    ('11111111-1111-1111-1111-111111111111','40000000-0000-4000-8000-000000000010');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Direct cross-account INSERT allowed'; END IF;

 rejected:=false;
 BEGIN
   UPDATE public.user_games SET sort_order=987
   WHERE user_id='22222222-2222-2222-2222-222222222222';
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Direct column-level favorites UPDATE allowed'; END IF;

 SELECT count(*) INTO n FROM public.set_my_games(ARRAY[]::uuid[]);
 IF n<>0 OR EXISTS(SELECT 1 FROM public.user_games WHERE
    user_id='22222222-2222-2222-2222-222222222222')
 THEN RAISE EXCEPTION 'Removal failed'; END IF;
END $$;
ROLLBACK;

-- Existing favorites may preserve a later-retired game; new owners cannot add it.
-- Modify catalog under migration owner only for this test, then roll it back.
BEGIN;
UPDATE public.games SET status='retired'
WHERE id='40000000-0000-4000-8000-000000000011';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
DO $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.set_my_games(ARRAY['40000000-0000-4000-8000-000000000011'::uuid]);
 EXCEPTION WHEN invalid_parameter_value THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Retired game newly selected'; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: 12 seeded games, URL safety, catalog admin and atomic selection' AS test_summary;
