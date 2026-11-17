-- Phase 7: result ingestion, owner history and correction lifecycle.
-- Only the authenticated Worker may call these service_role-only RPCs.
-- Apply to live projects only with separately approved deployment authorization.
BEGIN;

UPDATE public.games
SET parser_status = 'supported', updated_at = now()
WHERE slug IN ('wordle', 'connections', 'strands', 'mini-crossword', 'quordle')
  AND parser_status <> 'supported';

-- Private, immutable-style event metadata survives DELETE of a canonical result;
-- never store raw share text or result scores in this audit trail.
CREATE TABLE app_private.result_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  result_id uuid NOT NULL,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  puzzle_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('saved', 'replaced', 'deleted')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX result_events_user_idx
  ON app_private.result_events (user_id, recorded_at DESC);
ALTER TABLE app_private.result_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.result_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON app_private.result_events TO service_role;

CREATE TABLE app_private.result_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 60)
);
ALTER TABLE app_private.result_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.result_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_private.result_rate_limits TO service_role;

CREATE FUNCTION app_private.consume_result_quota(p_user uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO app_private.result_rate_limits (user_id, window_start, attempts)
  VALUES (p_user, pg_catalog.now(), 1)
  ON CONFLICT (user_id) DO UPDATE
    SET window_start = CASE
          WHEN app_private.result_rate_limits.window_start <= pg_catalog.now() - interval '1 hour'
          THEN pg_catalog.now() ELSE app_private.result_rate_limits.window_start END,
        attempts = CASE
          WHEN app_private.result_rate_limits.window_start <= pg_catalog.now() - interval '1 hour'
          THEN 1 ELSE app_private.result_rate_limits.attempts + 1 END
    WHERE app_private.result_rate_limits.attempts < 60
      OR app_private.result_rate_limits.window_start <= pg_catalog.now() - interval '1 hour'
  RETURNING attempts INTO n;
  IF n IS NULL THEN
    RAISE EXCEPTION 'result_rate_limited' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION app_private.consume_result_quota(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.consume_result_quota(uuid) TO service_role;

CREATE FUNCTION public.ingest_parsed_share(
  p_user uuid, p_raw text, p_parsed jsonb, p_replace_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_puzzle public.puzzles%ROWTYPE;
  v_existing public.game_results%ROWTYPE;
  v_result_id uuid;
  v_key text;
  v_date date;
  v_outcome text;
  v_score numeric;
  v_attempts integer;
  v_time bigint;
  v_metrics jsonb;
  v_parser_version text;
  v_format_version text;
  v_same boolean;
BEGIN
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user) THEN
    RAISE EXCEPTION 'unknown_result_owner' USING ERRCODE='22023';
  END IF;
  IF p_raw IS NULL OR char_length(p_raw) NOT BETWEEN 1 AND 10000
     OR p_parsed IS NULL OR jsonb_typeof(p_parsed) <> 'object'
     OR pg_catalog.length(p_parsed::text) > 12000
  THEN
    RAISE EXCEPTION 'invalid_result_payload' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_game FROM public.games
  WHERE slug = p_parsed->>'gameSlug' AND status='active' AND parser_status='supported';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unsupported_result_game' USING ERRCODE='22023';
  END IF;

  v_key := p_parsed->>'puzzleKey';
  v_parser_version := p_parsed->>'parserVersion';
  v_format_version := p_parsed->>'formatVersion';
  v_outcome := p_parsed->>'outcome';
  IF v_key IS NULL OR v_key !~ '^[a-z0-9:-]{1,160}$'
    OR v_parser_version IS NULL OR char_length(v_parser_version) NOT BETWEEN 1 AND 40
    OR v_format_version IS NULL OR char_length(v_format_version) NOT BETWEEN 1 AND 40
    OR v_outcome NOT IN ('win','loss','complete','incomplete')
  THEN
    RAISE EXCEPTION 'invalid_result_identity' USING ERRCODE='22023';
  END IF;

  v_date := NULLIF(p_parsed->>'puzzleDate', '')::date;
  v_score := NULLIF(p_parsed->>'score','')::numeric;
  v_attempts := NULLIF(p_parsed->>'attempts','')::integer;
  v_time := NULLIF(p_parsed->>'completionTimeMs','')::bigint;
  v_metrics := COALESCE(p_parsed->'metrics','{}'::jsonb);
  IF jsonb_typeof(v_metrics) <> 'object' OR pg_catalog.length(v_metrics::text) > 8000
    OR (v_attempts IS NOT NULL AND (v_attempts < 0 OR v_attempts > 10000))
    OR (v_time IS NOT NULL AND (v_time < 0 OR v_time > 86400000))
  THEN
    RAISE EXCEPTION 'invalid_result_metrics' USING ERRCODE='22023';
  END IF;

  PERFORM app_private.consume_result_quota(p_user);
  INSERT INTO public.puzzles (game_id,puzzle_key,puzzle_date)
  VALUES (v_game.id,v_key,v_date)
  ON CONFLICT (game_id,puzzle_key) DO NOTHING;
  SELECT * INTO v_puzzle FROM public.puzzles
  WHERE game_id=v_game.id AND puzzle_key=v_key FOR UPDATE;
  IF v_puzzle.puzzle_date IS NOT NULL AND v_date IS NOT NULL
    AND v_puzzle.puzzle_date <> v_date
  THEN
    RAISE EXCEPTION 'conflicting_puzzle_date' USING ERRCODE='22023';
  END IF;
  IF v_puzzle.puzzle_date IS NULL AND v_date IS NOT NULL THEN
    UPDATE public.puzzles SET puzzle_date=v_date WHERE id=v_puzzle.id;
  END IF;

  -- The unique (user_id,puzzle_id) index is the final race boundary.
  -- Conflicting inserts serialize here; subsequent updates lock the stable row.
  IF p_replace_id IS NULL THEN
    INSERT INTO public.game_results
      (user_id,game_id,puzzle_id,outcome,score,attempts,completion_time_ms,
       metrics,parser_version,format_version)
    VALUES (p_user,v_game.id,v_puzzle.id,v_outcome,v_score,v_attempts,v_time,
            v_metrics,v_parser_version,v_format_version)
    ON CONFLICT (user_id,puzzle_id) DO NOTHING
    RETURNING id INTO v_result_id;
    IF v_result_id IS NOT NULL THEN
      INSERT INTO public.raw_submissions
        (user_id,game_id,result_id,raw_share_text,disposition)
      VALUES (p_user,v_game.id,v_result_id,p_raw,'accepted');
      INSERT INTO app_private.result_events(user_id,result_id,game_id,puzzle_id,action)
      VALUES(p_user,v_result_id,v_game.id,v_puzzle.id,'saved');
      RETURN jsonb_build_object('status','saved','id',v_result_id);
    END IF;
  END IF;

  SELECT * INTO v_existing FROM public.game_results
  WHERE user_id=p_user AND puzzle_id=v_puzzle.id FOR UPDATE;
  IF NOT FOUND THEN
    -- Explicit replacement may never insert a new unrelated result.
    RETURN jsonb_build_object('status','replace_target_mismatch');
  END IF;
  v_same := v_existing.outcome IS NOT DISTINCT FROM v_outcome
    AND v_existing.score IS NOT DISTINCT FROM v_score
    AND v_existing.attempts IS NOT DISTINCT FROM v_attempts
    AND v_existing.completion_time_ms IS NOT DISTINCT FROM v_time
    AND v_existing.metrics = v_metrics;
  IF p_replace_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', CASE WHEN v_same THEN 'duplicate' ELSE 'conflict' END,
      'id', v_existing.id
    );
  END IF;
  IF p_replace_id <> v_existing.id THEN
    RETURN jsonb_build_object('status','replace_target_mismatch');
  END IF;
  IF v_same THEN
    RETURN jsonb_build_object('status','duplicate','id',v_existing.id);
  END IF;

  INSERT INTO public.result_corrections(result_id,actor_id,old_payload,new_payload)
  VALUES (
    v_existing.id,p_user,
    jsonb_build_object('outcome',v_existing.outcome,'score',v_existing.score,
      'attempts',v_existing.attempts,'completionTimeMs',v_existing.completion_time_ms,
      'metrics',v_existing.metrics,'parserVersion',v_existing.parser_version,
      'formatVersion',v_existing.format_version),
    jsonb_build_object('outcome',v_outcome,'score',v_score,'attempts',v_attempts,
      'completionTimeMs',v_time,'metrics',v_metrics,'parserVersion',v_parser_version,
      'formatVersion',v_format_version)
  );
  UPDATE public.game_results SET
    outcome=v_outcome,score=v_score,attempts=v_attempts,
    completion_time_ms=v_time,metrics=v_metrics,
    parser_version=v_parser_version,format_version=v_format_version,
    updated_at=pg_catalog.now()
  WHERE id=v_existing.id;
  INSERT INTO public.raw_submissions
    (user_id,game_id,result_id,raw_share_text,disposition)
  VALUES (p_user,v_game.id,v_existing.id,p_raw,'accepted');
  INSERT INTO app_private.result_events(user_id,result_id,game_id,puzzle_id,action)
  VALUES(p_user,v_existing.id,v_game.id,v_puzzle.id,'replaced');
  RETURN jsonb_build_object('status','replaced','id',v_existing.id);
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_parsed_share(uuid,text,jsonb,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_parsed_share(uuid,text,jsonb,uuid)
  TO service_role;

-- Enforce idempotency for unsupported/invalid submitted samples. Accepted
-- shares always link a structured result and are excluded from this index.
CREATE UNIQUE INDEX raw_unparsed_user_fingerprint_unique
  ON public.raw_submissions (user_id, md5(raw_share_text), disposition)
  WHERE result_id IS NULL;

-- Called ONLY for an explicit authenticated Submit result action when the
-- deterministic parser did not produce one accepted canonical puzzle.
-- All diagnostics are allow-listed server-generated classifications, not
-- untrusted text or fields inferred from a client's own claimed score.
CREATE FUNCTION public.capture_unparsed_share(
  p_user uuid, p_raw text, p_disposition text, p_reason text,
  p_candidates text[] DEFAULT '{}'::text[], p_game_slug text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_game_id uuid; v_id uuid; v_inserted boolean := false;
BEGIN
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user)
    OR p_raw IS NULL OR char_length(p_raw) NOT BETWEEN 1 AND 10000
    OR pg_catalog.btrim(p_raw) = ''
    OR p_disposition NOT IN ('unsupported','invalid')
    OR p_reason NOT IN (
      'unknown_header','ambiguous_match','invalid_format',
      'control_character','too_many_lines'
    )
    OR p_candidates IS NULL OR COALESCE(array_length(p_candidates,1),0) > 5
    OR EXISTS (
      SELECT 1 FROM unnest(p_candidates) candidate
      WHERE candidate IS NULL OR candidate !~ '^[a-z][a-z0-9-]{1,63}$'
    )
    OR (p_game_slug IS NOT NULL
      AND p_game_slug !~ '^[a-z][a-z0-9-]{1,63}$')
    OR (p_disposition='unsupported' AND p_reason NOT IN ('unknown_header','ambiguous_match'))
    OR (p_disposition='invalid' AND p_reason IN ('unknown_header','ambiguous_match'))
  THEN RAISE EXCEPTION 'invalid_unparsed_sample' USING ERRCODE='22023'; END IF;

  IF p_game_slug IS NOT NULL THEN
    SELECT id INTO v_game_id FROM public.games WHERE slug=p_game_slug;
    IF v_game_id IS NULL THEN RAISE EXCEPTION 'unknown_game_slug' USING ERRCODE='22023'; END IF;
  END IF;
  PERFORM app_private.consume_result_quota(p_user);

  -- Re-capturing a previously expired exact share replaces the expired
  -- sample rather than counting it as current. Existing non-expired copies
  -- are idempotent even when concurrent submissions race.
  DELETE FROM public.raw_submissions
  WHERE user_id=p_user AND result_id IS NULL AND expires_at <= pg_catalog.now()
    AND disposition=p_disposition AND md5(raw_share_text)=md5(p_raw)
    AND raw_share_text=p_raw;
  INSERT INTO public.raw_submissions (
    user_id,game_id,raw_share_text,disposition,parser_diagnostics
  )
  VALUES (
    p_user,v_game_id,p_raw,p_disposition,
    jsonb_build_object(
      'review_status','pending',
      'reason_code',p_reason,
      'candidate_game_slugs',to_jsonb(p_candidates),
      'source','explicit_submit',
      'parser_analysis_version',1
    )
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  v_inserted := (v_id IS NOT NULL);
  IF NOT v_inserted THEN
    SELECT id INTO v_id FROM public.raw_submissions
    WHERE user_id=p_user AND result_id IS NULL AND disposition=p_disposition
      AND raw_share_text=p_raw
    LIMIT 1;
  END IF;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'sample_capture_failed' USING ERRCODE='P0001';
  END IF;
  RETURN jsonb_build_object(
    'status', CASE WHEN v_inserted THEN 'captured' ELSE 'already_captured' END,
    'classification', p_reason
  );
END;
$$;
REVOKE ALL ON FUNCTION public.capture_unparsed_share(uuid,text,text,text,text[],text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_unparsed_share(uuid,text,text,text,text[],text)
  TO service_role;

CREATE FUNCTION public.my_result_history(
  p_user uuid, p_game text DEFAULT NULL, p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
 SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY rows.submitted_at DESC, rows.id DESC),'[]'::jsonb)
 FROM (
   SELECT r.id,r.game_id, g.slug AS game_slug, g.name AS game_name,
          p.puzzle_key,p.puzzle_date,r.outcome,r.score,r.attempts,
          r.completion_time_ms,r.metrics,r.parser_version,r.format_version,
          r.submitted_at,r.updated_at
   FROM public.game_results r
   JOIN public.games g ON g.id=r.game_id
   JOIN public.puzzles p ON p.id=r.puzzle_id
   WHERE r.user_id=p_user AND (p_game IS NULL OR g.slug=p_game)
   ORDER BY r.submitted_at DESC,r.id DESC
   LIMIT least(greatest(COALESCE(p_limit,20),1),50)
   OFFSET least(greatest(COALESCE(p_offset,0),0),5000)
 ) rows;
$$;
REVOKE ALL ON FUNCTION public.my_result_history(uuid,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_result_history(uuid,text,integer,integer)
  TO service_role;

CREATE FUNCTION public.my_result_detail(p_user uuid, p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
 SELECT to_jsonb(rows)
 FROM (
   SELECT r.id,r.game_id,g.slug AS game_slug,g.name AS game_name,
          p.puzzle_key,p.puzzle_date,r.outcome,r.score,r.attempts,
          r.completion_time_ms,r.metrics,r.parser_version,r.format_version,
          r.submitted_at,r.updated_at,
          (SELECT count(*) FROM public.result_corrections c WHERE c.result_id=r.id) AS correction_count
   FROM public.game_results r
   JOIN public.games g ON g.id=r.game_id
   JOIN public.puzzles p ON p.id=r.puzzle_id
   WHERE r.id=p_id AND r.user_id=p_user
 ) rows;
$$;
REVOKE ALL ON FUNCTION public.my_result_detail(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_result_detail(uuid,uuid) TO service_role;

CREATE FUNCTION public.delete_my_result(p_user uuid, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result public.game_results%ROWTYPE;
BEGIN
 SELECT * INTO v_result FROM public.game_results
 WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
 INSERT INTO app_private.result_events(user_id,result_id,game_id,puzzle_id,action)
 VALUES(p_user,v_result.id,v_result.game_id,v_result.puzzle_id,'deleted');
 DELETE FROM public.game_results WHERE id=v_result.id;
 RETURN jsonb_build_object('status','deleted','id',v_result.id);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_result(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_result(uuid,uuid) TO service_role;

COMMIT;
