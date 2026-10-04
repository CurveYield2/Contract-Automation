#!/usr/bin/env bash
set -euo pipefail

# Browser Monitor Click POF v1
# Display/VNC topology adapted from DmitriyG228/playwright-vnc start.sh
# upstream commit: 3621cf7c2d5307df19c55b75fdbadc5cda064e8c (MIT)

ROOT="${POF_ROOT:-$PWD/process/browser-monitor-pof-v1}"
DISPLAY_NUM=":99"
export DISPLAY="$DISPLAY_NUM"

rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 || true

Xvfb "$DISPLAY_NUM" -screen 0 1280x720x24 -ac +extension RANDR >/tmp/browser-monitor-pof-xvfb-v1.log 2>&1 &
echo $! >/tmp/browser-monitor-pof-xvfb-v1.pid

for i in {1..20}; do
  xdpyinfo -display "$DISPLAY_NUM" >/dev/null 2>&1 && break
  sleep 1
done
xdpyinfo -display "$DISPLAY_NUM" >/dev/null 2>&1

fluxbox >/tmp/browser-monitor-pof-fluxbox-v1.log 2>&1 &
echo $! >/tmp/browser-monitor-pof-fluxbox-v1.pid

x11vnc -display "$DISPLAY_NUM" -forever -nopw -shared -rfbport 5900 -listen 127.0.0.1   >/tmp/browser-monitor-pof-x11vnc-v1.log 2>&1 &
echo $! >/tmp/browser-monitor-pof-x11vnc-v1.pid

websockify --web /usr/share/novnc 0.0.0.0:6080 localhost:5900   >/tmp/browser-monitor-pof-websockify-v1.log 2>&1 &
echo $! >/tmp/browser-monitor-pof-websockify-v1.pid

for i in {1..20}; do
  curl -fsS --connect-timeout 2 --max-time 3 http://127.0.0.1:6080/vnc.html >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --connect-timeout 3 --max-time 5 http://127.0.0.1:6080/vnc.html >/dev/null

CHROME_EXECUTABLE="${CHROME_EXECUTABLE:-$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser)}"
test -n "$CHROME_EXECUTABLE"
export CHROME_EXECUTABLE

rm -rf /tmp/browser-monitor-pof-userdata-v1
mkdir -p /tmp/browser-monitor-pof-userdata-v1

nohup node "$ROOT/launch-browser-v1.mjs" >/tmp/browser-monitor-pof-chrome-v1.log 2>&1 &
echo $! >/tmp/browser-monitor-pof-chrome-v1.pid

for i in {1..60}; do
  curl -fsS --connect-timeout 2 --max-time 3 http://127.0.0.1:9222/json/version >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --connect-timeout 3 --max-time 5 http://127.0.0.1:9222/json/version >/dev/null

echo "BROWSER_MONITOR_POF_STACK_READY"
