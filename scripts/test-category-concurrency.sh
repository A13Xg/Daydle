#!/usr/bin/env bash
# Test two admin category replacements on a game without existing links.
# Execute only within the disposable PostgreSQL test harness.
set -euo pipefail
: "$PGDATABASE"

log_file=$(mktemp)
cleanup() { rm -f "$log_file"; }
trap cleanup EXIT

# Transaction A inserts "word" and holds the parent row lock until commit.
psql -X -v ON_ERROR_STOP=1 >"$log_file" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
SELECT public.admin_set_game_categories(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ARRAY['word']
);
\echo CATEGORY_FIRST_WRITER_READY
SELECT pg_sleep(3);
COMMIT;
SQL
first_pid=$!

ready=0
for attempt in $(seq 1 100); do
  if grep -q '^CATEGORY_FIRST_WRITER_READY$' "$log_file"; then
    ready=1
    break
  fi
  if ! kill -0 "$first_pid" 2>/dev/null; then
    break
  fi
  sleep 0.05
done

if [[ "$ready" -ne 1 ]]; then
  cat "$log_file" >&2
  wait "$first_pid" || true
  echo "First category writer never reached the synchronization point" >&2
  exit 1
fi

# B must wait for A to commit before replacing word with numbers.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
SELECT public.admin_set_game_categories(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ARRAY['numbers']
);
COMMIT;
SQL

wait "$first_pid"

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.game_category_links l
  JOIN public.game_categories c ON c.id=l.category_id
  WHERE l.game_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND c.slug='numbers';
  IF n <> 1 OR (
    SELECT count(*) FROM public.game_category_links
    WHERE game_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ) <> 1 THEN
    RAISE EXCEPTION 'Concurrent category replacements did not serialize';
  END IF;
END $$;
SELECT 'PASS: concurrent category replacements serialize' AS test_summary;
SQL
