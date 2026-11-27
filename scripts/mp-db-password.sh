#!/usr/bin/env bash
# Set or rotate the MealPlanner MySQL password (from Mory) in both places it's used:
#   .env (local `npm run mp:pull`) and the MP_DB_PASSWORD Supabase secret (mp-db edge function).
# Tests the new password against the DB first; nothing is changed if it doesn't work.
# The password is never put on a command line (it goes through 0600 temp files only).
set -euo pipefail
cd "$(dirname "$0")/.."

read -rsp "MealPlanner password: " PW; echo
[ -n "$PW" ] || { echo "Empty password, aborting." >&2; exit 1; }
case "$PW" in *"'"*) echo "Password contains a single quote; set it by hand in .env and supabase secrets." >&2; exit 1;; esac

umask 077
tmp=$(mktemp); trap 'rm -f "$tmp" "$tmp.env"' EXIT
printf "MP_DB_PASSWORD='%s'\n" "$PW" > "$tmp"

echo "Testing connection..."
MP_DB_PASSWORD="$PW" node scripts/import-mp-db.mjs --live --dry

touch .env
grep -v '^MP_DB_PASSWORD=' .env > "$tmp.env" || true
cat "$tmp" >> "$tmp.env" && cat "$tmp.env" > .env
echo "Saved to .env"

supabase secrets set --env-file "$tmp"
echo "Saved to Supabase secret MP_DB_PASSWORD. Done."
