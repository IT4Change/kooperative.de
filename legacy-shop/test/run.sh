#!/usr/bin/env bash
#
# Smoke test for the old shop's patch mechanism (legacy-shop/includes/local).
#
# Builds a throwaway shop out of test/fixture (a stand-in application_top,
# header and footer) plus the REAL original pages from old/ftp-data/shop, then
# runs them with php-cli — with and without the loader, with a database that
# delivers texts, delivers nothing, or fails.
#
# The original pages are only in the working copy of the people who have the
# old shop's backup (old/ is not in git); without it (CI) the fixture's
# stand-in pages take their place and the real-file precondition is skipped.
#
# Needs a PHP without the mysql extension (7+) — the fixture stands in for
# mysql_query. Syntax compatibility with the shop's own PHP 5 is checked
# separately: PHP5_IMAGE=php:5.4-cli test/run.sh lints the patches in Docker.
#
#   legacy-shop/test/run.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
ORIGINALS="${LEGACY_ORIGINALS:-$ROOT/../old/ftp-data/shop}"
PHP="${PHP:-php}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failures=0
pass() { printf '  ok   %s\n' "$1"; }
fail() {
  printf '  FAIL %s\n' "$1"
  failures=$((failures + 1))
}

# A fresh shop: fixture + (optionally) the loader with its patches.
shop() {
  rm -rf "$WORK/shop"
  cp -R "$HERE/fixture" "$WORK/shop"
  if [ -d "$ORIGINALS" ]; then
    local original
    for original in datenschutz imprint agb; do cp "$ORIGINALS/$original.php" "$WORK/shop/"; done
  fi
  if [ "${1:-}" = "with-patches" ]; then
    mkdir -p "$WORK/shop/includes/local"
    cp -R "$ROOT/includes/local/." "$WORK/shop/includes/local/"
  fi
}

# Runs a page; stdout to $WORK/out, stderr to $WORK/err.
run() {
  local page="$1" db="${2:-}"
  (cd "$WORK/shop" && KOOP_TEST_DB="$db" "$PHP" -d display_errors=stderr -d error_reporting=-1 \
    "$page" >"$WORK/out" 2>"$WORK/err") || true
}

# The nested bootstrap redefines PAGE_PARSE_START_TIME — on the shop's PHP 5 a
# notice that application_top's own error_reporting hides, on PHP 8 a warning.
# Anything else on stderr is a real problem.
clean_stderr() {
  ! grep -v 'PAGE_PARSE_START_TIME already defined' "$WORK/err" | grep -q .
}

contains() { grep -qF -- "$1" "$WORK/out"; }

echo "legacy-shop patches"

# --- precondition in the real shop -------------------------------------------------
# The loader runs application_top a second time. That only works because the real
# file declares no function or class itself (those would be declared at compile
# time, before the hook, and again on the second run). Guard against an update
# of the shop that changes this.
if [ -f "$ORIGINALS/includes/application_top.php" ]; then
  if grep -qE '^\s*(function|class) ' "$ORIGINALS/includes/application_top.php"; then
    fail 'real application_top.php declares no functions or classes'
  else pass 'real application_top.php declares no functions or classes'; fi
  if grep -qF "if (file_exists('includes/local/configure.php')) include('includes/local/configure.php');" \
    "$ORIGINALS/includes/application_top.php"; then
    pass 'real application_top.php has the local configuration hook'
  else fail 'real application_top.php has the local configuration hook'; fi
fi

# --- pages that the patches leave alone ---------------------------------------

shop with-patches
run unpatched.php '{"datenschutz":"<p>DB</p>"}'
if contains 'UNPATCHED PAGE' && ! contains '[HEADER' && [ ! -s "$WORK/err" ]; then
  pass 'a page without a patch runs untouched'
else fail 'a page without a patch runs untouched'; fi

# --- patched pages, database delivers --------------------------------------------

shop with-patches
run datenschutz.php '{"datenschutz":"<h2>Verantwortlicher</h2><p>Verantwortlich &#8211; DB</p>"}'
if contains '<p>Verantwortlich &#8211; DB</p>' && contains '[HEADER Datenschutz]' \
  && contains 'Datenschutzerkl&auml;rung' && contains '[FOOTER]' && contains '[BOTTOM]' \
  && ! contains 'Seit Inkrafttreten' && clean_stderr; then
  pass 'datenschutz.php prints the live text in the shop frame'
else fail 'datenschutz.php prints the live text in the shop frame'; cat "$WORK/out" "$WORK/err"; fi

run privacy.php '{"datenschutz":"<p>DB-PRIVACY</p>"}'
if contains 'DB-PRIVACY' && clean_stderr; then pass 'privacy.php shows the same text'
else fail 'privacy.php shows the same text'; fi

run agb.php '{"agb":"<p>AGB-TEXT</p>","widerruf":"<p>WIDERRUF-TEXT</p>"}'
if contains 'AGB-TEXT' && contains 'WIDERRUF-TEXT' \
  && contains '<h2 class="koop-legal-part">Widerrufsbelehrung</h2>' \
  && ! contains 'Versand &amp; Zahlung</h2>' && clean_stderr; then
  pass 'agb.php combines its parts and skips a missing one'
else fail 'agb.php combines its parts and skips a missing one'; cat "$WORK/out"; fi

run conditions.php '{"agb":"<p>AGB-TEXT</p>","versand":"<p>V</p>","widerruf":"<p>W</p>"}'
if contains 'AGB-TEXT' && contains 'Versand &amp; Zahlung</h2>' && clean_stderr; then
  pass 'conditions.php shows the AGB as well'
else fail 'conditions.php shows the AGB as well'; fi

run shipping.php '{"versand":"<p>VERSAND-TEXT</p>"}'
if contains 'VERSAND-TEXT' && contains '[HEADER Liefer- und Versandkosten]' && clean_stderr; then
  pass 'shipping.php shows Versand & Zahlung'
else fail 'shipping.php shows Versand & Zahlung'; fi

# --- fallback to the original page ------------------------------------------------

# Against the real pages when old/ is there, against the fixture stand-ins
# otherwise (CI) - either way the fallback has to reproduce them byte for byte.
if [ -d "$ORIGINALS" ]; then kind=original; else kind=stand-in; fi
for page in datenschutz imprint agb; do
  shop
  run "$page.php"
  cp "$WORK/out" "$WORK/original"
  if [ -s "$WORK/original" ] && [ ! -s "$WORK/err" ]; then
    pass "$page.php: $kind renders in the fixture"
  else fail "$page.php: $kind renders in the fixture"; cat "$WORK/err"; fi

  shop with-patches
  run "$page.php" '{}'
  if cmp -s "$WORK/out" "$WORK/original" && clean_stderr; then
    pass "$page.php: no live text -> byte-identical original"
  else fail "$page.php: no live text -> byte-identical original"; diff "$WORK/original" "$WORK/out" | head; fi

  run "$page.php" 'fail'
  if cmp -s "$WORK/out" "$WORK/original" && clean_stderr; then
    pass "$page.php: database error -> byte-identical original"
  else fail "$page.php: database error -> byte-identical original"; fi
done

# Patch removed again: the loader alone changes nothing.
shop
run datenschutz.php
cp "$WORK/out" "$WORK/original"
shop with-patches
rm "$WORK/shop/includes/local/patches/datenschutz.php"
run datenschutz.php '{"datenschutz":"<p>DB</p>"}'
if cmp -s "$WORK/out" "$WORK/original" && [ ! -s "$WORK/err" ]; then
  pass 'removing a patch restores the original page'
else fail 'removing a patch restores the original page'; fi

# --- PHP 5 syntax -------------------------------------------------------------------

if [ -n "${PHP5_IMAGE:-}" ]; then
  while IFS= read -r file; do
    rel="${file#"$ROOT"/}"
    if docker run --rm -v "$ROOT:/src:ro" -w /src "$PHP5_IMAGE" php -l "$rel" >/dev/null 2>&1; then
      pass "php -l ($PHP5_IMAGE) $rel"
    else
      fail "php -l ($PHP5_IMAGE) $rel"
      docker run --rm -v "$ROOT:/src:ro" -w /src "$PHP5_IMAGE" php -l "$rel" || true
    fi
  done < <(find "$ROOT/includes" -name '*.php' | sort)
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures failure(s)"
  exit 1
fi
echo "all passed"
