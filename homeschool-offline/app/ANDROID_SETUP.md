# Android Setup Notes

## Permissions

After running `npm run tauri android init`, you need to manually add permissions to the AndroidManifest.xml file.

**File location:** `src-tauri/gen/android/app/src/main/AndroidManifest.xml`

**Required permissions:** (add after the INTERNET permission)

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

## Why these permissions?

- `CAMERA` - Required for camera access (though Android picker handles this via its own permissions)
- `READ_EXTERNAL_STORAGE` - For Android 12 and below to read images/videos
- `READ_MEDIA_IMAGES` - For Android 13+ to read images
- `READ_MEDIA_VIDEO` - For Android 13+ to read videos
- `hardware.camera` - Declares camera feature (not required, so app works on devices without camera)

## Build & Test

```bash
# Development build
npm run tauri android dev

# Release build for Play Store
npm run tauri android build
```

## File Handling on Android

The app uses Tauri's dialog plugin for file picking on Android, which properly handles:
- Android content URIs (content://)
- Storage Access Framework (SAF)
- Runtime permission requests

Desktop uses HTML file inputs which work fine with regular file paths.

## 16KB Page Size Support

The app is configured to support 16KB memory page sizes (required for Android 15+) via linker flags in `.cargo/config.toml`.
