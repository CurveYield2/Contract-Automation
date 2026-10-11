#!/usr/bin/env bash
# Single shallow private Audit-Controller fetch. Keep exact ref and its worktree;
# never mirror private repository contents through public workflow artifacts.
set -euo pipefail
if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo 'usage: checkout-audit-controller-once-v1.sh <relative-destination> <ref> [branch|detach]' >&2
  exit 2
fi
destination="$1"
ref="$2"
mode="${3:-branch}"
case "$destination" in
  .audit-controller|.audit-controller-output|.controller-under-test) ;;
  *) echo 'unsupported private checkout destination' >&2; exit 2;;
esac
if ! git check-ref-format --branch "$ref" >/dev/null 2>&1; then
  # Only private verification allows detached exact commit identifiers.
  if [ "$mode" != detach ] || ! [[ "$ref" =~ ^[a-fA-F0-9]{40}$ ]]; then
    echo 'invalid private checkout ref' >&2; exit 2
  fi
fi
case "$mode" in branch|detach) ;; *) echo 'unknown private checkout mode' >&2;exit 2;;esac
[ -n "${GH_TOKEN:-}" ] || { echo 'private Audit-Controller credential required' >&2; exit 1; }
gh auth setup-git
rm -rf -- "$destination"
git init --quiet "$destination"
git -C "$destination" remote add origin https://github.com/CurveYield2/Audit-Controller.git
git -C "$destination" fetch --no-tags --depth=1 --filter=blob:none origin "$ref"
expected="$(git -C "$destination" rev-parse FETCH_HEAD)"
if [ "$mode" = detach ]; then
  git -C "$destination" checkout --quiet --detach FETCH_HEAD
else
  git -C "$destination" checkout --quiet -B "$ref" FETCH_HEAD
fi
test "$(git -C "$destination" rev-parse HEAD)" = "$expected"
echo "Private Audit-Controller single-fetch checkout verified at $expected"
