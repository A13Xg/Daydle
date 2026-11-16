-- Phase 4: curated external-game catalog and owner-only selections.
-- Forward-only: Phase 2/3 migrations may have already been deployed.
BEGIN;

CREATE FUNCTION app_private.safe_publisher_url(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT value IS NOT NULL
    AND pg_catalog.length(value) <= 2048
    AND value ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(/[^\s]*)?(\?[^\s]*)?(#[^\s]*)?$'
    AND value !~ '[@[:space:]]'
    AND value !~ '^https://(localhost|127\.|0\.|10\.|192\.168\.|172\.)';
$$;

ALTER TABLE public.games
  ADD COLUMN link_status text NOT NULL DEFAULT 'unverified'
    CHECK (link_status IN ('unverified', 'verified', 'broken')),
  ADD COLUMN link_checked_at timestamptz,
  ADD CONSTRAINT games_https_publisher_url
    CHECK (app_private.safe_publisher_url(canonical_url)),
  ADD CONSTRAINT games_https_icon_url
    CHECK (icon_url IS NULL OR app_private.safe_publisher_url(icon_url)),
  ADD CONSTRAINT games_link_check_consistency
    CHECK (link_status = 'unverified' OR link_checked_at IS NOT NULL);

-- The catalog is a set of stable identities, not a parser registry. All initial
-- entries remain unsupported by Daydle's result parser until Phase 6.
INSERT INTO public.game_categories (id, slug, name) VALUES
  ('50000000-0000-4000-8000-000000000001','word','Words'),
  ('50000000-0000-4000-8000-000000000002','connections','Connections'),
  ('50000000-0000-4000-8000-000000000003','geography','Geography'),
  ('50000000-0000-4000-8000-000000000004','numbers','Numbers'),
  ('50000000-0000-4000-8000-000000000005','movies','Movies'),
  ('50000000-0000-4000-8000-000000000006','crossword','Crosswords')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.games
  (id,slug,name,description,publisher,canonical_url,status,cadence,parser_status,link_status)
VALUES
 ('40000000-0000-4000-8000-000000000001','wordle','Wordle','Guess the five-letter word in six tries.','The New York Times','https://www.nytimes.com/games/wordle/index.html','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000002','connections','Connections','Find four groups of related words.','The New York Times','https://www.nytimes.com/games/connections','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000003','strands','Strands','Find themed words on a letter grid.','The New York Times','https://www.nytimes.com/games/strands','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000004','spelling-bee','Spelling Bee','Make as many valid words as possible from seven letters.','The New York Times','https://www.nytimes.com/puzzles/spelling-bee','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000005','mini-crossword','The Mini','A short daily crossword puzzle.','The New York Times','https://www.nytimes.com/crosswords/game/mini','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000006','quordle','Quordle','Solve four word puzzles with shared guesses.','Merriam-Webster','https://www.merriam-webster.com/games/quordle/','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000007','worldle','Worldle','Identify the country or territory from its silhouette.','Teuteuf Games','https://worldle.teuteuf.fr/','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000008','flagle','Flagle','Guess the mystery flag and country.','Teuteuf Games','https://www.flagle.io/','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000009','globle','Globle','Find the mystery country using a heatmap on the globe.','Trainwreck Labs','https://globle-game.com/','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000010','nerdle','Nerdle','Guess the daily mathematical equation.','Nerdle','https://nerdlegame.com/','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000011','waffle','Waffle','Rearrange letters into crossing words.','Waffle Studio','https://wafflegame.net/','active','daily','unsupported','unverified'),
 ('40000000-0000-4000-8000-000000000012','framed','Framed','Identify the film using a series of still frames.','Framed','https://framed.wtf/','active','daily','unsupported','unverified')
ON CONFLICT (slug) DO NOTHING;

-- Resolve association by slug to avoid tying data to a surrogate ID if a
-- pre-existing game had already claimed a stable slug.
INSERT INTO public.game_category_links(game_id,category_id)
SELECT g.id,c.id
FROM (VALUES
 ('wordle','word'),('connections','connections'),('connections','word'),
 ('strands','word'),('spelling-bee','word'),('mini-crossword','crossword'),
 ('mini-crossword','word'),('quordle','word'),('worldle','geography'),
 ('flagle','geography'),('globle','geography'),('nerdle','numbers'),
 ('waffle','word'),('framed','movies')
) AS pairs(game_slug, category_slug)
JOIN public.games g ON g.slug=pairs.game_slug
JOIN public.game_categories c ON c.slug=pairs.category_slug
ON CONFLICT DO NOTHING;

CREATE FUNCTION app_private.catalog_admin_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM app_private.admin_members m WHERE m.user_id=auth.uid()
 );
$$;

-- Authenticated, authorization-checked RPC; direct catalog table mutations
-- are NOT granted to browser roles.
CREATE FUNCTION public.admin_save_game(
  p_id uuid, p_slug text, p_name text, p_url text,
  p_description text DEFAULT '',
  p_publisher text DEFAULT NULL,
  p_cadence text DEFAULT 'daily',
  p_status text DEFAULT 'active',
  p_link_status text DEFAULT 'unverified'
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE saved_id uuid;
BEGIN
 IF NOT app_private.catalog_admin_allowed() THEN
   RAISE EXCEPTION 'Not authorized for catalog administration' USING ERRCODE='42501';
 END IF;
 IF NOT app_private.safe_publisher_url(p_url) THEN
   RAISE EXCEPTION 'Invalid publisher URL' USING ERRCODE='22023';
 END IF;
 IF p_id IS NULL THEN
   INSERT INTO public.games(slug,name,description,publisher,canonical_url,cadence,status,link_status,link_checked_at,parser_status)
   VALUES(p_slug,p_name,p_description,p_publisher,p_url,p_cadence,p_status,p_link_status,
          CASE WHEN p_link_status='unverified' THEN NULL ELSE pg_catalog.now() END,
          'unsupported')
   RETURNING id INTO saved_id;
 ELSE
   UPDATE public.games
      SET name=p_name, description=p_description, publisher=p_publisher,
          canonical_url=p_url, cadence=p_cadence,status=p_status,
          link_status=p_link_status,
          link_checked_at=CASE WHEN p_link_status='unverified' THEN NULL ELSE pg_catalog.now() END,
          updated_at=pg_catalog.now()
    WHERE id=p_id AND slug=p_slug
   RETURNING id INTO saved_id;
   IF saved_id IS NULL THEN
     RAISE EXCEPTION 'Game does not exist or stable slug mismatch' USING ERRCODE='22023';
   END IF;
 END IF;
 RETURN saved_id;
END;
$$;

CREATE FUNCTION public.admin_set_game_categories(p_game_id uuid,p_category_slugs text[])
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE names text[];
BEGIN
 IF NOT app_private.catalog_admin_allowed() THEN
   RAISE EXCEPTION 'Not authorized for catalog administration' USING ERRCODE='42501';
 END IF;
 names:=COALESCE(p_category_slugs,ARRAY[]::text[]);
 IF pg_catalog.cardinality(names)>20
    OR (SELECT count(*) FROM pg_catalog.unnest(names) s) <> (SELECT count(DISTINCT s) FROM pg_catalog.unnest(names) s)
    OR (SELECT count(*) FROM public.game_categories c WHERE c.slug=ANY(names)) <> pg_catalog.cardinality(names)
    OR NOT EXISTS (SELECT 1 FROM public.games WHERE id=p_game_id)
 THEN RAISE EXCEPTION 'Invalid category assignment' USING ERRCODE='22023'; END IF;

 DELETE FROM public.game_category_links WHERE game_id=p_game_id;
 INSERT INTO public.game_category_links(game_id,category_id)
 SELECT p_game_id,id FROM public.game_categories WHERE slug=ANY(names);
END;
$$;

CREATE FUNCTION public.admin_retire_game(p_game_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT app_private.catalog_admin_allowed() THEN
   RAISE EXCEPTION 'Not authorized for catalog administration' USING ERRCODE='42501';
 END IF;
 UPDATE public.games SET status='retired',updated_at=pg_catalog.now() WHERE id=p_game_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Unknown game' USING ERRCODE='22023';
 END IF;
END;
$$;

-- Atomic replace of one person's ordered favorites. A per-user transaction
-- lock makes overlapping app requests serialize; any invalid game aborts the
-- *entire* change. Retired/broken entries already saved may be preserved.
CREATE FUNCTION public.set_my_games(p_game_ids uuid[])
RETURNS TABLE(game_id uuid,sort_order integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE account_id uuid;
DECLARE ids uuid[];
BEGIN
 account_id:=auth.uid();
 IF account_id IS NULL THEN
   RAISE EXCEPTION 'Sign in to select games' USING ERRCODE='42501';
 END IF;
 ids:=COALESCE(p_game_ids, ARRAY[]::uuid[]);
 IF pg_catalog.cardinality(ids)>100
    OR pg_catalog.array_position(ids,NULL) IS NOT NULL
    OR (SELECT count(*) FROM pg_catalog.unnest(ids) s)<>(SELECT count(DISTINCT s) FROM pg_catalog.unnest(ids) s)
 THEN RAISE EXCEPTION 'Invalid ordered selection' USING ERRCODE='22023'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daydle:games:'||account_id::text,0));

 IF EXISTS (
   SELECT 1 FROM pg_catalog.unnest(ids) AS requested(id)
   LEFT JOIN public.games g ON g.id=requested.id
   LEFT JOIN public.user_games saved ON saved.user_id=account_id AND saved.game_id=requested.id
   WHERE g.id IS NULL OR ((g.status<>'active' OR g.link_status='broken') AND saved.game_id IS NULL)
 ) THEN RAISE EXCEPTION 'Unavailable or unknown game in selection' USING ERRCODE='22023'; END IF;

 DELETE FROM public.user_games ug WHERE ug.user_id=account_id AND NOT(ug.game_id=ANY(ids));

 INSERT INTO public.user_games(user_id,game_id,sort_order)
 SELECT account_id,t.id,(t.ordinality-1)::integer
 FROM pg_catalog.unnest(ids) WITH ORDINALITY AS t(id,ordinality)
 ON CONFLICT (user_id,game_id) DO UPDATE SET sort_order=EXCLUDED.sort_order;

 RETURN QUERY
 SELECT ug.game_id,ug.sort_order FROM public.user_games ug
 WHERE ug.user_id=account_id ORDER BY ug.sort_order,ug.game_id;
END;
$$;

-- Revoke direct mutations to enforce the transactional selection contract.
REVOKE INSERT,DELETE,UPDATE ON public.user_games FROM authenticated;
REVOKE ALL ON FUNCTION app_private.safe_publisher_url(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION app_private.catalog_admin_allowed() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_save_game(uuid,text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_set_game_categories(uuid,text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_retire_game(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_my_games(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_game(uuid,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_game_categories(uuid,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retire_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_games(uuid[]) TO authenticated;

COMMIT;
