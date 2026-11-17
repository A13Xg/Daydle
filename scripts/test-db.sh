#!/usr/bin/env bash
# Executes isolated PostgreSQL 17 integration/security tests in two fresh DBs.
# Runs against a test PostgreSQL instance only. Never point this at production.
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
export PGHOST PGPORT PGUSER

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "PGPASSWORD is required for the isolated database test service." >&2
  exit 2
fi

prefix="daydle_db_${GITHUB_RUN_ID:-local}_$$"
databases=("${prefix}_a" "${prefix}_b")

cleanup() {
  for db in "${databases[@]}"; do
    dropdb --if-exists --force "$db" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

for db in "${databases[@]}"; do
  echo "Testing isolated database: $db"
  createdb "$db"
  export PGDATABASE="$db"
  # Validate the EXACT read-only Management API baseline probe in PG17,
  # first after the Phase 3 schema exists and later with Phase 4/5 present.
  # The aggregate-only probe exposes no test account rows or secrets.
  baseline_probe() {
    local expected="$1"
    local actual
    actual="$(
      node --input-type=module -e '
        import { BASELINE_PROBE_SQL } from "./scripts/ops/reconcile-migration-history.mjs";
        process.stdout.write(BASELINE_PROBE_SQL + ";\n");
      ' | psql -X -v ON_ERROR_STOP=1 -t -A
    )"
    if [[ "$actual" != "$expected" ]]; then
      echo "Read-only baseline catalog probe failed against isolated PG17" >&2
      exit 1
    fi
  }
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/bootstrap.sql
  for migration in supabase/migrations/*.sql; do
    echo "Applying migration: $migration"
    psql -X -v ON_ERROR_STOP=1 -f "$migration"
    if [[ "$migration" == *phase3_auth_identity.sql ]]; then
      baseline_probe "t|t|t|t|t|t|f|f"
      echo "PASS: Phase 2/3 read-only recovery signatures"
    fi
  done
  baseline_probe "t|t|t|t|t|t|t|t"
  echo "PASS: Phase 4/5 schema presence detection"
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/fixtures.sql
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/assertions.sql
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/auth-assertions.sql
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/catalog-assertions.sql
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/today-assertions.sql
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/results-assertions.sql
  bash scripts/test-category-concurrency.sh
  bash scripts/test-result-concurrency.sh
done

echo "PASS: All Daydle schema, RLS, auth identity, catalog, Today and result-lifecycle tests passed on two clean databases."
