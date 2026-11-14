-- Deterministic identities; test data only. The Phase 3 auth trigger
-- atomically creates each profile and cryptographically random friend code.
INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
 ('11111111-1111-1111-1111-111111111111', 'one@example.invalid', '{"display_name":"One"}'),
 ('22222222-2222-2222-2222-222222222222', 'two@example.invalid', '{"full_name":"Two"}'),
 ('33333333-3333-3333-3333-333333333333', 'three@example.invalid', '{}');

INSERT INTO public.game_categories(id, slug, name) VALUES
 ('12121212-1212-1212-1212-121212121212', 'word', 'Word games');

INSERT INTO public.games(id, slug, name, canonical_url) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'wordle', 'Wordle', 'https://www.nytimes.com/games/wordle/index.html'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'demo', 'Demo', 'https://example.org/daily');

INSERT INTO public.game_category_links(game_id, category_id) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '12121212-1212-1212-1212-121212121212');

INSERT INTO public.user_games(user_id, game_id, sort_order) VALUES
 ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1);

INSERT INTO public.puzzles(id, game_id, puzzle_key, puzzle_date, released_at, reset_verified_at) VALUES
 ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'wordle-100', CURRENT_DATE, now() - interval '10 hours', NULL),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'wordle-99', CURRENT_DATE - 1, now() - interval '48 hours', now() - interval '24 hours'),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'demo-1', CURRENT_DATE, now() - interval '1 hour', NULL);

INSERT INTO public.game_results(id, user_id, game_id, puzzle_id, outcome, attempts, metrics, parser_version) VALUES
 ('f1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc', 'win', 4, '{"guesses":4}', '1.0.0'),
 ('f2222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dddddddd-dddd-dddd-dddd-dddddddddddd', 'win', 3, '{"guesses":3}', '1.0.0');

INSERT INTO public.raw_submissions(id, user_id, game_id, result_id, raw_share_text, disposition) VALUES
 ('91111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'f1111111-1111-1111-1111-111111111111', 'Wordle 100 4/6', 'accepted');

INSERT INTO public.raw_submissions(
  id, user_id, raw_share_text, disposition, received_at, expires_at
) VALUES (
 '92222222-2222-2222-2222-222222222222',
 '11111111-1111-1111-1111-111111111111',
 'Unknown old result', 'unsupported',
 now() - interval '100 days', now() - interval '10 days'
);

INSERT INTO public.friendships(user_low, user_high) VALUES
 ('11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222');

INSERT INTO public.blocks(blocker_id, blocked_id) VALUES
 ('33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222');

INSERT INTO public.achievement_definitions(id, code, name) VALUES
 ('31313131-3131-3131-3131-313131313131', 'first_win', 'First win'),
 ('32323232-3232-3232-3232-323232323232', 'three_games', 'Three games');

INSERT INTO public.user_achievements(user_id, achievement_id, source_puzzle_id, visible_after) VALUES
 ('11111111-1111-1111-1111-111111111111',
  '31313131-3131-3131-3131-313131313131',
  'cccccccc-cccc-cccc-cccc-cccccccccccc', now() - interval '1 hour'),
 ('11111111-1111-1111-1111-111111111111',
  '32323232-3232-3232-3232-323232323232',
  'dddddddd-dddd-dddd-dddd-dddddddddddd', now() - interval '1 hour');

INSERT INTO public.game_suggestions(id, suggested_by, name, url) VALUES
 ('41414141-4141-4141-4141-414141414141',
  '11111111-1111-1111-1111-111111111111', 'Puzzle Example',
  'https://example.org/puzzle');

INSERT INTO public.suggestion_votes(suggestion_id, user_id) VALUES
 ('41414141-4141-4141-4141-414141414141',
  '22222222-2222-2222-2222-222222222222');
