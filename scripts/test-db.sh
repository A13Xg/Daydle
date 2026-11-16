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
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/bootstrap.sql
  for migration in supabase/migrations/*.sql; do
    echo "Applying migration: $migration"
    psql -X -v ON_ERROR_STOP=1 -f "$migration"
  done
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/fixtures.sql
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/assertions.sql
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/auth-assertions.sql
  psql -X -v ON_ERROR_STOP=1 -f tests/sql/catalog-assertions.sql
  bash scripts/test-category-concurrency.sh
done

echo "PASS: All Daydle schema, RLS, auth identity and catalog tests passed on two clean databases."
