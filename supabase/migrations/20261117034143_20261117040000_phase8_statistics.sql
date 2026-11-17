-- Phase 8: complete-dataset personal statistics read model.
-- Service-only, private, on-demand aggregates; never read raw submissions.
BEGIN;

CREATE FUNCTION public.my_personal_statistics(
  p_user uuid,
  p_timezone text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_summary jsonb;
BEGIN
  IF p_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user
  ) OR p_timezone IS NULL OR length(p_timezone) NOT BETWEEN 1 AND 64
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone
    )
  THEN
    RAISE EXCEPTION 'invalid_personal_statistics_request'
      USING ERRCODE = '22023';
  END IF;

  WITH activity_days AS (
    SELECT DISTINCT (r.submitted_at AT TIME ZONE p_timezone)::date AS activity_day
    FROM public.game_results r
    WHERE r.user_id = p_user
  ),
  ordered_days AS (
    SELECT activity_day,
      activity_day - (row_number() OVER (ORDER BY activity_day))::integer AS island
    FROM activity_days
  ),
  streaks AS (
    SELECT min(activity_day) AS started_on,
      max(activity_day) AS ended_on,
      count(*)::integer AS days
    FROM ordered_days
    GROUP BY island
  ),
  per_game AS (
    SELECT r.game_id, g.slug, g.name,
      count(*)::integer AS recorded,
      count(*) FILTER (WHERE r.outcome IN ('win','complete'))::integer AS completed,
      count(*) FILTER (WHERE r.outcome = 'loss')::integer AS lost,
      count(*) FILTER (WHERE r.outcome = 'incomplete' OR r.outcome IS NULL)::integer AS incomplete,
      min(r.attempts) FILTER (
        WHERE r.outcome IN ('win','complete') AND r.attempts >= 1
      ) AS best_attempts,
      min(r.completion_time_ms) FILTER (
        WHERE r.outcome IN ('win','complete')
      ) AS best_time_ms
    FROM public.game_results r
    JOIN public.games g ON g.id = r.game_id
    WHERE r.user_id = p_user
    GROUP BY r.game_id,g.slug,g.name
  )
  SELECT pg_catalog.jsonb_build_object(
    'timezone', p_timezone,
    'totalResults', (SELECT count(*)::integer FROM public.game_results r WHERE r.user_id = p_user),
    'gamesRecorded', (SELECT count(*)::integer FROM per_game),
    'daysActive', (SELECT count(*)::integer FROM activity_days),
    'longestStreak', (SELECT coalesce(max(days),0)::integer FROM streaks),
    'currentStreak', (
      SELECT coalesce(max(days),0)::integer
      FROM streaks
      WHERE ended_on >= (pg_catalog.now() AT TIME ZONE p_timezone)::date - 1
    ),
    'activityDays', (
      SELECT coalesce(pg_catalog.jsonb_agg(d.activity_day ORDER BY d.activity_day),'[]'::jsonb)
      FROM (
        SELECT activity_day FROM activity_days ORDER BY activity_day DESC LIMIT 366
      ) d
    ),
    'activityDaysTruncated', (SELECT count(*) > 366 FROM activity_days),
    'games', (
      SELECT coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'slug', pg.slug,
          'name', pg.name,
          'recorded', pg.recorded,
          'completed', pg.completed,
          'lost', pg.lost,
          'incomplete', pg.incomplete,
          'completionRate',
            CASE WHEN pg.completed + pg.lost = 0 THEN NULL
            ELSE pg.completed::numeric / (pg.completed + pg.lost) END,
          'bestAttempts', pg.best_attempts,
          'bestTimeMs', pg.best_time_ms,
          'attemptsDistribution', (
            SELECT coalesce(pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'attempts', distribution.attempts,
                'count', distribution.amount
              ) ORDER BY distribution.attempts
            ),'[]'::jsonb)
            FROM (
              SELECT r.attempts, count(*)::integer AS amount
              FROM public.game_results r
              WHERE r.user_id = p_user AND r.game_id = pg.game_id
                AND r.outcome IN ('win','complete') AND r.attempts >= 1
              GROUP BY r.attempts
            ) distribution
          )
        ) ORDER BY pg.name,pg.slug
      ),'[]'::jsonb)
      FROM per_game pg
    )
  ) INTO v_summary;

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.my_personal_statistics(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.my_personal_statistics(uuid,text)
  TO service_role;

COMMIT;
