-- Phase 12: bounded, owner-scoped export and rolling raw-share erasure.
-- Forward-only SQL; host application requires a distinct protected release.
BEGIN;

-- This wrapper is the ONLY scheduled purge entry point. Invocation is from
-- the Cloudflare scheduled handler with server-held service_role credential,
-- never a client RPC.
CREATE FUNCTION public.privacy_purge_expired_raw()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE n bigint;
BEGIN
  SELECT app_private.purge_expired_raw_submissions() INTO n;
  RETURN jsonb_build_object('deleted',n);
END;
$$;
REVOKE ALL ON FUNCTION public.privacy_purge_expired_raw()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_purge_expired_raw() TO service_role;

-- The caller's identity is verified by Worker /auth/v1/user and is never
-- taken from the browser body. Each SQL branch applies its own owner check.
-- UUID keyset pagination is stable across all datasets, without offset drift.
CREATE FUNCTION public.privacy_export_page(
  p_user uuid, p_dataset text, p_cursor uuid DEFAULT NULL, p_limit integer DEFAULT 25
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_limit integer := LEAST(GREATEST(COALESCE(p_limit,25),1),50);
BEGIN
  IF p_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user)
  THEN RAISE EXCEPTION 'unknown_export_owner' USING ERRCODE='42501'; END IF;
  IF p_dataset='raw' THEN v_limit:=LEAST(v_limit,20); END IF;
  IF p_dataset='profile' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT p.id,p.display_name,p.avatar_url,p.created_at,p.updated_at,
        fc.code AS friend_code
   FROM public.profiles p LEFT JOIN public.friend_codes fc ON fc.user_id=p.id
  WHERE p.id=p_user AND (p_cursor IS NULL OR p.id>p_cursor)
  ORDER BY p.id LIMIT 1) r);
  ELSIF p_dataset='selections' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT ug.game_id AS id,g.slug AS game_slug,ug.sort_order,ug.added_at
   FROM public.user_games ug JOIN public.games g ON g.id=ug.game_id
  WHERE ug.user_id=p_user AND (p_cursor IS NULL OR ug.game_id>p_cursor)
  ORDER BY ug.game_id LIMIT v_limit) r);
  ELSIF p_dataset='results' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT r.id,g.slug AS game_slug,p.puzzle_key,p.puzzle_date,
    r.outcome,r.score,r.max_score,r.attempts,r.completion_time_ms,
    r.metrics,r.parser_version,r.format_version,r.submitted_at,r.updated_at
   FROM public.game_results r JOIN public.games g ON g.id=r.game_id
   JOIN public.puzzles p ON p.id=r.puzzle_id
  WHERE r.user_id=p_user AND (p_cursor IS NULL OR r.id>p_cursor)
  ORDER BY r.id LIMIT v_limit) r);
  ELSIF p_dataset='corrections' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT c.id,c.result_id,c.old_payload,c.new_payload,c.corrected_at
   FROM public.result_corrections c JOIN public.game_results r ON r.id=c.result_id
  WHERE r.user_id=p_user AND (p_cursor IS NULL OR c.id>p_cursor)
  ORDER BY c.id LIMIT v_limit) r);
  ELSIF p_dataset='raw' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT r.id,g.slug AS game_slug,r.result_id,r.raw_share_text,
    r.disposition,r.parser_diagnostics,r.received_at,r.expires_at
   FROM public.raw_submissions r LEFT JOIN public.games g ON g.id=r.game_id
  WHERE r.user_id=p_user AND r.expires_at>now()
    AND (p_cursor IS NULL OR r.id>p_cursor)
  ORDER BY r.id LIMIT v_limit) r);
  ELSIF p_dataset='friends' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT p.id,p.display_name,f.created_at
   FROM public.friendships f JOIN public.profiles p ON p.id=
     CASE WHEN f.user_low=p_user THEN f.user_high ELSE f.user_low END
  WHERE (f.user_low=p_user OR f.user_high=p_user)
    AND (p_cursor IS NULL OR p.id>p_cursor)
  ORDER BY p.id LIMIT v_limit) r);
  ELSIF p_dataset='blocks' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT b.blocked_id AS id,b.created_at
   FROM public.blocks b WHERE b.blocker_id=p_user
     AND (p_cursor IS NULL OR b.blocked_id>p_cursor)
  ORDER BY b.blocked_id LIMIT v_limit) r);
  ELSIF p_dataset='achievements' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT a.achievement_id AS id,d.code,d.name,a.source_puzzle_id,
    a.earned_at,a.visible_after
   FROM public.user_achievements a
   JOIN public.achievement_definitions d ON d.id=a.achievement_id
  WHERE a.user_id=p_user AND (p_cursor IS NULL OR a.achievement_id>p_cursor)
  ORDER BY a.achievement_id LIMIT v_limit) r);
  ELSIF p_dataset='suggestions' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT s.id,s.name,s.url,s.notes,s.status,s.created_at
   FROM public.game_suggestions s WHERE s.suggested_by=p_user
     AND (p_cursor IS NULL OR s.id>p_cursor)
  ORDER BY s.id LIMIT v_limit) r);
  ELSIF p_dataset='votes' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT v.suggestion_id AS id,v.created_at
   FROM public.suggestion_votes v WHERE v.user_id=p_user
     AND (p_cursor IS NULL OR v.suggestion_id>p_cursor)
  ORDER BY v.suggestion_id LIMIT v_limit) r);
  ELSIF p_dataset='result_events' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
      FROM (SELECT e.id,e.result_id,e.game_id,e.puzzle_id,e.action,e.recorded_at
   FROM app_private.result_events e WHERE e.user_id=p_user
     AND (p_cursor IS NULL OR e.id>p_cursor)
  ORDER BY e.id LIMIT v_limit) r);
  END IF;
  RAISE EXCEPTION 'unknown_export_dataset' USING ERRCODE='22023';
END;
$$;
REVOKE ALL ON FUNCTION public.privacy_export_page(uuid,text,uuid,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_export_page(uuid,text,uuid,integer)
  TO service_role;

-- Preserve harmless admin audit evidence, but sever the deleted user's
-- UUID from operator restriction target fields during the actual cascading
-- auth.user -> profile delete transaction (not an earlier non-atomic step).
CREATE FUNCTION app_private.anonymize_deleted_profile_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE app_private.admin_events
     SET subject_id=NULL,
         details='{}'::jsonb
   WHERE subject_type='user' AND subject_id=OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION app_private.anonymize_deleted_profile_audit()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profiles_delete_audit_anonymize
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.anonymize_deleted_profile_audit();

COMMIT;
