#!/usr/bin/env bash
# Two concurrent service-role saves for the same user/puzzle must dedupe.
# Use exclusively within a disposable database from test-db.sh.
set -euo pipefail
: "$PGDATABASE"
log=$(mktemp)
trap 'rm -f "$log"' EXIT

psql -X -v ON_ERROR_STOP=1 >"$log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.ingest_parsed_share(
 '11111111-1111-1111-1111-111111111111','Wordle 987654 3/6',
 '{"gameSlug":"wordle","puzzleKey":"wordle:number:987654","puzzleDate":null,"outcome":"win",
   "attempts":3,"score":null,"completionTimeMs":null,"metrics":{"hardMode":false},
   "parserVersion":"1.0.0","formatVersion":"wordle-v1"}'::jsonb
);
\echo FIRST_RESULT_READY
SELECT pg_sleep(3);
COMMIT;
SQL
first_pid=$!
ready=0
for attempt in $(seq 1 100); do
  if grep -q '^FIRST_RESULT_READY$' "$log"; then ready=1; break; fi
  if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
  sleep 0.05
done
if [[ "$ready" != 1 ]]; then
  cat "$log" >&2
  wait "$first_pid" || true
  echo "First result writer was not ready" >&2
  exit 1
fi

second=$(psql -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE service_role;
SELECT public.ingest_parsed_share(
 '11111111-1111-1111-1111-111111111111','Wordle 987654 3/6',
 '{"gameSlug":"wordle","puzzleKey":"wordle:number:987654","puzzleDate":null,"outcome":"win",
   "attempts":3,"score":null,"completionTimeMs":null,"metrics":{"hardMode":false},
   "parserVersion":"1.0.0","formatVersion":"wordle-v1"}'::jsonb
)->>'status';
SQL
)
wait "$first_pid"
if [[ "$second" != duplicate ]]; then
  echo "Concurrent replay returned '$second' instead of duplicate" >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE n integer; raw_count integer; audit_count integer;
BEGIN
  SELECT count(*) INTO n FROM public.game_results r
    JOIN public.puzzles p ON p.id=r.puzzle_id
    WHERE p.puzzle_key='wordle:number:987654'
    AND r.user_id='11111111-1111-1111-1111-111111111111';
  SELECT count(*) INTO raw_count FROM public.raw_submissions raw
    JOIN public.game_results r ON r.id=raw.result_id
    JOIN public.puzzles p ON p.id=r.puzzle_id
    WHERE p.puzzle_key='wordle:number:987654';
  SELECT count(*) INTO audit_count FROM app_private.result_events e
    JOIN public.puzzles p ON p.id=e.puzzle_id
    WHERE p.puzzle_key='wordle:number:987654' AND e.action='saved';
  IF n<>1 OR raw_count<>1 OR audit_count<>1 THEN
    RAISE EXCEPTION 'Concurrent duplicate produced % results, % raws, % audit events',
      n,raw_count,audit_count;
  END IF;
END $$;
SELECT 'PASS: concurrent results deduplicate transactionally' AS test_summary;
SQL
