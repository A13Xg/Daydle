#!/usr/bin/env bash
# Exercise concurrent connect/connect and block/connect on disposable PG17.
# Never run against hosted Supabase.
set -euo pipefail
: "${PGDATABASE:?Disposable PGDATABASE required}"
first_log=$(mktemp)
trap 'rm -f "$first_log"' EXIT

alice='11111111-1111-1111-1111-111111111111'
carol='33333333-3333-3333-3333-333333333333'
alice_code=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT code FROM public.friend_codes WHERE user_id='$alice'")
carol_code=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT code FROM public.friend_codes WHERE user_id='$carol'")
[[ "$alice_code" =~ ^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$ ]] || exit 1
[[ "$carol_code" =~ ^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$ ]] || exit 1

wait_ready() {
  local pid="$1" marker="$2"
  for attempt in $(seq 1 100); do
    if grep -q "^$marker$" "$first_log"; then return 0; fi
    if ! kill -0 "$pid" 2>/dev/null; then break; fi
    sleep 0.05
  done
  cat "$first_log" >&2
  wait "$pid" || true
  echo "Social transaction did not become ready: $marker" >&2
  exit 1
}

# First transaction makes the relationship, holds the pair advisory lock,
# then the second transaction must observe the committed row as idempotent.
psql -X -v ON_ERROR_STOP=1 -v code="$carol_code" >"$first_log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.social_connect_by_code('$alice', :'code')->>'status';
\echo CONNECT_READY
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!
wait_ready "$first_pid" CONNECT_READY
second=$(psql -X -qAt -v ON_ERROR_STOP=1 -v code="$alice_code" <<SQL
SET ROLE service_role;
SELECT public.social_connect_by_code('$carol', :'code')->>'status';
SQL
)
wait "$first_pid"
if [[ "$second" != already_connected ]]; then
  echo "Simultaneous connect was not idempotent: '$second'" >&2
  exit 1
fi
count=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.friendships WHERE user_low='$alice' AND user_high='$carol'")
[[ "$count" == 1 ]] || { echo "Expected one symmetric friendship, got $count" >&2; exit 1; }

# A block and a concurrent attempt to connect must serialize on the same pair.
: >"$first_log"
psql -X -v ON_ERROR_STOP=1 >"$first_log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.social_change_relation('$alice','$carol','block')->>'status';
\echo BLOCK_READY
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!
wait_ready "$first_pid" BLOCK_READY
second=$(psql -X -qAt -v ON_ERROR_STOP=1 -v code="$alice_code" <<SQL
SET ROLE service_role;
SELECT public.social_connect_by_code('$carol', :'code')->>'status';
SQL
)
wait "$first_pid"
if [[ "$second" != unavailable ]]; then
  echo "Blocked concurrent connection was accepted: '$second'" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
 IF EXISTS (SELECT 1 FROM public.friendships WHERE user_low='$alice' AND user_high='$carol')
    OR NOT EXISTS (SELECT 1 FROM public.blocks WHERE blocker_id='$alice' AND blocked_id='$carol')
 THEN RAISE EXCEPTION 'Friendship race violated block atomicity'; END IF;
END \$\$;
SQL

echo "PASS: Phase 9 concurrent connects dedupe; block wins the serialized pair"
