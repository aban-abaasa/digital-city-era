#!/usr/bin/env bash
# Runs the IcanEra Mobile / Card and Digital Card database tests against a throwaway Postgres database.
#
#   backend/database/tests/imc_payments/run.sh
#
# Needs a Postgres 14+ you can create databases and roles in, and psql on the PATH. Connection comes from the
# usual libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD); nothing here touches your real Supabase project.
#   KEEP_DB=1   keep the database afterwards so you can look around
#   DB_NAME=x   use another database name (default dce_imc_test)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATION="$HERE/../../migrations/ADD_ICAN_MOBILE_CARD_PAYMENTS.sql"
CARD_MIGRATION="$HERE/../../migrations/ADD_ICAN_CARD_POS_PAYMENTS.sql"
DB="${DB_NAME:-dce_imc_test}"
WORK="$(mktemp -d)"
trap '[ "${KEEP_DB:-0}" = "1" ] || psql -X -q -d postgres -c "DROP DATABASE IF EXISTS \"$DB\"" >/dev/null 2>&1; rm -rf "$WORK"' EXIT

psql_db() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

psql -X -q -d postgres -c "DROP DATABASE IF EXISTS \"$DB\"" -c "CREATE DATABASE \"$DB\"" >/dev/null
psql_db -f "$HERE/00_stub.sql" >/dev/null 2>"$WORK/stub.err" || { grep -v NOTICE "$WORK/stub.err" >&2; echo "stub failed" >&2; exit 2; }
psql_db -f "$MIGRATION" >/dev/null 2>"$WORK/mig.err" || { grep -v NOTICE "$WORK/mig.err" >&2; echo "migration failed" >&2; exit 2; }
echo "migration applied. re-applying to prove it is safe to run twice..."
psql_db -f "$MIGRATION" >/dev/null 2>&1 || { echo "re-applying the migration FAILED" >&2; exit 1; }

# The Digital Card migration builds on the Mobile / Card one and on the ICAN repo's digital card table (stubbed).
psql_db -f "$HERE/00b_card_stub.sql" >/dev/null 2>"$WORK/stub2.err" || { grep -v NOTICE "$WORK/stub2.err" >&2; echo "card stub failed" >&2; exit 2; }
psql_db -f "$CARD_MIGRATION" >/dev/null 2>"$WORK/mig2.err" || { grep -v NOTICE "$WORK/mig2.err" >&2; echo "card migration failed" >&2; exit 2; }
echo "card migration applied. re-applying to prove it is safe to run twice..."
psql_db -f "$CARD_MIGRATION" >/dev/null 2>&1 || { echo "re-applying the card migration FAILED" >&2; exit 1; }

psql_db -f "$HERE/01_imc.sql" >/dev/null 2>"$WORK/test.err" || { grep -v NOTICE "$WORK/test.err" >&2; echo "01_imc.sql aborted" >&2; exit 1; }
psql_db -f "$HERE/02_card.sql" >/dev/null 2>"$WORK/test2.err" || { grep -v NOTICE "$WORK/test2.err" >&2; echo "02_card.sql aborted" >&2; exit 1; }

# An administrator's configured origin must survive a re-run of the migration.
psql_db -c "UPDATE public.guest_checkout_config SET value = 'https://shop.example.test' WHERE key = 'pos_pay_base_url'" >/dev/null
psql_db -f "$MIGRATION" >/dev/null 2>&1
kept=$(psql_db -Atc "SELECT value FROM public.guest_checkout_config WHERE key = 'pos_pay_base_url'")
[ "$kept" = "https://shop.example.test" ] || { echo "re-applying the migration overwrote the configured origin ($kept)" >&2; exit 1; }
echo "a configured origin survives a re-run."

read -r passed failed total <<<"$(psql_db -At -F ' ' -c "select count(*) filter (where ok), count(*) filter (where not ok), count(*) from t.results" 2>/dev/null || echo '0 0 0')"
if [ "${failed:-0}" != "0" ] || [ "${total:-0}" = "0" ]; then
  psql_db -c "select name, left(info, 300) as detail from t.results where not ok order by n" 2>/dev/null || true
  echo "FAILED: $failed of $total checks" >&2; exit 1
fi
echo "OK: $passed of $total database checks passed."
