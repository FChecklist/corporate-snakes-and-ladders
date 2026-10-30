#!/usr/bin/env bash
# Runs the test folders ONE AT A TIME with `bun test --isolate` and saves the raw logs under results/final/. Prints one line per folder.
cd "$(dirname "$0")/../.." || exit 1
out=results/final; mkdir -p "$out"
for d in packages/shared/test packages/billing/test packages/beacon/test apps/web/test tools/control-worker tools/sim2/scenarios/matrix apps/edge/test; do
  log="$out/$(echo "$d" | tr / _).log"
  start=$(date +%s)
  bun test --isolate "$d" > "$log" 2>&1
  echo "$d  exit=$?  $(grep -aE '^ *[0-9]+ pass' "$log" | tr -s ' ')  $(grep -aE '^ *[0-9]+ fail' "$log" | tr -s ' ')  $(grep -aE '^Ran ' "$log")  wall=$(( $(date +%s) - start ))s"
done
