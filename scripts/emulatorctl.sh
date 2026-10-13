#!/usr/bin/env bash
set -uo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
AVD_NAME="${SH_AVD_NAME:-sh_test}"
RUN_DIR="/tmp/emu-run"
PIDFILE="$RUN_DIR/emulator.pid"
LOGFILE="$RUN_DIR/emulator.log"
SHOT_DIR="$RUN_DIR/shots"
SERIAL="emulator-5554"

mkdir -p "$RUN_DIR" "$SHOT_DIR"

start_adb() {
  "$ADB" start-server >/dev/null 2>&1
}

wait_for_boot() {
  local timeout="${1:-240}"
  local waited=0
  while (( waited < timeout )); do
    if "$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | grep -q "^1$"; then
      return 0
    fi
    sleep 3
    waited=$(( waited + 3 ))
  done
  return 1
}

case "${1:-}" in
  start)
    start_adb
    if "$ADB" devices | grep -q "$SERIAL.*device$"; then
      echo "already running"
    else
      nohup "$EMULATOR" -avd "$AVD_NAME" \
        -no-window -no-audio -no-boot-anim \
        -gpu swiftshader \
        -no-snapshot \
        -memory 1536 \
        -partition-size 2048 \
        -camera-back none -camera-front none \
        -no-metrics \
        >"$LOGFILE" 2>&1 &
      echo $! >"$PIDFILE"
      disown
    fi
    echo "waiting for boot..."
    if wait_for_boot 300; then
      echo "booted"
      "$ADB" -s "$SERIAL" shell getprop ro.build.version.release | tr -d '\r' | sed 's/^/android /'
      exit 0
    fi
    echo "boot timed out"
    tail -20 "$LOGFILE" >&2
    exit 1
    ;;
  status)
    "$ADB" devices
    echo "boot_completed=$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    ;;
  stop)
    "$ADB" -s "$SERIAL" emu kill >/dev/null 2>&1
    sleep 2
    pkill -f "qemu-system-x86_64.*$AVD_NAME" >/dev/null 2>&1
    rm -f "$PIDFILE"
    echo "stopped"
    ;;
  shot)
    name="${2:-shot}"
    "$ADB" -s "$SERIAL" exec-out screencap -p > "$SHOT_DIR/$name.png" 2>/dev/null
    echo "$SHOT_DIR/$name.png"
    ;;
  shell)
    shift
    "$ADB" -s "$SERIAL" shell "$@"
    ;;
  install)
    shift
    "$ADB" -s "$SERIAL" install -r "$@"
    ;;
  *)
    echo "usage: $0 {start|status|stop|shot [name]|shell <cmd>|install <apk>}" >&2
    exit 2
    ;;
esac
