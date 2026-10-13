#!/usr/bin/env bash
# Single shallow private Audit-Controller fetch. Keep exact ref and its worktree;
# never mirror private repository contents through public workflow artifacts.
#
# With a campaign path, materialize ONLY what campaign automation reads:
#   1. the campaign folder;
#   2. its Audit Campaign Directory entry; and
#   3. the frozen authority package named by the campaign's Phase-0 receipt.
# Without one, the whole tree is checked out (legacy behavior).
set -euo pipefail
if [ "$#" -lt 2 ] || [ "$#" -gt 4 ]; then
  echo 'usage: checkout-audit-controller-once-v1.sh <relative-destination> <ref> [branch|detach] [campaign-path]' >&2
  exit 2
fi
destination="$1"
ref="$2"
mode="${3:-branch}"
campaign_path="${4:-}"
if [ -n "$campaign_path" ]; then
  case "$campaign_path" in
    campaigns/*) ;;
    *) echo 'campaign path must be under campaigns/' >&2; exit 2;;
  esac
  case "/$campaign_path/" in
    */../*|*/./*|*//*) echo 'unsafe campaign path' >&2; exit 2;;
  esac
  campaign_path="${campaign_path%/}"
fi
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
if [ -n "$campaign_path" ]; then
  # gitignore-style no-cone pattern for one literal repository path.
  literal_pattern() { printf '/%s' "$(printf '%s' "$1" | sed -e 's/[][*?!#\\]/\\&/g')"; }
  receipt="$campaign_path/receipts/PHASE_00_RECEIPT_v1.json"
  receipt_json="$(git -C "$destination" show "FETCH_HEAD:$receipt")" || { echo "campaign Phase-0 receipt missing: $receipt" >&2; exit 1; }
  directory_entry="$(printf '%s' "$receipt_json" | jq -r '.campaign.campaignDirectoryEntryPath // empty')"
  homepage="$(printf '%s' "$receipt_json" | jq -r '.authority.homepagePath // empty')"
  [ -n "$directory_entry" ] || { echo 'receipt lacks campaign.campaignDirectoryEntryPath' >&2; exit 1; }
  [ -n "$homepage" ] || { echo 'receipt lacks authority.homepagePath' >&2; exit 1; }
  authority_package="$(dirname -- "$homepage")"
  for p in "$directory_entry" "$authority_package"; do
    case "/$p/" in */../*|*/./*|//*) echo "unsafe receipt path: $p" >&2; exit 1;; esac
  done
  # A superseded release leaves Current Authority; its frozen copy then resolves.
  registry='audit-process/v7/frozen-authorities/FROZEN_AUTHORITY_REGISTRY_v1.json'
  frozen_package=''
  if ! git -C "$destination" cat-file -e "FETCH_HEAD:$authority_package/SKILL.md" 2>/dev/null; then
    frozen_package="$(git -C "$destination" show "FETCH_HEAD:$registry" 2>/dev/null \
      | jq -r --arg p "$authority_package" '.entries[] | select(.logicalRoot == $p) | .frozenRoot' | head -n1)"
    [ -n "$frozen_package" ] || { echo "authority package missing and not frozen: $authority_package" >&2; exit 1; }
    case "/$frozen_package/" in */../*|*/./*|//*) echo "unsafe frozen path: $frozen_package" >&2; exit 1;; esac
  fi
  git -C "$destination" config core.sparseCheckout true
  git -C "$destination" config core.sparseCheckoutCone false
  {
    printf '%s/\n' "$(literal_pattern "$campaign_path")"
    printf '%s\n' "$(literal_pattern "$directory_entry")"
    printf '%s/\n' "$(literal_pattern "$authority_package")"
    if [ -n "$frozen_package" ]; then
      printf '%s\n' "$(literal_pattern "$registry")"
      printf '%s/\n' "$(literal_pattern "$frozen_package")"
    fi
  } > "$destination/.git/info/sparse-checkout"
  echo "Sparse campaign checkout: $campaign_path, $directory_entry, $authority_package/${frozen_package:+ (frozen: $frozen_package/)}"
fi
if [ "$mode" = detach ]; then
  git -C "$destination" checkout --quiet --detach FETCH_HEAD
else
  git -C "$destination" checkout --quiet -B "$ref" FETCH_HEAD
fi
test "$(git -C "$destination" rev-parse HEAD)" = "$expected"
echo "Private Audit-Controller single-fetch checkout verified at $expected"
