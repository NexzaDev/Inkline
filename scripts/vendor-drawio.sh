#!/usr/bin/env bash
set -euo pipefail

DRAWIO_REPOSITORY="https://github.com/jgraph/drawio"
DRAWIO_VERSION="v32.6.10"
DRAWIO_COMMIT="c72c9a98b7a6ce392556ed04c05e0ff19f43f5c3"
DRAWIO_WEBAPP="src/main/webapp"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDITOR_DIR="$ROOT_DIR/web/editor"
TARGET="$EDITOR_DIR/vendor/drawio"
MANIFEST="$EDITOR_DIR/vendor/manifest.json"
HOOKS_DIR="$EDITOR_DIR/hooks"

BUNDLES=(
  js/bootstrap.js
  js/app.min.js
  js/extensions.min.js
  js/stencils.min.js
  js/shapes-14-6-5.min.js
)

ALLOWLIST=(
  index.html
  favicon.ico
  export-fonts.css
  shortcuts.svg
  styles
  stencils
  shapes
  img
  images
  templates
  math4
  resources/dia.txt
  resources/dia_el.txt
  js/bootstrap.js
  js/main.js
  js/app.min.js
  js/extensions.min.js
  js/stencils.min.js
  js/shapes-14-6-5.min.js
  js/orgchart.min.js
  js/math-print.js
  js/export.js
  js/export-init.js
  js/plantuml
  js/mermaid
  js/elk
  js/gliffy
  js/orgchart
  js/libavoid-js
  js/jszip
)

HOOKS=(
  PreConfig.js
  PostConfig.js
)

SKIPPED_REFERENCES=(
  js/cryptojs/
  js/deflate/
  js/desktop/
  js/diagramly/
  js/embed-static.min.js
  js/embed.dev.js
  js/freehand/
  js/grapheditor/
  js/integrate.min.js
  js/jquery/
  js/mxgraph/
  js/onedrive/
  js/rough/
  js/sanitizer/
  js/simplepeer/
  js/spin/
  js/viewer-static.min.js
  js/viewer.min.js
  js/vsd/
  js/vsdxImporter.js
)

TEMP_PATHS=()

cleanup() {
  for path in "${TEMP_PATHS[@]:-}"; do
    [ -n "$path" ] && rm -rf "$path"
  done
}

trap cleanup EXIT

skips_reference() {
  local candidate="$1" prefix
  for prefix in "${SKIPPED_REFERENCES[@]}"; do
    case "$candidate" in
      "$prefix"*) return 0 ;;
    esac
  done
  return 1
}

fail() {
  printf 'vendor-drawio: %s\n' "$*" >&2
  exit 1
}

hash_tree() {
  local root="$1"
  (
    cd "$root"
    find . -type f -printf '%P\n' | LC_ALL=C sort | while IFS= read -r relative; do
      printf '%s %s\n' "$relative" "$(sha256sum "$relative" | cut -d' ' -f1)"
    done
  )
}

write_manifest() {
  local first=1 relative
  {
    printf '{\n  "version": "%s",\n  "commit": "%s",\n  "files": {\n' "$DRAWIO_VERSION" "$DRAWIO_COMMIT"
    while IFS= read -r relative; do
      if [ "$first" -eq 1 ]; then
        first=0
      else
        printf ',\n'
      fi
      printf '    "%s": "%s"' "$relative" "$(sha256sum "$TARGET/$relative" | cut -d' ' -f1)"
    done < <(cd "$TARGET" && find . -type f -printf '%P\n' | LC_ALL=C sort)
    printf '\n  }\n}\n'
  } >"$MANIFEST"
}

check_tree() {
  local expected actual
  [ -d "$TARGET" ] || fail "no vendored tree at ${TARGET#"$ROOT_DIR"/}"
  [ -f "$MANIFEST" ] || fail "no manifest at ${MANIFEST#"$ROOT_DIR"/}"

  [ "$(cat "$TARGET/VERSION")" = "$DRAWIO_VERSION" ] || fail "VERSION does not name $DRAWIO_VERSION"
  [ "$(cat "$TARGET/COMMIT")" = "$DRAWIO_COMMIT" ] || fail "COMMIT does not name $DRAWIO_COMMIT"

  expected="$(mktemp)"
  actual="$(mktemp)"
  TEMP_PATHS+=("$expected" "$actual")

  awk -F'"' '/^    "/ { printf "%s %s\n", $2, $4 }' "$MANIFEST" >"$expected"
  hash_tree "$TARGET" >"$actual"

  if ! diff -q "$expected" "$actual" >/dev/null; then
    diff "$expected" "$actual" | head -n 20 >&2
    fail "the vendored tree differs from the manifest; re-run without arguments"
  fi
  printf 'vendor-drawio: %s at %s matches the manifest (%s files)\n' \
    "$DRAWIO_VERSION" "$DRAWIO_COMMIT" "$(wc -l <"$actual")"
}

vendor_tree() {
  local work actual path relative missing=0
  work="$(mktemp -d)"
  TEMP_PATHS+=("$work")

  printf 'vendor-drawio: cloning %s at %s\n' "$DRAWIO_REPOSITORY" "$DRAWIO_VERSION"
  git clone --depth 1 --branch "$DRAWIO_VERSION" "$DRAWIO_REPOSITORY" "$work/drawio" >/dev/null 2>&1 ||
    fail "cannot clone $DRAWIO_REPOSITORY at $DRAWIO_VERSION"

  actual="$(git -C "$work/drawio" rev-parse HEAD)"
  [ "$actual" = "$DRAWIO_COMMIT" ] || fail "tag $DRAWIO_VERSION resolves to $actual, expected $DRAWIO_COMMIT"

  rm -rf "$TARGET"
  mkdir -p "$TARGET"

  for path in "${ALLOWLIST[@]}"; do
    [ -e "$work/drawio/$DRAWIO_WEBAPP/$path" ] || fail "$DRAWIO_WEBAPP/$path is not in $DRAWIO_VERSION"
    mkdir -p "$TARGET/$(dirname "$path")"
    cp -a "$work/drawio/$DRAWIO_WEBAPP/$path" "$TARGET/$path"
  done

  for path in "${HOOKS[@]}"; do
    cp "$HOOKS_DIR/$path" "$TARGET/js/$path"
  done

  for relative in "${BUNDLES[@]}"; do
    while IFS= read -r path; do
      [ -e "$TARGET/$path" ] && continue
      [ -e "$work/drawio/$DRAWIO_WEBAPP/$path" ] || continue
      skips_reference "$path" && continue
      printf 'vendor-drawio: %s loads %s, which the allowlist does not copy\n' "$relative" "$path" >&2
      missing=1
    done < <(grep -oE 'js/[A-Za-z0-9_./-]+\.js' "$TARGET/$relative" | LC_ALL=C sort -u)
  done
  [ "$missing" -eq 0 ] || fail "the allowlist is incomplete"

  printf '%s\n' "$DRAWIO_VERSION" >"$TARGET/VERSION"
  printf '%s\n' "$DRAWIO_COMMIT" >"$TARGET/COMMIT"
  cp "$work/drawio/LICENSE" "$TARGET/LICENSE"

  : >"$TARGET/INKLINE-HOOKS.patch"
  for path in "${HOOKS[@]}"; do
    diff -u --label "a/js/$path" --label "b/js/$path" \
      "$work/drawio/$DRAWIO_WEBAPP/js/$path" "$HOOKS_DIR/$path" >>"$TARGET/INKLINE-HOOKS.patch" || true
  done

  write_manifest
  printf 'vendor-drawio: %s at %s, %s files, %s\n' \
    "$DRAWIO_VERSION" "$DRAWIO_COMMIT" \
    "$(cd "$TARGET" && find . -type f | wc -l)" \
    "$(du -sh "$TARGET" | cut -f1)"
}

case "${1:-vendor}" in
  vendor) vendor_tree ;;
  check) check_tree ;;
  *)
    printf 'usage: %s [vendor|check]\n' "$(basename "$0")" >&2
    exit 2
    ;;
esac
