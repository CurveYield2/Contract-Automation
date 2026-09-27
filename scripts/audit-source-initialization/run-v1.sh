#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT/scripts/audit-source-initialization/resolve-source-v1.sh"
source "$ROOT/scripts/audit-source-initialization/extract-v1.sh"

: "${SOURCE_URL:?SOURCE_URL is required}"
: "${REQUEST_ID:?REQUEST_ID is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${AUDIT_CONTROLLER_TOKEN:?AUDIT_CONTROLLER_TOKEN is required}"
: "${CONTRACT_AUTOMATION_TOKEN:?CONTRACT_AUTOMATION_TOKEN is required}"

safe_request="$(printf '%s' "$REQUEST_ID" | tr -c 'A-Za-z0-9._-' '_')"
report_path="process/audit-source-initialization/reports/$safe_request.json"

# Exact workflow retries are idempotent. A new request using the same ZIP is NOT
# deduplicated; it intentionally creates the next rN campaign revision.
encoded="$(gh api "repos/$GITHUB_REPOSITORY/contents/$report_path?ref=main" --jq '.content' 2>/dev/null || true)"
if [ -n "$encoded" ]; then
  printf '%s' "$encoded" | base64 -d > /tmp/prior-source-init.json
  jq -e --arg u "$SOURCE_URL" \
    '.schemaVersion=="curveyield-audit-source-initialization-report-v1"
     and .status=="PASS"
     and .request.sourceUrl==$u' \
    /tmp/prior-source-init.json >/dev/null
  campaign_id="$(jq -r '.campaign.campaignId' /tmp/prior-source-init.json)"
  generation_id="$(jq -r '.campaign.campaignGenerationId' /tmp/prior-source-init.json)"
  campaign_name="$(jq -r '.campaign.campaignName' /tmp/prior-source-init.json)"
  campaign_root="$(jq -r '.campaign.workspacePath' /tmp/prior-source-init.json)"
else
  export GH_TOKEN="$AUDIT_CONTROLLER_TOKEN"
  work='/tmp/audit-source-initialization'
  resolve_audit_source_zip "$SOURCE_URL" "$work" "$AUDIT_CONTROLLER_TOKEN"

  filename="$(cat "$work/filename")"
  source_sha="$(cat "$work/sha256")"
  source_size="$(cat "$work/size")"
  provider="$(cat "$work/provider")"
  canonical_url="$(cat "$work/canonical-url")"
  display_base="$(cat "$work/display-base")"
  slug="$(cat "$work/slug")"

  skill_path='Audit Skill - Current Authority/Audit_V7_independent_Review_skill_v38/optional-modes/lite-pathway/SKILL.md'
  skill_repo_path="CurveYield2/Contract-Automation/$skill_path"
  skill_release="$(sed -n 's/^Release identity: `\(.*\)`$/\1/p' "$ROOT/$skill_path" | head -n1)"
  skill_revision="$(sed -n 's/^Package revision: `\(.*\)`$/\1/p' "$ROOT/$skill_path" | head -n1)"
  skill_sha="$(sha256sum "$ROOT/$skill_path" | awk '{print $1}')"
  skill_blob="$(git -C "$ROOT" rev-parse "HEAD:$skill_path")"
  test -n "$skill_release"
  test -n "$skill_revision"

  repo='/tmp/audit-controller-source-init'
  rm -rf "$repo"
  gh repo clone CurveYield2/Audit-Controller "$repo" -- --branch main
  cd "$repo"
  git config user.name 'CurveYield Audit Source Initialization'
  git config user.email 'audit-source-initialization@users.noreply.github.com'

  success=false
  for attempt in 1 2 3 4 5; do
    git fetch origin main
    git reset --hard origin/main
    git clean -fdx

    max=0
    while IFS= read -r f; do
      id="$(jq -r '.campaignId // empty' "$f" 2>/dev/null || true)"
      if [[ "$id" =~ ^${slug}-r([0-9]+)$ ]] && [ "${BASH_REMATCH[1]}" -gt "$max" ]; then
        max="${BASH_REMATCH[1]}"
      fi
    done < <(find campaigns .deep-assurance/active -type f -name '*.json' -print 2>/dev/null | LC_ALL=C sort)

    revision=$((max + 1))
    campaign_id="$slug-r$revision"
    campaign_name="$display_base r$revision"
    campaign_root="campaigns/$campaign_name"
    source_dir="$campaign_root/source"
    source_path="$source_dir/$filename"
    controller_dir="$campaign_root/controller"
    active_path=".deep-assurance/active/$slug.json"
    created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    compact="$(date -u +%Y%m%dT%H%M%SZ)"
    generation_id="$campaign_id-g1-$compact"
    session="web-bootstrap-agent-phase0-$compact"

    [ ! -e "$campaign_root" ] || { echo "::error::Campaign path collision: $campaign_root"; exit 1; }

    mkdir -p "$source_dir" "$controller_dir" .deep-assurance/active
    cp "$work/$filename" "$source_path"
    tree_sha="$(safe_extract_audit_zip "$source_path" "$source_dir" "$filename")"

    git add -- "$source_dir"
    git commit -m "audit(source): admit $campaign_id"
    admission_commit="$(git rev-parse HEAD)"
    source_blob="$(git rev-parse "HEAD:$source_path")"

    CAMPAIGN_ID="$campaign_id" GENERATION_ID="$generation_id" CAMPAIGN_NAME="$campaign_name" SLUG="$slug" \
    CAMPAIGN_ROOT="$campaign_root" SOURCE_PROVIDER="$provider" SOURCE_URL_CANONICAL="$canonical_url" \
    SOURCE_FILENAME="$filename" SOURCE_SHA="$source_sha" SOURCE_SIZE="$source_size" SOURCE_PATH="$source_path" \
    SOURCE_DIR="$source_dir" ADMISSION_COMMIT="$admission_commit" SOURCE_BLOB="$source_blob" TREE_SHA="$tree_sha" \
    CREATED_AT="$created_at" SESSION="$session" SKILL_RELEASE="$skill_release" SKILL_REVISION="$skill_revision" \
    SKILL_SHA="$skill_sha" SKILL_BLOB="$skill_blob" SKILL_REPO_PATH="$skill_repo_path" \
    CONTROLLER_DIR="$controller_dir" ACTIVE_PATH="$active_path" \
      python3 "$ROOT/scripts/audit-source-initialization/write-state-v1.py"

    git add -- "$controller_dir" "$active_path"
    git commit -m "audit(controller): initialize $campaign_id"
    init_commit="$(git rev-parse HEAD)"

    if git push origin HEAD:main; then
      success=true
      break
    fi

    echo "::warning::Audit-Controller main moved; rebuilding the initialization on latest main (attempt $attempt/5)."
    sleep $((attempt * 2))
  done
  [ "$success" = true ] || { echo "::error::Failed to publish Audit Source Initialization to Audit-Controller main."; exit 1; }

  export GH_TOKEN="$CONTRACT_AUTOMATION_TOKEN"
  jq -n \
    --arg requestId "$REQUEST_ID" --arg sourceUrl "$SOURCE_URL" --arg provider "$provider" \
    --arg canonicalUrl "$canonical_url" --arg filename "$filename" --arg sha "$source_sha" \
    --argjson size "$source_size" --arg campaignId "$campaign_id" --arg generation "$generation_id" \
    --arg campaignName "$campaign_name" --arg workspace "$campaign_root" --arg sourcePath "$source_path" \
    --arg admission "$admission_commit" --arg blob "$source_blob" --arg tree "$tree_sha" \
    --arg init "$init_commit" --arg run "$GITHUB_RUN_ID" \
    '{
      schemaVersion:"curveyield-audit-source-initialization-report-v1",
      request:{requestId:$requestId,sourceUrl:$sourceUrl},
      status:"PASS",
      source:{
        provider:$provider,canonicalUrl:$canonicalUrl,filename:$filename,sha256:$sha,byteLength:$size,
        repository:"CurveYield2/Audit-Controller",ref:"main",path:$sourcePath,
        gitBlobSha:$blob,admissionCommit:$admission,unpackedTreeSha256:$tree
      },
      campaign:{
        campaignId:$campaignId,campaignGenerationId:$generation,campaignName:$campaignName,
        workspacePath:$workspace,controllerRef:"main",initializationCommit:$init
      },
      workflowRunId:$run,completedAt:(now|todate)
    }' > /tmp/source-init-report.json

  body="$(base64 -w0 /tmp/source-init-report.json)"
  api="repos/$GITHUB_REPOSITORY/contents/$report_path"
  current="$(gh api "$api?ref=main" --jq '.sha' 2>/dev/null || true)"
  if [[ "$current" =~ ^[0-9a-f]{40}$ ]]; then
    gh api --method PUT "$api" -f message="chore(audit): record source initialization $REQUEST_ID" \
      -f content="$body" -f sha="$current" -f branch=main >/dev/null
  else
    gh api --method PUT "$api" -f message="chore(audit): record source initialization $REQUEST_ID" \
      -f content="$body" -f branch=main >/dev/null
  fi
fi

export GH_TOKEN="$CONTRACT_AUTOMATION_TOKEN"
gh workflow run lite-audit-browser-orchestrator-v1.yml --repo "$GITHUB_REPOSITORY" --ref main \
  -f campaign_id="$campaign_id" \
  -f campaign_name="$campaign_name" \
  -f campaign_path="$campaign_root" \
  -f audit_controller_ref=main

{
  echo '## Audit Source Initialization'
  echo
  echo "- Campaign: $campaign_name"
  echo "- Campaign ID: $campaign_id"
  echo "- Generation: $generation_id"
  echo "- Workspace: $campaign_root"
  echo '- Source ZIP and unpacked source are both under campaign source/.'
  echo '- Audit-Controller ref: main'
  echo '- Phase-0 Lite monitor: dispatched'
} >> "$GITHUB_STEP_SUMMARY"
