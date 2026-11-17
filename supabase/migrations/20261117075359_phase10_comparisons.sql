-- Phase 10: viewer-specific spoiler-safe comparisons.
-- New public-schema RPCs are service-role-only, called through verified Worker.
-- Historical Phase 2 RLS helper is wired to the same policy.
BEGIN;

CREATE FUNCTION app_private.comparison_can_view(p_viewer uuid, p_puzzle uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.puzzles p
    WHERE p.id = p_puzzle AND (
      (p.reset_verified_at IS NOT NULL AND p.reset_verified_at <= pg_catalog.now())
      OR (
        p_viewer IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.game_results own
          WHERE own.puzzle_id = p.id AND own.user_id = p_viewer
        )
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION app_private.comparison_can_view(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.comparison_can_view(uuid,uuid)
  TO service_role;

-- The browser RLS predicate and privileged comparison RPCs now delegate
-- to one authoritative release/same-puzzle policy. The owner read remains
-- explicitly permitted for canonical results.
CREATE OR REPLACE FUNCTION app_private.can_view_result(
  result_owner uuid, target_puzzle uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.uid() IS NOT NULL AND auth.uid() = result_owner)
    OR app_private.comparison_can_view(auth.uid(), target_puzzle);
$$;

-- Only parser-defined compatible game metrics; never universal scoring.
-- A null metric means no defensible ranking for that result.
CREATE FUNCTION app_private.comparison_metric(
  p_slug text,
  p_outcome text,
  p_attempts integer,
  p_time bigint,
  p_metrics jsonb
)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_text text; v_value numeric; v_count integer; v_valid integer;
BEGIN
  IF p_outcome NOT IN ('win','complete') OR p_outcome IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_slug='wordle' THEN
    IF p_attempts BETWEEN 1 AND 6 THEN RETURN p_attempts; END IF;
    RETURN NULL;
  END IF;
  IF p_slug='mini-crossword' THEN
    IF p_time BETWEEN 1 AND 86399999 THEN RETURN p_time; END IF;
    RETURN NULL;
  END IF;
  IF p_slug IN ('connections','strands') THEN
    v_text := CASE WHEN p_slug='connections'
      THEN p_metrics ->> 'mistakes' ELSE p_metrics ->> 'hints' END;
    IF v_text ~ '^[0-9]{1,2}$' THEN
      v_value := v_text::numeric;
      IF (p_slug='connections' AND v_value BETWEEN 0 AND 3)
         OR (p_slug='strands' AND v_value BETWEEN 0 AND 30)
      THEN RETURN v_value; END IF;
    END IF;
    RETURN NULL;
  END IF;
  IF p_slug='quordle' THEN
    IF pg_catalog.jsonb_typeof(p_metrics->'boardAttempts') <> 'array'
      OR pg_catalog.jsonb_array_length(p_metrics->'boardAttempts') <> 4
    THEN RETURN NULL; END IF;
    SELECT count(*)::integer,
      count(*) FILTER (
        WHERE pg_catalog.jsonb_typeof(board.value)='number'
          AND board.value::text ~ '^[1-9]$'
      )::integer,
      sum(CASE
        WHEN pg_catalog.jsonb_typeof(board.value)='number'
          AND board.value::text ~ '^[1-9]$'
        THEN board.value::text::numeric ELSE NULL
      END)
    INTO v_count,v_valid,v_value
    FROM pg_catalog.jsonb_array_elements(p_metrics->'boardAttempts') board(value);
    IF v_count=4 AND v_valid=4 THEN RETURN v_value; END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION app_private.comparison_metric(text,text,integer,bigint,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.comparison_metric(text,text,integer,bigint,jsonb)
  TO service_role;

CREATE FUNCTION public.comparison_puzzles(p_game_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_game uuid; v_name text; v_items jsonb;
BEGIN
  SELECT id,name INTO v_game,v_name FROM public.games
  WHERE slug=p_game_slug AND parser_status='supported' AND status='active';
  IF v_game IS NULL THEN RETURN '{"status":"not_found"}'::jsonb; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'puzzleKey', x.puzzle_key,'puzzleDate',x.puzzle_date,
    'released',x.reset_verified_at IS NOT NULL
      AND x.reset_verified_at <= pg_catalog.now()
  ) ORDER BY x.puzzle_date DESC NULLS LAST,x.created_at DESC,x.id), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT p.id,p.puzzle_key,p.puzzle_date,p.reset_verified_at,p.created_at
    FROM public.puzzles p WHERE p.game_id=v_game
    ORDER BY p.puzzle_date DESC NULLS LAST,p.created_at DESC,p.id
    LIMIT 40
  ) x;
  RETURN pg_catalog.jsonb_build_object(
    'status','ready','gameSlug',p_game_slug,'gameName',v_name,'items',v_items
  );
END;
$$;
REVOKE ALL ON FUNCTION public.comparison_puzzles(text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.comparison_puzzles(text) TO service_role;

CREATE FUNCTION public.comparison_board(
  p_viewer uuid,p_game_slug text,p_puzzle_key text,p_scope text,
  p_limit integer,p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_puzzle uuid; v_name text; v_date date; v_reset timestamptz;
  v_metric_label text; v_items jsonb; v_total integer;
  v_ranked integer;
BEGIN
  IF p_scope NOT IN ('global','friends') OR p_scope IS NULL
    OR (p_scope='friends' AND p_viewer IS NULL)
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 5000
    OR p_game_slug IS NULL OR p_game_slug !~ '^[a-z][a-z0-9-]{1,63}$'
    OR p_puzzle_key IS NULL OR char_length(p_puzzle_key) NOT BETWEEN 1 AND 160
  THEN RETURN '{"status":"invalid_request"}'::jsonb; END IF;

  SELECT p.id,g.name,p.puzzle_date,p.reset_verified_at
    INTO v_puzzle,v_name,v_date,v_reset
  FROM public.puzzles p JOIN public.games g ON g.id=p.game_id
  WHERE g.slug=p_game_slug AND p.puzzle_key=p_puzzle_key
    AND g.parser_status='supported';
  IF v_puzzle IS NULL THEN RETURN '{"status":"not_found"}'::jsonb; END IF;
  IF NOT app_private.comparison_can_view(p_viewer,v_puzzle) THEN
    RETURN pg_catalog.jsonb_build_object(
      'status','locked','gameSlug',p_game_slug,'gameName',v_name,
      'puzzleKey',p_puzzle_key,'puzzleDate',v_date
    );
  END IF;

  v_metric_label:=CASE p_game_slug
    WHEN 'wordle' THEN 'Attempts'
    WHEN 'connections' THEN 'Mistakes'
    WHEN 'strands' THEN 'Hints used'
    WHEN 'mini-crossword' THEN 'Solve time (ms)'
    WHEN 'quordle' THEN 'Total board attempts'
    ELSE 'Not ranked' END;

  WITH filtered AS (
    SELECT r.id,r.user_id,p.display_name,r.outcome,
      app_private.comparison_metric(
        p_game_slug,r.outcome,r.attempts,r.completion_time_ms,r.metrics
      ) AS metric_value
    FROM public.game_results r
    JOIN public.profiles p ON p.id=r.user_id
    WHERE r.puzzle_id=v_puzzle
      AND (
        p_scope='global'
        OR r.user_id=p_viewer
        OR EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE (f.user_low=p_viewer AND f.user_high=r.user_id)
             OR (f.user_high=p_viewer AND f.user_low=r.user_id)
        )
      )
  ), ranked AS (
    SELECT f.*,
      CASE WHEN f.metric_value IS NOT NULL
      THEN pg_catalog.rank() OVER (ORDER BY f.metric_value ASC NULLS LAST)
      ELSE NULL END AS standing
    FROM filtered f
  ), page AS (
    SELECT * FROM ranked
    ORDER BY standing ASC NULLS LAST,display_name,id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    (SELECT count(*)::integer FROM filtered),
    (SELECT count(*)::integer FROM filtered WHERE metric_value IS NOT NULL),
    COALESCE((SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'resultId',page.id,'userId',page.user_id,
        'displayName',page.display_name,'outcome',page.outcome,
        'metricValue',page.metric_value,'rank',page.standing
      ) ORDER BY page.standing ASC NULLS LAST,page.display_name,page.id
    ) FROM page),'[]'::jsonb)
  INTO v_total,v_ranked,v_items;

  RETURN pg_catalog.jsonb_build_object(
    'status','ready',
    'gameSlug',p_game_slug,'gameName',v_name,
    'puzzleKey',p_puzzle_key,'puzzleDate',v_date,
    'released',v_reset IS NOT NULL AND v_reset<=pg_catalog.now(),
    'metricLabel',v_metric_label,'scope',p_scope,
    'totalVisible',v_total,'rankedCount',v_ranked,'items',v_items
  );
END;
$$;
REVOKE ALL ON FUNCTION public.comparison_board(uuid,text,text,text,integer,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.comparison_board(uuid,text,text,text,integer,integer)
  TO service_role;

CREATE FUNCTION public.comparison_public_result(p_viewer uuid,p_result uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'resultId',r.id,'userId',r.user_id,'displayName',u.display_name,
    'gameSlug',g.slug,'gameName',g.name,
    'puzzleKey',p.puzzle_key,'puzzleDate',p.puzzle_date,
    'outcome',r.outcome,
    'metricLabel', CASE g.slug
      WHEN 'wordle' THEN 'Attempts'
      WHEN 'connections' THEN 'Mistakes'
      WHEN 'strands' THEN 'Hints used'
      WHEN 'mini-crossword' THEN 'Solve time (ms)'
      WHEN 'quordle' THEN 'Total board attempts'
      ELSE 'Not ranked' END,
    'metricValue',app_private.comparison_metric(
      g.slug,r.outcome,r.attempts,r.completion_time_ms,r.metrics
    )
  )
  FROM public.game_results r
  JOIN public.puzzles p ON p.id=r.puzzle_id
  JOIN public.games g ON g.id=r.game_id
  JOIN public.profiles u ON u.id=r.user_id
  WHERE r.id=p_result AND app_private.comparison_can_view(p_viewer,p.id);
$$;
REVOKE ALL ON FUNCTION public.comparison_public_result(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.comparison_public_result(uuid,uuid)
  TO service_role;

CREATE FUNCTION public.comparison_profile_summary(p_viewer uuid,p_profile uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_games jsonb;v_total integer;v_wins integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_profile) THEN
    RETURN '{"status":"not_found"}'::jsonb;
  END IF;

  WITH visible AS (
    SELECT g.slug,g.name,r.outcome,
      app_private.comparison_metric(
        g.slug,r.outcome,r.attempts,r.completion_time_ms,r.metrics
      ) AS metric_value
    FROM public.game_results r
    JOIN public.games g ON g.id=r.game_id
    WHERE r.user_id=p_profile
      AND app_private.comparison_can_view(p_viewer,r.puzzle_id)
  ), grouped AS (
    SELECT slug,name,count(*)::integer AS recorded,
      count(*) FILTER (WHERE outcome IN ('win','complete'))::integer AS completed,
      min(metric_value) AS best_metric
    FROM visible GROUP BY slug,name
  )
  SELECT (SELECT count(*)::integer FROM visible),
    (SELECT count(*)::integer FROM visible WHERE outcome IN ('win','complete')),
    COALESCE((SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'slug',grouped.slug,'name',grouped.name,
        'visibleResults',grouped.recorded,'completed',grouped.completed,
        'bestMetric',grouped.best_metric
      ) ORDER BY grouped.name,grouped.slug
    ) FROM grouped),'[]'::jsonb)
  INTO v_total,v_wins,v_games;

  RETURN pg_catalog.jsonb_build_object(
    'status','ready','profileId',p_profile,
    'visibleResults',v_total,'visibleWins',v_wins,
    'games',v_games
  );
END;
$$;
REVOKE ALL ON FUNCTION public.comparison_profile_summary(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.comparison_profile_summary(uuid,uuid)
  TO service_role;

CREATE FUNCTION public.comparison_head_to_head(
  p_viewer uuid,p_left uuid,p_right uuid,p_game_slug text,
  p_limit integer,p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_left text;v_right text;v_total integer;v_items jsonb;
BEGIN
  IF p_left IS NULL OR p_right IS NULL OR p_left=p_right
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 5000
     OR (p_game_slug IS NOT NULL AND p_game_slug !~ '^[a-z][a-z0-9-]{1,63}$')
  THEN RETURN '{"status":"invalid_request"}'::jsonb; END IF;
  SELECT display_name INTO v_left FROM public.profiles WHERE id=p_left;
  SELECT display_name INTO v_right FROM public.profiles WHERE id=p_right;
  IF v_left IS NULL OR v_right IS NULL
  THEN RETURN '{"status":"not_found"}'::jsonb; END IF;

  WITH compared AS (
    SELECT p.puzzle_key,p.puzzle_date,p.created_at,p.id,
      g.slug AS game_slug,g.name AS game_name,
      l.outcome AS left_outcome,rr.outcome AS right_outcome,
      app_private.comparison_metric(
        g.slug,l.outcome,l.attempts,l.completion_time_ms,l.metrics
      ) AS left_metric,
      app_private.comparison_metric(
        g.slug,rr.outcome,rr.attempts,rr.completion_time_ms,rr.metrics
      ) AS right_metric
    FROM public.game_results l
    JOIN public.game_results rr ON rr.puzzle_id=l.puzzle_id
      AND rr.user_id=p_right
    JOIN public.puzzles p ON p.id=l.puzzle_id
    JOIN public.games g ON g.id=l.game_id
    WHERE l.user_id=p_left
      AND (p_game_slug IS NULL OR g.slug=p_game_slug)
      AND app_private.comparison_can_view(p_viewer,p.id)
  ), page AS (
    SELECT * FROM compared
    ORDER BY puzzle_date DESC NULLS LAST,created_at DESC,id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT (SELECT count(*)::integer FROM compared),
    COALESCE((SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'gameSlug',page.game_slug,'gameName',page.game_name,
        'puzzleKey',page.puzzle_key,'puzzleDate',page.puzzle_date,
        'leftOutcome',page.left_outcome,'rightOutcome',page.right_outcome,
        'leftMetric',page.left_metric,'rightMetric',page.right_metric,
        'winner',CASE
          WHEN page.left_metric IS NOT NULL AND page.right_metric IS NULL THEN 'left'
          WHEN page.right_metric IS NOT NULL AND page.left_metric IS NULL THEN 'right'
          WHEN page.left_metric IS NULL OR page.right_metric IS NULL THEN NULL
          WHEN page.left_metric < page.right_metric THEN 'left'
          WHEN page.right_metric < page.left_metric THEN 'right'
          ELSE 'tie' END
      ) ORDER BY page.puzzle_date DESC NULLS LAST,page.created_at DESC,page.id
    ) FROM page),'[]'::jsonb)
  INTO v_total,v_items;
  RETURN pg_catalog.jsonb_build_object(
    'status','ready','leftUserId',p_left,'leftName',v_left,
    'rightUserId',p_right,'rightName',v_right,
    'totalVisible',v_total,'items',v_items
  );
END;
$$;
REVOKE ALL ON FUNCTION public.comparison_head_to_head(uuid,uuid,uuid,text,integer,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.comparison_head_to_head(uuid,uuid,uuid,text,integer,integer)
  TO service_role;

COMMIT;
