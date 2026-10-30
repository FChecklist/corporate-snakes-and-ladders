#!/usr/bin/env bash
# Runs every planted-break check, one after the other. Needs bun. Writes results/breakchecks/*.log. Exit code 1 if any check had a problem.
cd "$(dirname "$0")/../.." || exit 1
rc=0
for f in tools/breakchecks/*.mjs; do
  [ "$(basename "$f")" = "lib.mjs" ] && continue
  bun "$f" || rc=1
done
exit $rc
