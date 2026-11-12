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

context="$(grep -A 8 -B 2 -E '^error(\[|:)' "$log" | head -n 160)"
selection="$( { printf '%s\n' "$context"; tail -n 60 "$log"; } | awk 'NF && !seen[$0]++' )"
payload="$(printf '%s\n' "$selection" | sed -e 's/\x1b\[[0-9;]*[a-zA-Z]//g' -e 's/%/%25/g' -e 's/\r/%0D/g' | awk 'NF {printf "%s%%0A", $0}')"

echo "::error title=${title}::${payload:0:20000}"

rm -f "$log"
exit "$status"
