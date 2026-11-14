-- Daydle Phase 2: canonical domain and mandatory security boundaries.
-- Execute through Supabase migrations as the database owner. Do not run on a live
-- project without reviewing roles, policies and existing objects.
BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  avatar_url text CHECK (avatar_url IS NULL OR avatar_url ~ '^https://'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION app_private.set_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.set_profile_updated_at();

CREATE TABLE public.friend_codes (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  code varchar(5) NOT NULL UNIQUE
    CHECK (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.game_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]{1,63}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]{1,63}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  publisher text,
  canonical_url text NOT NULL CHECK (canonical_url ~ '^https://'),
  icon_url text CHECK (icon_url IS NULL OR icon_url ~ '^https://'),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'retired')),
  cadence text NOT NULL DEFAULT 'daily'
    CHECK (cadence IN ('daily', 'weekly', 'irregular', 'multiple_daily', 'unknown')),
  timezone_name text,
  parser_status text NOT NULL DEFAULT 'unsupported'
    CHECK (parser_status IN ('unsupported', 'experimental', 'supported')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.game_category_links (
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.game_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, category_id)
);
CREATE INDEX game_category_links_category_idx ON public.game_category_links(category_id, game_id);

CREATE TABLE public.user_games (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
CREATE INDEX user_games_user_sort_idx ON public.user_games(user_id, sort_order, added_at);

CREATE TABLE public.puzzles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  puzzle_key text NOT NULL CHECK (char_length(btrim(puzzle_key)) BETWEEN 1 AND 160),
  puzzle_date date,
  released_at timestamptz,
  -- Only set after the publisher's NEXT puzzle reset/release is verified;
  -- NULL explicitly means "not verified" (never infer from calendar days).
  reset_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT puzzles_game_key_unique UNIQUE (game_id, puzzle_key),
  CONSTRAINT puzzles_id_game_unique UNIQUE (id, game_id),
  CONSTRAINT puzzles_reset_order CHECK (
    released_at IS NULL OR reset_verified_at IS NULL OR reset_verified_at > released_at
  )
);
CREATE INDEX puzzles_game_date_idx ON public.puzzles(game_id, puzzle_date DESC);

CREATE TABLE public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  puzzle_id uuid NOT NULL,
  outcome text CHECK (outcome IS NULL OR outcome IN ('win', 'loss', 'complete', 'incomplete')),
  score numeric,
  max_score numeric,
  attempts integer CHECK (attempts IS NULL OR attempts >= 0),
  completion_time_ms bigint CHECK (completion_time_ms IS NULL OR completion_time_ms >= 0),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metrics) = 'object'),
  parser_version text NOT NULL CHECK (char_length(btrim(parser_version)) > 0),
  format_version text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_results_one_user_puzzle UNIQUE (user_id, puzzle_id),
  CONSTRAINT game_results_puzzle_game_fk
    FOREIGN KEY (puzzle_id, game_id) REFERENCES public.puzzles(id, game_id)
);
CREATE INDEX game_results_user_history_idx ON public.game_results(user_id, submitted_at DESC);
CREATE INDEX game_results_puzzle_idx ON public.game_results(puzzle_id, user_id);
CREATE INDEX game_results_game_history_idx ON public.game_results(game_id, submitted_at DESC);

CREATE TABLE public.raw_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  result_id uuid REFERENCES public.game_results(id) ON DELETE CASCADE,
  raw_share_text text NOT NULL CHECK (char_length(raw_share_text) BETWEEN 1 AND 10000),
  disposition text NOT NULL CHECK (disposition IN ('accepted', 'unsupported', 'invalid')),
  parser_diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(parser_diagnostics) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  CONSTRAINT raw_submission_ttl CHECK (
    expires_at > received_at AND expires_at <= received_at + interval '90 days'
  )
);
CREATE INDEX raw_submissions_expiry_idx ON public.raw_submissions(expires_at);

CREATE TABLE public.result_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.game_results(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_payload jsonb NOT NULL CHECK (jsonb_typeof(old_payload) = 'object'),
  new_payload jsonb NOT NULL CHECK (jsonb_typeof(new_payload) = 'object'),
  corrected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX result_corrections_result_idx ON public.result_corrections(result_id, corrected_at);

CREATE TABLE public.friendships (
  user_low uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_low, user_high),
  CHECK (user_low < user_high)
);
CREATE INDEX friendships_high_idx ON public.friendships(user_high, user_low);

CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE public.achievement_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  game_id uuid REFERENCES public.games(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_achievements (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
  source_puzzle_id uuid REFERENCES public.puzzles(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  -- Explicit publication gate: do not disclose unapproved current activity.
  visible_after timestamptz,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE public.game_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  url text NOT NULL CHECK (url ~ '^https://'),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_suggestions_status_idx ON public.game_suggestions(status, created_at DESC);

CREATE TABLE public.suggestion_votes (
  suggestion_id uuid NOT NULL REFERENCES public.game_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, user_id)
);
CREATE INDEX suggestion_votes_user_idx ON public.suggestion_votes(user_id);

CREATE TABLE app_private.admin_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(btrim(action)) BETWEEN 1 AND 120),
  subject_type text NOT NULL CHECK (char_length(btrim(subject_type)) BETWEEN 1 AND 80),
  subject_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SECURITY DEFINER helpers must always qualify every object: no ambient search_path.
-- Function owner (postgres) bypasses RLS to avoid recursive policies. Grant only
-- the minimum read-only helper to app roles.
CREATE FUNCTION app_private.can_view_result(result_owner uuid, target_puzzle uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (auth.uid() IS NOT NULL AND auth.uid() = result_owner)
    OR EXISTS (
      SELECT 1 FROM public.puzzles p
      WHERE p.id = target_puzzle
        AND p.reset_verified_at IS NOT NULL
        AND p.reset_verified_at <= now()
    )
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.game_results own
        WHERE own.puzzle_id = target_puzzle AND own.user_id = auth.uid()
      )
    );
$$;

CREATE FUNCTION app_private.can_view_achievement(
  result_owner uuid, source_puzzle uuid, reveal_at timestamptz
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.uid() IS NOT NULL AND auth.uid() = result_owner)
    OR (
      reveal_at IS NOT NULL
      AND reveal_at <= now()
      AND (
        source_puzzle IS NULL
        OR app_private.can_view_result(result_owner, source_puzzle)
      )
    );
$$;

CREATE FUNCTION app_private.purge_expired_raw_submissions()
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE removed bigint;
BEGIN
  DELETE FROM public.raw_submissions WHERE expires_at <= now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

-- Explicitly enable RLS on every client-addressable table. Private tables
-- are protected by both schema grants and RLS; no user policy permits access.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.admin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.admin_events ENABLE ROW LEVEL SECURITY;

-- Revoke inherited/default object privileges before selective exposure.
REVOKE ALL ON
  public.profiles,
  public.friend_codes,
  public.game_categories,
  public.games,
  public.game_category_links,
  public.user_games,
  public.puzzles,
  public.game_results,
  public.raw_submissions,
  public.result_corrections,
  public.friendships,
  public.blocks,
  public.achievement_definitions,
  public.user_achievements,
  public.game_suggestions,
  public.suggestion_votes
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.profiles, public.games, public.game_categories,
  public.game_category_links, public.user_games, public.puzzles,
  public.game_results, public.achievement_definitions,
  public.user_achievements, public.game_suggestions
TO anon, authenticated;

GRANT SELECT ON public.friend_codes, public.friendships,
  public.blocks, public.suggestion_votes TO authenticated;

-- Authenticated users can update only their own display fields. Identity,
-- friend codes, puzzle metadata, results and analytics are server-owned.
GRANT UPDATE(display_name, avatar_url) ON public.profiles TO authenticated;
GRANT INSERT, DELETE ON public.user_games TO authenticated;
GRANT UPDATE(sort_order) ON public.user_games TO authenticated;

-- Future Worker/server operations use a restricted, server-held secret key.
GRANT ALL ON
  public.profiles,
  public.friend_codes,
  public.game_categories,
  public.games,
  public.game_category_links,
  public.user_games,
  public.puzzles,
  public.game_results,
  public.raw_submissions,
  public.result_corrections,
  public.friendships,
  public.blocks,
  public.achievement_definitions,
  public.user_achievements,
  public.game_suggestions,
  public.suggestion_votes
TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA app_private TO service_role;

GRANT EXECUTE ON FUNCTION app_private.can_view_result(uuid,uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_view_achievement(uuid,uuid,timestamptz)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.purge_expired_raw_submissions()
  TO service_role;

CREATE POLICY profiles_public_read ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profiles_owner_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY friend_codes_own_read ON public.friend_codes
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY games_public_read ON public.games
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY game_categories_public_read ON public.game_categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY game_category_links_public_read ON public.game_category_links
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY user_games_public_read ON public.user_games
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY user_games_owner_insert ON public.user_games
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_games_owner_delete ON public.user_games
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_games_owner_update ON public.user_games
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY puzzles_public_read ON public.puzzles
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY game_results_spoiler_read ON public.game_results
  FOR SELECT TO anon, authenticated
  USING (app_private.can_view_result(user_id, puzzle_id));

CREATE POLICY friendships_member_read ON public.friendships
  FOR SELECT TO authenticated
  USING (user_low = (SELECT auth.uid()) OR user_high = (SELECT auth.uid()));
CREATE POLICY blocks_owner_read ON public.blocks
  FOR SELECT TO authenticated USING (blocker_id = (SELECT auth.uid()));

CREATE POLICY achievements_definitions_public_read ON public.achievement_definitions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY achievements_spoiler_read ON public.user_achievements
  FOR SELECT TO anon, authenticated
  USING (app_private.can_view_achievement(user_id, source_puzzle_id, visible_after));

CREATE POLICY suggestions_public_read ON public.game_suggestions
  FOR SELECT TO anon, authenticated USING (status IN ('pending','approved'));
CREATE POLICY suggestion_votes_own_read ON public.suggestion_votes
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Default function permissions apply to PUBLIC for newly created functions;
-- explicitly revoke them for private and admin functions.
REVOKE ALL ON FUNCTION app_private.purge_expired_raw_submissions() FROM PUBLIC, anon, authenticated;
COMMIT;
