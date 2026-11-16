#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGROOT="$DIR/.pgsql"
export LD_LIBRARY_PATH="$PGROOT/usr/lib:/usr/lib"
export PATH="$PGROOT/usr/bin:$PATH"

if [ ! -d "$DIR/.pgdata" ]; then
  mkdir -p "$DIR/.pgdata"
  initdb -D "$DIR/.pgdata" --auth=trust -U postgres -E UTF8 --no-locale
fi

exec postgres -D "$DIR/.pgdata" -p 5432 -k /tmp
