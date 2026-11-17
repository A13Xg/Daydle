-- Phase 9: identity-safe public profiles and immediate symmetric friendship.
-- All writes via a Worker-verified user identity and service-role-only RPC.
BEGIN;

CREATE TABLE app_private.social_rate_limits (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 10000),
  PRIMARY KEY (user_id, window_start)
);
CREATE INDEX social_rate_limits_expiry_idx ON app_private.social_rate_limits(window_start);
ALTER TABLE app_private.social_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.social_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON app_private.social_rate_limits TO service_role;

CREATE FUNCTION app_private.consume_social_quota(p_user uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_attempts integer;
BEGIN
  INSERT INTO app_private.social_rate_limits(user_id, window_start, attempts)
  VALUES (
    p_user,
    pg_catalog.date_trunc('hour', pg_catalog.now()),
    1
  )
  ON CONFLICT (user_id, window_start) DO UPDATE
  SET attempts=app_private.social_rate_limits.attempts+1
  RETURNING attempts INTO v_attempts;
  RETURN v_attempts <= 15;
END;
$$;
REVOKE ALL ON FUNCTION app_private.consume_social_quota(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.consume_social_quota(uuid) TO service_role;

-- Public profile is deliberately non-spoiling until Phase 10 implements
-- per-viewer, per-puzzle unlock policies. It exposes only public identity and
-- voluntarily selected games, NOT result counts, scores, friend codes or email.
CREATE FUNCTION public.social_public_profile(p_profile uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'created_at', p.created_at,
    'games', COALESCE(
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('slug', selected.slug, 'name', selected.name)
          ORDER BY selected.sort_order, selected.name
        )
        FROM (
          SELECT g.slug, g.name, ug.sort_order
          FROM public.user_games ug
          JOIN public.games g ON g.id=ug.game_id
          WHERE ug.user_id=p.id AND g.status='active'
          ORDER BY ug.sort_order, g.name LIMIT 100
        ) selected
      ), '[]'::jsonb
    )
  )
  FROM public.profiles p
  WHERE p.id = p_profile;
$$;
REVOKE ALL ON FUNCTION public.social_public_profile(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_public_profile(uuid) TO service_role;

CREATE FUNCTION public.social_my_network(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'code', fc.code,
    'friends', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', peers.id, 'display_name', peers.display_name
        ) ORDER BY peers.display_name, peers.id
      )
      FROM (
        SELECT p.id,p.display_name
        FROM public.friendships f
        JOIN public.profiles p ON p.id=
          CASE WHEN f.user_low=p_user THEN f.user_high ELSE f.user_low END
        WHERE f.user_low=p_user OR f.user_high=p_user
        ORDER BY p.display_name,p.id LIMIT 200
      ) peers
    ), '[]'::jsonb),
    'has_more_friends', (
      SELECT count(*) > 200 FROM public.friendships f
      WHERE f.user_low=p_user OR f.user_high=p_user
    ),
    'blocked', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', targets.id, 'display_name', targets.display_name
        ) ORDER BY targets.display_name, targets.id
      )
      FROM (
        SELECT p.id,p.display_name FROM public.blocks b
        JOIN public.profiles p ON p.id=b.blocked_id
        WHERE b.blocker_id=p_user
        ORDER BY p.display_name,p.id LIMIT 200
      ) targets
    ), '[]'::jsonb)
  )
  FROM public.friend_codes fc
  WHERE fc.user_id=p_user;
$$;
REVOKE ALL ON FUNCTION public.social_my_network(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_my_network(uuid) TO service_role;

CREATE FUNCTION public.social_connect_by_code(p_user uuid,p_code text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target uuid;
  v_low uuid;
  v_high uuid;
  v_created integer;
  v_name text;
BEGIN
  IF p_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id=p_user
  ) THEN
    RETURN '{"status":"not_found"}'::jsonb;
  END IF;
  IF p_code IS NULL OR p_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$' THEN
    RETURN '{"status":"invalid_code"}'::jsonb;
  END IF;
  IF NOT app_private.consume_social_quota(p_user) THEN
    RETURN '{"status":"rate_limited"}'::jsonb;
  END IF;
  SELECT user_id INTO v_target FROM public.friend_codes WHERE code=p_code FOR SHARE;
  IF v_target IS NULL THEN
    RETURN '{"status":"not_found"}'::jsonb;
  END IF;
  IF v_target=p_user THEN
    RETURN '{"status":"self"}'::jsonb;
  END IF;
  v_low:=LEAST(p_user,v_target);
  v_high:=GREATEST(p_user,v_target);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_low::text || ':' || v_high::text, 0)
  );
  IF EXISTS (
    SELECT 1 FROM public.blocks b WHERE
    (b.blocker_id=p_user AND b.blocked_id=v_target)
    OR (b.blocker_id=v_target AND b.blocked_id=p_user)
  ) THEN
    RETURN '{"status":"unavailable"}'::jsonb;
  END IF;

  INSERT INTO public.friendships(user_low,user_high)
  VALUES (v_low,v_high) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_created=ROW_COUNT;
  SELECT display_name INTO v_name FROM public.profiles WHERE id=v_target;
  RETURN pg_catalog.jsonb_build_object(
    'status', CASE WHEN v_created=1 THEN 'connected' ELSE 'already_connected' END,
    'friend', pg_catalog.jsonb_build_object('id',v_target,'display_name',v_name)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.social_connect_by_code(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_connect_by_code(uuid,text) TO service_role;

CREATE FUNCTION public.social_change_relation(
  p_user uuid,p_other uuid,p_action text
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_low uuid;v_high uuid;v_count integer;
BEGIN
  IF p_user IS NULL OR p_other IS NULL OR p_user=p_other OR
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user) OR
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_other)
  THEN RETURN '{"status":"not_found"}'::jsonb; END IF;
  IF p_action NOT IN ('unfriend','block','unblock') OR p_action IS NULL
  THEN RETURN '{"status":"invalid_action"}'::jsonb; END IF;
  v_low:=LEAST(p_user,p_other);
  v_high:=GREATEST(p_user,p_other);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_low::text || ':' || v_high::text, 0)
  );
  IF p_action='block' THEN
    DELETE FROM public.friendships WHERE user_low=v_low AND user_high=v_high;
    INSERT INTO public.blocks(blocker_id,blocked_id)
    VALUES (p_user,p_other) ON CONFLICT DO NOTHING;
    RETURN '{"status":"blocked"}'::jsonb;
  ELSIF p_action='unblock' THEN
    DELETE FROM public.blocks WHERE blocker_id=p_user AND blocked_id=p_other;
    RETURN '{"status":"unblocked"}'::jsonb;
  END IF;
  DELETE FROM public.friendships WHERE user_low=v_low AND user_high=v_high;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN pg_catalog.jsonb_build_object(
    'status', CASE WHEN v_count=1 THEN 'unfriended' ELSE 'already_unfriended' END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.social_change_relation(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_change_relation(uuid,uuid,text)
  TO service_role;

CREATE FUNCTION public.social_regenerate_code(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_code text;v_attempt integer;v_updated integer;
BEGIN
  IF p_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.friend_codes WHERE user_id=p_user
  ) THEN RETURN '{"status":"not_found"}'::jsonb; END IF;
  FOR v_attempt IN 1..32 LOOP
    v_code:=app_private.random_friend_code();
    BEGIN
      UPDATE public.friend_codes
      SET code=v_code,created_at=pg_catalog.now()
      WHERE user_id=p_user AND code<>v_code;
      GET DIAGNOSTICS v_updated=ROW_COUNT;
      IF v_updated=1 THEN
        RETURN pg_catalog.jsonb_build_object('status','regenerated','code',v_code);
      END IF;
    EXCEPTION WHEN unique_violation THEN
      NULL; -- retry cryptographic candidate; unique index is authoritative
    END;
  END LOOP;
  RAISE EXCEPTION 'social_code_allocation_failed' USING ERRCODE='23505';
END;
$$;
REVOKE ALL ON FUNCTION public.social_regenerate_code(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_regenerate_code(uuid) TO service_role;

COMMIT;
