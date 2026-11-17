-- Phase 12: owner privacy export, raw retention and delete audit semantics.
DO $$
BEGIN
  IF has_function_privilege('anon','public.privacy_export_page(uuid,text,uuid,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.privacy_export_page(uuid,text,uuid,integer)','EXECUTE')
     OR has_function_privilege('anon','public.privacy_purge_expired_raw()','EXECUTE')
     OR has_function_privilege('authenticated','public.privacy_purge_expired_raw()','EXECUTE')
  THEN RAISE EXCEPTION 'Phase 12 privileged privacy operations leaked to browser roles'; END IF;
  IF NOT has_function_privilege('service_role','public.privacy_export_page(uuid,text,uuid,integer)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.privacy_purge_expired_raw()','EXECUTE')
  THEN RAISE EXCEPTION 'Missing Phase 12 service RPC permissions'; END IF;
END $$;

BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE p constant uuid:='11111111-1111-1111-1111-111111111111';
DECLARE q constant uuid:='22222222-2222-2222-2222-222222222222';
DECLARE page jsonb; cnt integer; purge jsonb;
BEGIN
  page:=public.privacy_export_page(p,'profile',NULL,5);
  IF jsonb_array_length(page)<>1 OR page->0->>'id'<>p::text
    OR COALESCE(page->0->>'friend_code','')=''
    OR page::text LIKE '%one@example.invalid%'
  THEN RAISE EXCEPTION 'Owner profile export wrong or leaked auth email'; END IF;
  page:=public.privacy_export_page(p,'results',NULL,1);
  IF jsonb_array_length(page)<>1 THEN RAISE EXCEPTION 'First results page size wrong'; END IF;
  page:=public.privacy_export_page(p,'results',(page->0->>'id')::uuid,10);
  IF jsonb_array_length(page)<>1 THEN RAISE EXCEPTION 'Second results page missing'; END IF;
  page:=public.privacy_export_page(p,'results',(page->0->>'id')::uuid,10);
  IF jsonb_array_length(page)<>0 THEN RAISE EXCEPTION 'Result pagination replays data'; END IF;
  page:=public.privacy_export_page(q,'results',NULL,10);
  IF jsonb_array_length(page)<>0 THEN RAISE EXCEPTION 'Other account export saw results'; END IF;
  page:=public.privacy_export_page(p,'raw',NULL,20);
  IF jsonb_array_length(page)<>1 OR page::text NOT LIKE '%Wordle 100 4/6%'
    OR page::text LIKE '%Unknown old result%'
  THEN RAISE EXCEPTION 'Expired share exported or current owner share missing'; END IF;
  page:=public.privacy_export_page(q,'raw',NULL,20);
  IF jsonb_array_length(page)<>0 THEN RAISE EXCEPTION 'Other account exported raw text'; END IF;
  page:=public.privacy_export_page(p,'friends',NULL,20);
  IF jsonb_array_length(page)<>1 OR page->0->>'id'<>q::text
  THEN RAISE EXCEPTION 'Owner friends export missing'; END IF;
  page:=public.privacy_export_page(p,'achievements',NULL,20);
  IF jsonb_array_length(page)<>2 THEN RAISE EXCEPTION 'Owner achievements export missing'; END IF;
  page:=public.privacy_export_page(p,'suggestions',NULL,20);
  IF jsonb_array_length(page)<>1 THEN RAISE EXCEPTION 'Owner suggestion export missing'; END IF;
  page:=public.privacy_export_page(q,'votes',NULL,20);
  IF jsonb_array_length(page)<>1 THEN RAISE EXCEPTION 'Owner votes export missing'; END IF;
  BEGIN
    PERFORM public.privacy_export_page(p,'internal_admin',NULL,20);
    RAISE EXCEPTION 'Arbitrary dataset export accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  purge:=public.privacy_purge_expired_raw();
  IF (purge->>'deleted')::integer<>1 OR EXISTS(
     SELECT 1 FROM public.raw_submissions WHERE id='92222222-2222-2222-2222-222222222222')
    OR NOT EXISTS(
      SELECT 1 FROM public.raw_submissions WHERE id='91111111-1111-1111-1111-111111111111')
  THEN RAISE EXCEPTION 'Raw TTL purge deleted incorrect samples: %',purge; END IF;
  purge:=public.privacy_purge_expired_raw();
  IF (purge->>'deleted')::integer<>0 THEN RAISE EXCEPTION 'Purge not idempotent'; END IF;
END $$;
ROLLBACK;

-- Test deletion-trigger anonymization while preserving unrelated admin records.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES('44444444-4444-4444-4444-444444444444','delete@example.invalid','{}');
INSERT INTO app_private.admin_events(actor_id,action,subject_type,subject_id,details)
VALUES('11111111-1111-1111-1111-111111111111','requests_restrict','user',
  '44444444-4444-4444-4444-444444444444','{"status":"restricted"}');
DELETE FROM public.profiles WHERE id='44444444-4444-4444-4444-444444444444';
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM app_private.admin_events
    WHERE subject_type='user'
      AND subject_id='44444444-4444-4444-4444-444444444444')
  OR NOT EXISTS(SELECT 1 FROM app_private.admin_events
    WHERE action='requests_restrict' AND subject_id IS NULL AND details='{}'::jsonb)
  THEN RAISE EXCEPTION 'Delete retained identifying admin audit target'; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: Phase 12 owner export, paged records, raw TTL and deletion audit cleanup' AS test_summary;
