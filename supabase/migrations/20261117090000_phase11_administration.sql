-- Phase 11: restricted, auditable request voting and operator workflows.
-- Only the Worker (service_role) may invoke these RPCs. Never grant clients
-- direct access to private tables or privileged entry points.
BEGIN;

CREATE TABLE app_private.request_limits (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('create', 'vote')),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 1000),
  PRIMARY KEY (user_id, operation, window_start)
);
ALTER TABLE app_private.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.request_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_private.request_limits TO service_role;

CREATE TABLE app_private.request_restrictions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 240),
  restricted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.request_restrictions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.request_restrictions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON app_private.request_restrictions TO service_role;

-- Canonical comparison is whitespace-trimmed, case-insensitive. One suggestion
-- per publisher URL, including previously rejected requests.
CREATE UNIQUE INDEX game_suggestions_url_identity
  ON public.game_suggestions ((lower(btrim(url))));

CREATE FUNCTION app_private.request_admin(p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p_actor IS NOT NULL
    AND EXISTS (SELECT 1 FROM app_private.admin_members m WHERE m.user_id = p_actor);
$$;
REVOKE ALL ON FUNCTION app_private.request_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.request_admin(uuid) TO service_role;

CREATE FUNCTION app_private.request_quota(p_user uuid, p_operation text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE count_now integer;
BEGIN
  INSERT INTO app_private.request_limits(user_id, operation, window_start, attempts)
  VALUES (p_user, p_operation, date_trunc('hour', now()), 1)
  ON CONFLICT (user_id, operation, window_start)
  DO UPDATE SET attempts = app_private.request_limits.attempts + 1
  RETURNING attempts INTO count_now;
  RETURN count_now <= CASE WHEN p_operation = 'create' THEN 5 ELSE 50 END;
END;
$$;
REVOKE ALL ON FUNCTION app_private.request_quota(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.request_quota(uuid,text) TO service_role;

CREATE FUNCTION public.daydle_requests(p_actor uuid DEFAULT NULL, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(item) ORDER BY item.created_at DESC, item.id DESC), '[]'::jsonb)
  FROM (
    SELECT s.id, s.name, s.url, s.notes, s.status, s.created_at,
      (SELECT count(*) FROM public.suggestion_votes v WHERE v.suggestion_id = s.id)::integer AS vote_count,
      EXISTS(SELECT 1 FROM public.suggestion_votes v
        WHERE v.suggestion_id=s.id AND v.user_id=p_actor) AS voted_by_me,
      COALESCE(s.suggested_by=p_actor,false) AS suggested_by_me
    FROM public.game_suggestions s
    WHERE s.status IN ('pending','approved')
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit,20),1),50)
    OFFSET LEAST(GREATEST(COALESCE(p_offset,0),0),5000)
  ) item;
$$;
REVOKE ALL ON FUNCTION public.daydle_requests(uuid,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daydle_requests(uuid,integer,integer) TO service_role;

CREATE FUNCTION public.daydle_request_action(
  p_actor uuid, p_action text, p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL, p_url text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE result_id uuid; current_status text;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor) THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM app_private.request_restrictions WHERE user_id=p_actor) THEN
    RETURN jsonb_build_object('status','restricted');
  END IF;
  IF p_action='create' THEN
    IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 120
       OR app_private.safe_publisher_url(p_url) IS DISTINCT FROM true
       OR p_notes IS NOT NULL AND char_length(p_notes)>500
       OR p_id IS NOT NULL THEN
      RETURN jsonb_build_object('status','invalid');
    END IF;
    IF NOT app_private.request_quota(p_actor,'create') THEN
      RETURN jsonb_build_object('status','rate_limited');
    END IF;
    -- The unique index on normalized URL is the concurrency boundary.
    INSERT INTO public.game_suggestions(suggested_by,name,url,notes)
      VALUES(p_actor,btrim(p_name),btrim(p_url),COALESCE(p_notes,''))
      ON CONFLICT DO NOTHING RETURNING id INTO result_id;
    IF result_id IS NULL THEN
      SELECT id INTO result_id FROM public.game_suggestions
      WHERE lower(btrim(url))=lower(btrim(p_url)) LIMIT 1;
      RETURN jsonb_build_object('status','duplicate','id',result_id);
    END IF;
    RETURN jsonb_build_object('status','created','id',result_id);
  ELSIF p_action IN ('vote','unvote') THEN
    IF p_id IS NULL THEN RETURN jsonb_build_object('status','invalid'); END IF;
    SELECT status INTO current_status FROM public.game_suggestions WHERE id=p_id;
    IF current_status IS NULL OR current_status NOT IN ('pending','approved') THEN
      RETURN jsonb_build_object('status','not_found');
    END IF;
    IF NOT app_private.request_quota(p_actor,'vote') THEN
      RETURN jsonb_build_object('status','rate_limited');
    END IF;
    IF p_action='vote' THEN
      INSERT INTO public.suggestion_votes(suggestion_id,user_id)
      VALUES(p_id,p_actor) ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.suggestion_votes WHERE suggestion_id=p_id AND user_id=p_actor;
    END IF;
    RETURN jsonb_build_object('status',CASE WHEN p_action='vote' THEN 'voted' ELSE 'unvoted' END,'id',p_id);
  END IF;
  RETURN jsonb_build_object('status','invalid');
END;
$$;
REVOKE ALL ON FUNCTION public.daydle_request_action(uuid,text,uuid,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daydle_request_action(uuid,text,uuid,text,text,text) TO service_role;

CREATE FUNCTION public.daydle_admin_status(p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT app_private.request_admin(p_actor); $$;
REVOKE ALL ON FUNCTION public.daydle_admin_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daydle_admin_status(uuid) TO service_role;

CREATE FUNCTION public.daydle_admin_view(
  p_actor uuid, p_view text, p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0, p_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  cap integer := LEAST(GREATEST(COALESCE(p_limit,20),1),50);
  skipped integer := LEAST(GREATEST(COALESCE(p_offset,0),0),5000);
BEGIN
  IF NOT app_private.request_admin(p_actor) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE='42501';
  END IF;
  IF p_view='overview' THEN
    RETURN jsonb_build_object(
      'pending_requests',(SELECT count(*) FROM public.game_suggestions WHERE status='pending'),
      'unparsed_samples',(SELECT count(*) FROM public.raw_submissions
        WHERE result_id IS NULL AND expires_at>now() AND disposition IN ('invalid','unsupported')),
      'restricted_users',(SELECT count(*) FROM app_private.request_restrictions));
  ELSIF p_view='requests' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC),'[]'::jsonb)
      FROM (SELECT s.id,s.name,s.url,s.notes,s.status,s.created_at,s.suggested_by,
        (SELECT count(*) FROM public.suggestion_votes v WHERE v.suggestion_id=s.id)::integer AS vote_count
        FROM public.game_suggestions s ORDER BY s.created_at DESC,s.id DESC LIMIT cap OFFSET skipped) x);
  ELSIF p_view='games' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.name,x.id),'[]'::jsonb)
      FROM (SELECT id,slug,name,description,publisher,canonical_url AS url,
          status,cadence,parser_status,link_status
        FROM public.games ORDER BY name,id LIMIT cap OFFSET skipped) x);
  ELSIF p_view='samples' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.received_at DESC,x.id DESC),'[]'::jsonb)
      FROM (SELECT r.id,r.disposition,r.received_at,r.expires_at,
          r.parser_diagnostics->>'reason_code' AS reason,
          r.parser_diagnostics->>'review_status' AS review_status,
          g.slug AS game_slug
        FROM public.raw_submissions r
        LEFT JOIN public.games g ON g.id=r.game_id
        WHERE r.result_id IS NULL AND r.expires_at>now()
          AND r.disposition IN ('invalid','unsupported')
        ORDER BY r.received_at DESC,r.id DESC LIMIT cap OFFSET skipped) x);
  ELSIF p_view='sample' THEN
    RETURN (SELECT jsonb_build_object('id',r.id,
      'raw_text',r.raw_share_text,'disposition',r.disposition,
      'diagnostics',r.parser_diagnostics,'expires_at',r.expires_at)
      FROM public.raw_submissions r
      WHERE r.id=p_id AND r.result_id IS NULL AND r.expires_at>now()
        AND r.disposition IN ('invalid','unsupported'));
  ELSIF p_view='diagnostics' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.samples DESC,x.reason),'[]'::jsonb)
      FROM (SELECT COALESCE(r.parser_diagnostics->>'reason_code','unknown') AS reason,
        r.disposition,count(*)::integer AS samples
        FROM public.raw_submissions r
        WHERE r.result_id IS NULL AND r.expires_at>now() AND r.received_at>now()-interval '30 days'
          AND r.disposition IN ('invalid','unsupported')
        GROUP BY 1,2 ORDER BY 3 DESC,1 LIMIT 100) x);
  ELSIF p_view='restrictions' THEN
    RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb)
      FROM (SELECT user_id,reason,created_at FROM app_private.request_restrictions
        ORDER BY created_at DESC LIMIT cap OFFSET skipped) x);
  END IF;
  RAISE EXCEPTION 'invalid_admin_view' USING ERRCODE='22023';
END;
$$;
REVOKE ALL ON FUNCTION public.daydle_admin_view(uuid,text,integer,integer,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daydle_admin_view(uuid,text,integer,integer,uuid) TO service_role;

CREATE FUNCTION public.daydle_admin_action(p_actor uuid, p_action text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE target_id uuid; saved_id uuid; change_status text;
DECLARE target_slug text; target_name text; target_url text;
DECLARE target_reason text; old_status text;
BEGIN
  IF NOT app_private.request_admin(p_actor) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE='42501';
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR length(p_data::text)>5000 THEN
    RETURN jsonb_build_object('status','invalid');
  END IF;
  IF p_action='moderate' THEN
    target_id := NULLIF(p_data->>'id','')::uuid;
    change_status := p_data->>'status';
    IF target_id IS NULL OR change_status NOT IN ('pending','approved','rejected') THEN
      RETURN jsonb_build_object('status','invalid');
    END IF;
    UPDATE public.game_suggestions SET status=change_status WHERE id=target_id
    RETURNING id INTO saved_id;
    IF saved_id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
    INSERT INTO app_private.admin_events(actor_id,action,subject_type,subject_id,details)
      VALUES(p_actor,'suggestion_moderated','game_suggestion',target_id,
        jsonb_build_object('status',change_status));
  ELSIF p_action='save_game' THEN
    target_id := NULLIF(p_data->>'id','')::uuid;
    target_slug := p_data->>'slug';
    target_name := btrim(p_data->>'name');
    target_url := p_data->>'url';
    IF target_slug IS NULL OR target_slug !~ '^[a-z][a-z0-9-]{1,63}$'
       OR target_name IS NULL OR char_length(target_name) NOT BETWEEN 1 AND 120
       OR app_private.safe_publisher_url(target_url) IS DISTINCT FROM true
       OR COALESCE(length(p_data->>'description'),0)>1000
       OR COALESCE(length(p_data->>'publisher'),0)>120
       OR COALESCE(p_data->>'cadence','daily') NOT IN ('daily','weekly','irregular','multiple_daily','unknown')
       OR COALESCE(p_data->>'status','active') NOT IN ('active','inactive','retired')
    THEN RETURN jsonb_build_object('status','invalid'); END IF;
    IF target_id IS NULL THEN
      INSERT INTO public.games(slug,name,canonical_url,description,publisher,cadence,status)
      VALUES(target_slug,target_name,target_url,COALESCE(p_data->>'description',''),
        p_data->>'publisher',COALESCE(p_data->>'cadence','daily'),
        COALESCE(p_data->>'status','active'))
      RETURNING id INTO saved_id;
    ELSE
      UPDATE public.games SET name=target_name,canonical_url=target_url,
        description=COALESCE(p_data->>'description',''),publisher=p_data->>'publisher',
        cadence=COALESCE(p_data->>'cadence','daily'),
        status=COALESCE(p_data->>'status','active'),updated_at=now()
      WHERE id=target_id AND slug=target_slug RETURNING id INTO saved_id;
      IF saved_id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
    END IF;
    INSERT INTO app_private.admin_events(actor_id,action,subject_type,subject_id,details)
      VALUES(p_actor,'catalog_saved','game',saved_id,jsonb_build_object('slug',target_slug));
  ELSIF p_action='retire_game' THEN
    target_id := NULLIF(p_data->>'id','')::uuid;
    UPDATE public.games SET status='retired',updated_at=now()
      WHERE id=target_id RETURNING id INTO saved_id;
    IF saved_id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
    INSERT INTO app_private.admin_events(actor_id,action,subject_type,subject_id)
      VALUES(p_actor,'catalog_retired','game',saved_id);
  ELSIF p_action='review_sample' THEN
    target_id := NULLIF(p_data->>'id','')::uuid;
    change_status := p_data->>'status';
    target_slug := p_data->>'gameSlug';
    IF target_id IS NULL OR change_status NOT IN ('pending','classified','ignored')
      OR (target_slug IS NOT NULL AND (target_slug !~ '^[a-z][a-z0-9-]{1,63}$'
        OR NOT EXISTS(SELECT 1 FROM public.games WHERE slug=target_slug)))
      OR COALESCE(length(p_data->>'notes'),0)>240
    THEN RETURN jsonb_build_object('status','invalid'); END IF;
    UPDATE public.raw_submissions SET parser_diagnostics=parser_diagnostics ||
      jsonb_build_object('review_status',change_status,'review_game_slug',target_slug,
        'review_notes',COALESCE(p_data->>'notes',''))
    WHERE id=target_id AND result_id IS NULL AND expires_at>now()
      AND disposition IN ('invalid','unsupported')
    RETURNING id INTO saved_id;
    IF saved_id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
    INSERT INTO app_private.admin_events(actor_id,action,subject_type,subject_id,details)
      VALUES(p_actor,'sample_reviewed','raw_submission',saved_id,
        jsonb_build_object('status',change_status,'game_slug',target_slug));
  ELSIF p_action='restrict' OR p_action='unrestrict' THEN
    target_id := NULLIF(p_data->>'userId','')::uuid;
    target_reason := btrim(COALESCE(p_data->>'reason',''));
    IF target_id IS NULL OR (p_action='restrict'
      AND char_length(target_reason) NOT BETWEEN 1 AND 240) THEN
      RETURN jsonb_build_object('status','invalid');
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target_id)
      THEN RETURN jsonb_build_object('status','not_found'); END IF;
    IF p_action='restrict' THEN
      INSERT INTO app_private.request_restrictions(user_id,reason,restricted_by)
      VALUES(target_id,target_reason,p_actor)
      ON CONFLICT (user_id) DO UPDATE SET
        reason=EXCLUDED.reason,restricted_by=EXCLUDED.restricted_by,created_at=now();
    ELSE
      DELETE FROM app_private.request_restrictions WHERE user_id=target_id;
    END IF;
    saved_id:=target_id;
    INSERT INTO app_private.admin_events(actor_id,action,subject_type,subject_id)
      VALUES(p_actor,'requests_'||p_action,'user',saved_id);
  ELSE
    RETURN jsonb_build_object('status','invalid');
  END IF;
  RETURN jsonb_build_object('status','saved','id',saved_id);
END;
$$;
REVOKE ALL ON FUNCTION public.daydle_admin_action(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daydle_admin_action(uuid,text,jsonb) TO service_role;
COMMIT;
