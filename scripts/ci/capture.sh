#!/usr/bin/env bash
set -uo pipefail

title="${1:?a title is required}"
shift

log="$(mktemp)"

"$@" >"$log" 2>&1
status=$?

cat "$log"

if [ "$status" -eq 0 ]; then
  rm -f "$log"
  exit 0
fi

selection="$(tail -n 200 "$log")"
payload="$(printf '%s\n' "$selection" | sed -e 's/\x1b\[[0-9;]*[a-zA-Z]//g' -e 's/%/%25/g' -e 's/\r/%0D/g' | awk 'NF {printf "%s%%0A", $0}')"

echo "::error title=${title}::${payload:0:20000}"

rm -f "$log"
exit "$status"
