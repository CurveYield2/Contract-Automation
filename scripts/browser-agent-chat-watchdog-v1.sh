#!/usr/bin/env bash
set -uo pipefail

CHAT_URL="${CHAT_URL:-}"
WAKE_ID="${WAKE_ID:-chat-watchdog-${GITHUB_RUN_ID:-manual}}"
WAKE_MESSAGE="${WAKE_MESSAGE:-GET BACK TO WORK}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-300}"
SEGMENT_SECONDS="${SEGMENT_SECONDS:-14400}"
OVERALL_DEADLINE_EPOCH="${OVERALL_DEADLINE_EPOCH:-}"
PREVIOUS_ASSISTANT_COUNT="${PREVIOUS_ASSISTANT_COUNT:-}"
PREVIOUS_ASSISTANT_HASH="${PREVIOUS_ASSISTANT_HASH:-}"

if [[ ! "$CHAT_URL" =~ ^https://chatgpt\.com/c/[A-Za-z0-9_-]+ ]]; then
  echo "::error::chat_url must be a ChatGPT conversation URL matching https://chatgpt.com/c/..."
  exit 2
fi
if [[ ! "$INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [ "$INTERVAL_SECONDS" -lt 60 ]; then
  echo "::error::INTERVAL_SECONDS must be an integer >= 60"
  exit 2
fi
if [[ ! "$SEGMENT_SECONDS" =~ ^[0-9]+$ ]] || [ "$SEGMENT_SECONDS" -lt 60 ]; then
  echo "::error::SEGMENT_SECONDS must be an integer >= 60"
  exit 2
fi

started_epoch="$(date -u +%s)"
if [ -z "$OVERALL_DEADLINE_EPOCH" ]; then
  OVERALL_DEADLINE_EPOCH="$((started_epoch + 43200))"
fi
if [[ ! "$OVERALL_DEADLINE_EPOCH" =~ ^[0-9]+$ ]]; then
  echo "::error::OVERALL_DEADLINE_EPOCH must be an integer epoch timestamp"
  exit 2
fi

segment_deadline="$((started_epoch + SEGMENT_SECONDS))"
if [ "$segment_deadline" -gt "$OVERALL_DEADLINE_EPOCH" ]; then
  segment_deadline="$OVERALL_DEADLINE_EPOCH"
fi

previous_count="$PREVIOUS_ASSISTANT_COUNT"
previous_hash="$PREVIOUS_ASSISTANT_HASH"
baseline_ready=false
if [[ "$previous_count" =~ ^[0-9]+$ ]] && [ -n "$previous_hash" ]; then
  baseline_ready=true
fi

sleep_until_next_check() {
  local now remaining sleep_for
  now="$(date -u +%s)"
  remaining="$((segment_deadline - now))"
  if [ "$remaining" -le 0 ]; then
    return 0
  fi
  sleep_for="$INTERVAL_SECONDS"
  if [ "$sleep_for" -gt "$remaining" ]; then
    sleep_for="$remaining"
  fi
  sleep "$sleep_for"
}

cycle=0
while :; do
  now="$(date -u +%s)"
  if [ "$now" -ge "$segment_deadline" ] || [ "$now" -ge "$OVERALL_DEADLINE_EPOCH" ]; then
    break
  fi

  cycle="$((cycle + 1))"
  observe_path="/tmp/chat-watchdog-observe-${cycle}.json"
  export WAKE_MODE='resume_existing'
  export CHAT_URL
  export WAKE_ID
  export WAKE_ACTION='observe'
  export WAKE_RESULT_PATH="$observe_path"

  if ! xvfb-run -a node scripts/browser-agent-wake.mjs; then
    echo "::warning::Observation failed on cycle $cycle; leaving the chat untouched and retrying later."
    sleep_until_next_check
    continue
  fi

  if [ ! -s "$observe_path" ]; then
    echo "::warning::Observation returned no result on cycle $cycle; retrying later."
    sleep_until_next_check
    continue
  fi

  chat_viewable="$(jq -r '.chatViewable // false' "$observe_path")"
  human_challenge="$(jq -r '.humanChallenge // false' "$observe_path")"
  login_prompt="$(jq -r '.loginPrompt // false' "$observe_path")"
  conversation_unavailable="$(jq -r '.conversationUnavailable // false' "$observe_path")"

  if [ "$human_challenge" = true ]; then
    echo "::warning::Browser challenge encountered on cycle $cycle; no poke sent."
    sleep_until_next_check
    continue
  fi
  if [ "$login_prompt" = true ]; then
    echo "::warning::ChatGPT authentication is required on cycle $cycle; no poke sent."
    sleep_until_next_check
    continue
  fi
  if [ "$conversation_unavailable" = true ]; then
    echo "::warning::Conversation is unavailable on cycle $cycle; no poke sent."
    sleep_until_next_check
    continue
  fi
  if [ "$chat_viewable" != true ]; then
    echo "::warning::Chat is not currently viewable on cycle $cycle; no poke sent."
    sleep_until_next_check
    continue
  fi

  generating="$(jq -r '.generating // false' "$observe_path")"
  current_count="$(jq -r '.assistantCount // 0' "$observe_path")"
  current_hash="$(jq -r '.lastAssistantHash // empty' "$observe_path")"

  if ! [[ "$current_count" =~ ^[0-9]+$ ]]; then
    current_count=0
  fi

  if [ "$baseline_ready" != true ]; then
    previous_count="$current_count"
    previous_hash="$current_hash"
    baseline_ready=true
    if [ "$generating" = true ]; then
      echo "Cycle $cycle: agent is actively generating; baseline recorded and chat left untouched."
    else
      echo "Cycle $cycle: initial idle baseline recorded; waiting one interval before deciding whether to poke."
    fi
    sleep_until_next_check
    continue
  fi

  productive=false
  reason=''
  if [ "$generating" = true ]; then
    productive=true
    reason='GENERATING'
  elif [ "$current_count" -gt "$previous_count" ]; then
    productive=true
    reason='ADVANCED_MESSAGE_COUNT'
  elif [ -n "$current_hash" ] && [ "$current_hash" != "$previous_hash" ]; then
    productive=true
    reason='ADVANCED_CONTENT'
  fi

  if [ "$productive" = true ]; then
    echo "Cycle $cycle: agent is actively working ($reason); no interruption."
    previous_count="$current_count"
    previous_hash="$current_hash"
    sleep_until_next_check
    continue
  fi

  echo "Cycle $cycle: no active work detected; sending GET BACK TO WORK."
  poke_path="/tmp/chat-watchdog-poke-${cycle}.json"
  export WAKE_ACTION='wake'
  export WAKE_MESSAGE
  export WAKE_RESULT_PATH="$poke_path"

  if xvfb-run -a node scripts/browser-agent-wake.mjs; then
    if [ -s "$poke_path" ]; then
      previous_count="$(jq -r '.after.assistantCount // .assistantCount // 0' "$poke_path")"
      previous_hash="$(jq -r '.after.lastAssistantHash // .lastAssistantHash // empty' "$poke_path")"
      if ! [[ "$previous_count" =~ ^[0-9]+$ ]]; then
        previous_count="$current_count"
      fi
      [ -n "$previous_hash" ] || previous_hash="$current_hash"
    else
      previous_count="$current_count"
      previous_hash="$current_hash"
    fi
    echo "Cycle $cycle: wake message delivery completed."
  else
    echo "::warning::Wake delivery failed on cycle $cycle; retrying on the next check."
    previous_count="$current_count"
    previous_hash="$current_hash"
  fi

  sleep_until_next_check
done

ended_epoch="$(date -u +%s)"
echo "Segment complete at $(date -u -d "@$ended_epoch" +'%Y-%m-%dT%H:%M:%SZ')."
echo "Overall watchdog deadline: $(date -u -d "@$OVERALL_DEADLINE_EPOCH" +'%Y-%m-%dT%H:%M:%SZ')."

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "deadline_epoch=$OVERALL_DEADLINE_EPOCH"
    echo "assistant_count=${previous_count:-0}"
    echo "assistant_hash=${previous_hash:-}"
  } >> "$GITHUB_OUTPUT"
fi
