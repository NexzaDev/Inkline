#!/usr/bin/env bash
set -uo pipefail

title="${1:?a title is required}"
shift

payload="$(printf '%s' "$*" | sed -e 's/%/%25/g' -e 's/\r/%0D/g' | awk 'NF {printf "%s%%0A", $0}')"

echo "::notice title=${title}::${payload:0:6000}"
