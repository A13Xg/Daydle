-- Phase 5: explicit, owner-private manual played markers.
-- These are NOT parsed game results, puzzle identifiers or achievement records.
BEGIN;

CREATE TABLE public.user_game_day_marks (
  user_id uuid NOT NULL,
  game_id uuid NOT NULL,
  local_date date NOT NULL CHECK (local_date >= DATE '2000-01-01'),
  marked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id, local_date),
  CONSTRAINT user_day_mark_selected_game_fk
    FOREIGN KEY (user_id, game_id) REFERENCES public.user_games(user_id, game_id)
    ON DELETE CASCADE
);
CREATE INDEX user_game_day_marks_user_date_idx
  ON public.user_game_day_marks(user_id, local_date DESC);

ALTER TABLE public.user_game_day_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_game_day_marks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_game_day_marks TO authenticated;
GRANT ALL ON public.user_game_day_marks TO service_role;

CREATE POLICY user_game_day_marks_owner_select ON public.user_game_day_marks
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_game_day_marks_owner_insert ON public.user_game_day_marks
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_game_day_marks_owner_delete ON public.user_game_day_marks
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Intentionally no UPDATE policy or grant. One marker represents only the
-- user's explicitly toggled "played" flag on their own local day. A change
-- of date requires delete+insert, not silent mutation.
COMMIT;
