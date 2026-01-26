# Build Commands for App Store Submission

## ✅ Signing is Already Configured!

All signing configuration is complete and ready to use:
- ✅ iOS Team ID: F9AV5HKF6N (Corpora Inc wildcard `com.corpora.*`)
- ✅ iOS Provisioning Profile: 4d5c5e29-f71e-4053-a7b6-fc1d5874d97a
- ✅ Android Keystore: upload-keystore.jks (shared with corpan-app)
- ✅ Bundle ID: `com.corpora.homeschool`

## 🍎 Build for TestFlight (iOS)

```bash
npm run tauri ios build --release
```

The signed `.ipa` will be at:
```
src-tauri/gen/apple/build/arm64/Homeschool Offline.ipa
```

**Upload to TestFlight:**
- Open Transporter app
- Drag the .ipa file
- Sign in and upload

## 🤖 Build for Play Store (Android)

```bash
npm run tauri android build --release
```

During the build, you'll be prompted for:
1. **Enter keystore password:** Type the shared keystore password
2. **Enter key password:** Just press Enter (uses same password)

The signed `.aab` will be at:
```
src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab
```

**Upload to Play Console:**
- Visit https://play.google.com/console
- Go to Internal Testing
- Upload the .aab file

## 🧪 Test Builds Locally

**iOS (requires Mac + Xcode):**
```bash
npm run tauri ios build
```

**Android:**
```bash
npm run tauri android build
```

## 🐛 Troubleshooting

**iOS: "Signing identity not found"**
- Make sure you're on a Mac with Xcode installed
- Check that the Apple Developer certificate is installed in Keychain
- Run: `security find-identity -v -p codesigning`

**Android: "keystore password incorrect"**
- Double-check the password when prompted
- Make sure you're typing it correctly (no extra spaces)

## 📱 Device Testing

**iOS (via Xcode):**
```bash
npm run tauri ios dev --open
```
Then run from Xcode on connected device.

**Android (via Android Studio):**
```bash
npm run tauri android dev --open
```
Then run from Android Studio on connected device/emulator.

## 🚀 Deployment Checklist

Before uploading:
- [ ] Version number bumped in `tauri.conf.json`
- [ ] Release notes prepared
- [ ] All features tested on device
- [ ] No console errors or warnings
- [ ] App icon looks good
- [ ] Permissions are correct

After uploading:
- [ ] TestFlight: Add testers in App Store Connect
- [ ] Play Store: Publish to Internal Testing track
- [ ] Add internal testers
- [ ] Test installation on real devices
- [ ] Check for crash reports
