#!/usr/bin/env bash
set -euo pipefail

ref_file="process/adr-verify/AUDIT_CONTROLLER_REF_v1.txt"
target_ref="$(tr -d '[:space:]' < "$ref_file")"
if [[ ! "$target_ref" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "::error::Invalid Audit-Controller ref: $target_ref" >&2
  exit 1
fi

gh auth setup-git

checkout_controller() {
  local directory="$1"
  local ref="$2"
  gh repo clone CurveYield2/Audit-Controller "$directory" -- --filter=blob:none --no-checkout
  (
    cd "$directory"
    git sparse-checkout init --no-cone
    printf '%s\n' '/*' '!/campaigns/' '!/Phase0 Build Cache/' > .git/info/sparse-checkout
    git fetch origin "$ref"
    git checkout --detach FETCH_HEAD
  )
}

run_controller_checks() {
  local directory="$1"
  (
    cd "$directory"
    node --test --test-reporter=tap packages/*/test/*.test.mjs test/*.test.mjs > tap.txt || true
    set +e
    node scripts/check.mjs > check.txt 2>&1
    local check_status="$?"
    set -e
    printf '%s\n' "$check_status" > check.code
    sed -nE 's/^not ok [0-9]+[[:space:]]*-[[:space:]]*//p' tap.txt | LC_ALL=C sort -u > failed-tests.txt
  )
}

checkout_controller ".ac-main" "main"
checkout_controller ".ac-target" "$target_ref"
run_controller_checks ".ac-main"
run_controller_checks ".ac-target"

echo "Audit-Controller main failing tests:"
cat .ac-main/failed-tests.txt
echo "Audit-Controller target ($target_ref) failing tests:"
cat .ac-target/failed-tests.txt

new_failures="$(comm -13 .ac-main/failed-tests.txt .ac-target/failed-tests.txt)"
main_check_code="$(cat .ac-main/check.code)"
target_check_code="$(cat .ac-target/check.code)"
if [[ -n "$new_failures" ]]; then
  echo "::error::New failing Audit-Controller tests in $target_ref:"
  printf '%s\n' "$new_failures"
  exit 1
fi
if [[ "$target_check_code" != "0" && "$main_check_code" == "0" ]]; then
  echo "::error::Audit-Controller check.mjs regressed (main=0, target=$target_check_code)" >&2
  cat .ac-target/check.txt
  exit 1
fi

# ADR-EXTRA-CHECKS
exit 0
