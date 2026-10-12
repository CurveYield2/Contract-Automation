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
authority_root_file="process/adr-verify/AUTHORITY_ROOT_v1.txt"
authority_root=""
if [[ -f "$authority_root_file" ]]; then
  authority_root="$(head -n1 "$authority_root_file" | tr -d '\r')"
fi
if [[ -n "$authority_root" ]] && [[ "$authority_root" == /* || "$authority_root" == *".."* ]]; then
  echo "::error::Authority root must be controller-relative" >&2
  exit 1
fi
run_authority_sync() {
  local checkout="$1"
  shift
  local rc=0
  node scripts/validate-lite-authority-automation-sync-v1.mjs --controller-root "$checkout" --automation-root . "$@" >"$checkout/authority-sync.txt" 2>&1 || rc=$?
  printf '%s\n' "$rc"
}
main_authority_rc="$(run_authority_sync .ac-main)"
target_args=()
if [[ -n "$authority_root" ]]; then target_args+=(--authority-root "$authority_root"); fi
target_authority_rc="$(run_authority_sync .ac-target "${target_args[@]}")"
echo "Authority validator main code=$main_authority_rc; target code=$target_authority_rc"
if [[ "$target_authority_rc" != 0 ]]; then echo "Target authority validator failure:"; tail -n 35 .ac-target/authority-sync.txt; fi
if [[ "$target_authority_rc" != 0 && "$main_authority_rc" == 0 ]]; then
  echo "::error::Staging authority validation regressed" >&2
  cat .ac-target/authority-sync.txt
  exit 1
fi
exit 0
