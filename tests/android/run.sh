#!/usr/bin/env bash
# Runs inside the emulator job of the Build workflow:
#  1) the release APK (the file people install) must install and start;
#  2) the walk-through (e2e.mjs) on the test build, which is the same app with WebView debugging on.
# Everything lands in tests/android/out (screenshots, logs, saved files).
set -u
OUT=tests/android/out
PKG=com.shajara.familytree
mkdir -p "$OUT"

adb wait-for-device
adb shell settings put system screen_off_timeout 1800000
adb shell svc power stayon true
adb shell input keyevent 82
sleep 2
{
  echo "android $(adb shell getprop ro.build.version.release) (API $(adb shell getprop ro.build.version.sdk))"
  echo "screen: $(adb shell wm size | tail -1), $(adb shell wm density | tail -1)"
  adb shell dumpsys webviewupdate | grep -m1 -i "current webview package"
} | tr -d '\r' > "$OUT/device.txt"

# 1) the release APK
adb install -r rel/shajara.apk >> "$OUT/device.txt" 2>&1
adb shell dumpsys package "$PKG" | grep -E "versionName|versionCode|permission" | tr -d '\r' > "$OUT/release-package.txt"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 20
adb exec-out screencap -p > "$OUT/00-release-launch.png"
RELEASE_OK=1
if adb shell pidof "$PKG" > /dev/null; then echo "release app: running" >> "$OUT/device.txt"
else echo "release app: NOT RUNNING" >> "$OUT/device.txt"; RELEASE_OK=0; fi
adb logcat -d | grep -E "AndroidRuntime|FATAL|Capacitor|chromium" | tail -200 > "$OUT/release-log.txt"
adb uninstall "$PKG" >> "$OUT/device.txt" 2>&1

# 2) the walk-through on the test build
python3 tests/make_sample.py tests/android/sample137.json > /dev/null
adb install -r test/shajara-test.apk >> "$OUT/device.txt" 2>&1
adb logcat -c
node tests/android/e2e.mjs
E2E=$?
adb logcat -d | grep -E "AndroidRuntime|FATAL|Capacitor|chromium" | tail -400 > "$OUT/test-log.txt"

echo "release=$RELEASE_OK e2e=$E2E" | tee -a "$OUT/device.txt"
[ "$RELEASE_OK" = 1 ] && [ "$E2E" = 0 ]
