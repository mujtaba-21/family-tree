#!/usr/bin/env bash
# Adjusts the generated Android project:
#  - no INTERNET permission at all (the system itself blocks any network access)
#  - no automatic cloud backup of app data
#  - app name, icons, splash, version
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/android/app"
MAN="$APP/src/main/AndroidManifest.xml"
RES="$APP/src/main/res"
RUN="${GITHUB_RUN_NUMBER:-1}"

python3 - "$MAN" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "xmlns:tools" not in s:
    s = s.replace("<manifest ", '<manifest xmlns:tools="http://schemas.android.com/tools" ', 1)
s = re.sub(r'\s*<uses-permission android:name="android.permission.INTERNET"\s*/>', "", s)
s = re.sub(r'\s*<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"\s*/>', "", s)
block = (
    '\n    <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />'
    '\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" tools:node="remove" />'
    '\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />'
    '\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />'
)
s = s.replace("</manifest>", block + "\n</manifest>")
s = re.sub(r'android:allowBackup="true"', 'android:allowBackup="false" android:fullBackupContent="false" android:requestLegacyExternalStorage="true"', s)
if 'android:allowBackup="false"' not in s:
    s = s.replace("<application", '<application android:allowBackup="false" android:fullBackupContent="false" android:requestLegacyExternalStorage="true"', 1)
open(p, "w", encoding="utf-8").write(s)
print(s)
PY

# app name
python3 - "$RES/values/strings.xml" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s = re.sub(r'(<string name="app_name">)[^<]*(</string>)', r'\1شجرة العائلة\2', s)
s = re.sub(r'(<string name="title_activity_main">)[^<]*(</string>)', r'\1شجرة العائلة\2', s)
open(p, "w", encoding="utf-8").write(s)
PY

# icons
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  mkdir -p "$RES/mipmap-$d"
  cp "$HERE/res/mipmap-$d/"*.png "$RES/mipmap-$d/"
done
mkdir -p "$RES/values"
cat > "$RES/values/ic_launcher_background.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#2F5D50</color>
    <color name="splash_bg">#F4EFE5</color>
</resources>
XML

# splash: plain background with the icon in the middle (replaces the default Capacitor logo)
find "$RES" -name 'splash.png' -delete
mkdir -p "$RES/drawable"
cat > "$RES/drawable/splash.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_bg" />
    <item android:width="112dp" android:height="112dp" android:gravity="center" android:drawable="@mipmap/ic_launcher" />
</layer-list>
XML

# version
sed -i -E "s/versionCode [0-9]+/versionCode ${RUN}/; s/versionName \"[^\"]*\"/versionName \"1.0.${RUN}\"/" "$APP/build.gradle"
grep -E "versionCode|versionName" "$APP/build.gradle"
