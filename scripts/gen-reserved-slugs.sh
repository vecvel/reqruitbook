#!/usr/bin/env bash
#
# Generates the TypeScript reserved-slug list from the Go one.
#
# The architecture guarantees that slug validation and host routing can never
# disagree about what is reserved. Two hand-maintained copies cannot promise
# that — the second one drifts the first time someone adds a subdomain. So Go
# owns the list and this script projects it into TypeScript.
#
#   scripts/gen-reserved-slugs.sh          write the file
#   scripts/gen-reserved-slugs.sh --check  fail if it is out of date (for CI)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SOURCE="packages/goshared/tenancy/host.go"
TARGET="packages/nestshared/src/reserved-slugs.ts"

# Take everything between `var ReservedSlugs = []string{` and the closing brace,
# then pull out each quoted entry.
slugs=$(awk '/^var ReservedSlugs = \[\]string\{/,/^\}/' "$SOURCE" \
  | grep -oE '"[a-z0-9-]+"' \
  | tr -d '"')

if [[ -z "$slugs" ]]; then
  echo "error: no slugs parsed from $SOURCE — has the declaration changed?" >&2
  exit 1
fi

generate() {
  cat <<'HEADER'
/**
 * Subdomains a company may not register.
 *
 * GENERATED FILE — do not edit. The list is owned by
 * packages/goshared/tenancy/host.go, because slug validation and host routing
 * must never disagree about what is reserved. Regenerate with:
 *
 *   scripts/gen-reserved-slugs.sh
 */
export const RESERVED_SLUGS: readonly string[] = [
HEADER

  # Wrap at a sensible width rather than one slug per line.
  printf '%s\n' "$slugs" | awk '
    BEGIN { line = "  " }
    {
      entry = "'"'"'" $0 "'"'"', "
      if (length(line) + length(entry) > 78) { print line; line = "  " }
      line = line entry
    }
    END { if (length(line) > 2) { sub(/, $/, ",", line); print line } }
  '

  cat <<'FOOTER'
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.trim().toLowerCase());
}
FOOTER
}

if [[ "${1:-}" == "--check" ]]; then
  if ! diff -q <(generate) "$TARGET" >/dev/null 2>&1; then
    echo "error: $TARGET is out of date with $SOURCE" >&2
    echo "run scripts/gen-reserved-slugs.sh and commit the result" >&2
    diff <(generate) "$TARGET" || true
    exit 1
  fi
  echo "reserved slugs are in sync ($(printf '%s\n' "$slugs" | wc -l | tr -d ' ') entries)"
  exit 0
fi

generate > "$TARGET"
echo "wrote $TARGET ($(printf '%s\n' "$slugs" | wc -l | tr -d ' ') entries)"
