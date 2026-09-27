#!/usr/bin/env bash
set -euo pipefail

resolve_audit_source_zip() {
  local source_url="$1"
  local work="$2"
  local github_token="$3"
  local provider='' canonical_url='' filename='' download_url=''

  rm -rf "$work"
  mkdir -p "$work"

  if [[ "$source_url" =~ ^https://drive\.google\.com/drive/folders/ ]]; then
    echo "::error::Google Drive folder submissions are not accepted. Provide one ZIP file URL." >&2
    return 1
  elif [[ "$source_url" =~ ^https://drive\.google\.com/file/d/([A-Za-z0-9_-]+) ]]; then
    provider='google-drive'
    local file_id="${BASH_REMATCH[1]}"
    canonical_url="https://drive.google.com/file/d/$file_id/view"
    download_url="https://drive.usercontent.google.com/download?id=$file_id&export=download&confirm=t"
    curl --fail --location --retry 4 --retry-all-errors --connect-timeout 20 \
      -D "$work/headers.txt" -o "$work/source.download" "$download_url"
    filename="$(python3 - "$work/headers.txt" <<'PY'
from email.message import Message
from pathlib import Path
from urllib.parse import unquote
import sys
raw=Path(sys.argv[1]).read_text(errors='replace')
value=''
for block in [b for b in raw.replace('\r\n','\n').split('\n\n') if b.strip()]:
    m=Message()
    for line in block.splitlines():
        if ':' in line:
            k,v=line.split(':',1); m[k.strip()]=v.strip()
    if m.get('Content-Disposition'): value=m.get('Content-Disposition')
name=''
if "filename*=" in value:
    part=value.split("filename*=",1)[1].split(';',1)[0].strip().strip('"')
    if "''" in part: part=part.split("''",1)[1]
    name=unquote(part)
elif 'filename=' in value:
    name=value.split('filename=',1)[1].split(';',1)[0].strip().strip('"')
print(name)
PY
)"
    test -n "$filename" || { echo "::error::Google Drive did not provide the ZIP filename." >&2; return 1; }
  elif [[ "$source_url" =~ ^https://(www\.)?github\.com/ ]] || [[ "$source_url" =~ ^https://raw\.githubusercontent\.com/ ]]; then
    provider='github'
    [[ "$source_url" != *"/tree/"* && "$source_url" != *"/archive/"* ]] || { echo "::error::GitHub folders/repository archives are not accepted. Provide a direct link to one committed ZIP file." >&2; return 1; }
    filename="$(python3 - "$source_url" <<'PY'
import os,sys
from urllib.parse import urlparse,unquote
print(unquote(os.path.basename(urlparse(sys.argv[1]).path)))
PY
)"
    [[ "${filename,,}" == *.zip ]] || { echo "::error::GitHub URL must identify one .zip file." >&2; return 1; }
    canonical_url="$(python3 - "$source_url" <<'PY'
import sys
from urllib.parse import urlsplit,urlunsplit
u=urlsplit(sys.argv[1]); print(urlunsplit((u.scheme,u.netloc,u.path,'','')))
PY
)"
    if [[ "$source_url" == *"/blob/"* ]]; then
      if [[ "$source_url" == *"?"* ]]; then download_url="$source_url&raw=1"; else download_url="$source_url?raw=1"; fi
    else
      download_url="$source_url"
    fi
    curl --fail --location --retry 4 --retry-all-errors --connect-timeout 20 \
      -H "Authorization: Bearer $github_token" -H 'Accept: application/octet-stream' \
      -o "$work/source.download" "$download_url"
  else
    echo "::error::Only direct single-file Google Drive and GitHub ZIP URLs are accepted." >&2
    return 1
  fi

  python3 - "$filename" <<'PY'
import os,sys
name=sys.argv[1]
if not name or name != os.path.basename(name) or '/' in name or '\\' in name:
    raise SystemExit('unsafe source filename')
if any(ord(c)<32 for c in name) or not name.lower().endswith('.zip'):
    raise SystemExit('source filename must be a clean .zip filename')
PY

  test -s "$work/source.download"
  case "$(xxd -p -l 4 "$work/source.download")" in
    504b0304|504b0506|504b0708) ;;
    *) echo "::error::Downloaded object is not a ZIP file." >&2; return 1 ;;
  esac
  unzip -tqq "$work/source.download"

  cp "$work/source.download" "$work/$filename"
  local sha size display slug
  sha="$(sha256sum "$work/source.download" | awk '{print $1}')"
  size="$(stat -c '%s' "$work/source.download")"
  display="$(python3 - "$filename" <<'PY'
import re,sys
s=re.sub(r'[\x00-\x1f/\\]+',' ',sys.argv[1][:-4])
s=re.sub(r'\s+',' ',s).strip(' .')
print((s or 'Audit Source')[:140])
PY
)"
  slug="$(python3 - "$filename" <<'PY'
import re,sys,unicodedata
s=unicodedata.normalize('NFKD',sys.argv[1][:-4]).encode('ascii','ignore').decode().lower()
s=re.sub(r'[^a-z0-9]+','-',s).strip('-')
print((s or 'audit-source')[:120].rstrip('-'))
PY
)"

  printf '%s\n' "$provider" > "$work/provider"
  printf '%s\n' "$canonical_url" > "$work/canonical-url"
  printf '%s\n' "$filename" > "$work/filename"
  printf '%s\n' "$sha" > "$work/sha256"
  printf '%s\n' "$size" > "$work/size"
  printf '%s\n' "$display" > "$work/display-base"
  printf '%s\n' "$slug" > "$work/slug"
}
