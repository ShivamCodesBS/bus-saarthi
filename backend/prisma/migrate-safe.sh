#!/bin/sh
# Applies the pending Prisma migrations with a capped connection pool.
#
# The Supabase connection pooler in session mode allows only 15 concurrent
# sessions per project. Prisma's CLI opens several connections of its own,
# and an uncapped pool made the deploy fail with:
#
#   FATAL: (EMAXCONNSESSION) max clients reached in session mode
#
# Appending `connection_limit` to the URL keeps every connection inside the
# limit. The pool size can be overridden with DATABASE_POOL_SIZE.
set -e

POOL_SIZE="${DATABASE_POOL_SIZE:-5}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

# Only add the limit if the URL does not already carry one.
case "$DATABASE_URL" in
  *connection_limit=*) ;;
  *)
    if echo "$DATABASE_URL" | grep -q '?'; then
      DATABASE_URL="${DATABASE_URL}&connection_limit=${POOL_SIZE}&pool_timeout=30"
    else
      DATABASE_URL="${DATABASE_URL}?connection_limit=${POOL_SIZE}&pool_timeout=30"
    fi
    export DATABASE_URL
    ;;
esac

echo "Applying migrations with a pool of ${POOL_SIZE} connection(s)…"
npx prisma migrate deploy
