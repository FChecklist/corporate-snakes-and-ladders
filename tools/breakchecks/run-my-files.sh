#!/usr/bin/env bash
# Runs each test file written by the test author on its own and saves the raw log under results/final/files/. One line per file.
cd "$(dirname "$0")/../.." || exit 1
out=results/final/files; mkdir -p "$out"
for f in $(ls apps/edge/test/t30-*.test.ts apps/web/test/t30-*.test.ts packages/beacon/test/t30-*.test.ts tools/sim2/scenarios/matrix/matrix.test.ts); do
  log="$out/$(echo "$f" | tr / _).log"
  bun test --isolate "$f" > "$log" 2>&1
  echo "$f  $(grep -aE '^ *[0-9]+ pass' "$log" | tr -s ' ')  $(grep -aE '^ *[0-9]+ fail' "$log" | tr -s ' ')  $(grep -aE '^ *[0-9]+ expect' "$log" | tr -s ' ')"
done
