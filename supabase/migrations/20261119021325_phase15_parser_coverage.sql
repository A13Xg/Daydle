-- Phase 15: enable validated deterministic parser formats for existing catalog games.
-- Forward-only metadata update; no user submissions or historical results changed.
BEGIN;
UPDATE public.games
SET parser_status = 'supported', updated_at = now()
WHERE slug IN ('worldle', 'flagle')
  AND status = 'active'
  AND parser_status = 'unsupported';
COMMIT;
