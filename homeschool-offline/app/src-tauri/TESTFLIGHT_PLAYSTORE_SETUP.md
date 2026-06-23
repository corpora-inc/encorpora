# TestFlight & Play Store Setup - Quick Start

## ✅ What's Already Done

- ✅ iOS project initialized
- ✅ Android project initialized
- ✅ iOS signing configuration files created (project.yml, ExportOptions.plist)
- ✅ tauri.conf.json updated with signing settings
- ✅ .gitignore updated to exclude sensitive files
- ✅ Android keystore generation script ready

## 🚀 Next Steps

### 1. iOS Signing Setup (Required for TestFlight)

You need to fill in your Apple Developer credentials:

**a) Get your Team ID from Apple Developer Portal:**
   - Visit: https://developer.apple.com/account
   - Copy your Team ID (format: 10 characters like `F9AV5HKF6N`)

**b) Option 1: Use Wildcard Provisioning (Like corpan-app)**
   - If you have wildcard provisioning (`com.corpora.*`), you can reuse it
   - Use the same Team ID: `F9AV5HKF6N`
   - Use the same profile UUID: `4d5c5e29-f71e-4053-a7b6-fc1d5874d97a`
   - Bundle ID is already set to `com.homeschool.offline` (matches wildcard)

**b) Option 2: Create New App-Specific Provisioning**
   - Visit: https://developer.apple.com/account/resources/profiles
   - Create "App Store" provisioning profile for `com.homeschool.offline`
   - Download and note the UUID

**c) Update these files with your credentials:**

Edit `src-tauri/ios/project.yml`:
```yaml
DEVELOPMENT_TEAM: F9AV5HKF6N  # Replace YOUR_TEAM_ID_HERE
CODE_SIGN_IDENTITY: "iPhone Distribution"
PROVISIONING_PROFILE_SPECIFIER: "4d5c5e29-f71e-4053-a7b6-fc1d5874d97a"  # Replace YOUR_PROVISIONING_PROFILE_UUID_HERE
```

Edit `src-tauri/ios/ExportOptions.plist`:
```xml
<key>teamID</key>
<string>F9AV5HKF6N</string>  <!-- Replace YOUR_TEAM_ID_HERE -->

<key>com.homeschool.offline</key>
<string>4d5c5e29-f71e-4053-a7b6-fc1d5874d97a</string>  <!-- Replace YOUR_PROVISIONING_PROFILE_UUID_HERE -->
```

Edit `src-tauri/tauri.conf.json`:
```json
"developmentTeam": "F9AV5HKF6N",  // Replace YOUR_TEAM_ID_HERE
"signingIdentity": "3rd Party Mac Developer Application: Corpora Inc (F9AV5HKF6N)"  // Replace YOUR_TEAM_ID_HERE
```

### 2. Android Keystore Setup (Required for Play Store)

**Option A: Generate New Keystore (Recommended)**
```bash
cd src-tauri
./generate-android-keystore.sh
```
Follow the prompts and **save the password securely in 1Password**.

**Option B: Copy from corpan-app (If shared signing is OK)**
```bash
cd src-tauri
cp ../../corpan/corpan-app/src-tauri/upload-keystore.jks ./
```
You'll need the existing keystore password.

### 3. Build for TestFlight (iOS)

```bash
# From the app directory
npm run tauri ios build --release
```

Output will be at:
```
src-tauri/gen/apple/build/arm64/Homeschool Offline.ipa
```

**Upload to TestFlight:**
1. Open Transporter app (or use Xcode)
2. Drag the `.ipa` file into Transporter
3. Sign in with your Apple ID
4. Click "Deliver"

### 4. Build for Play Store Internal Testing (Android)

```bash
# Set keystore credentials (use your actual password)
export ANDROID_KEYSTORE_PASSWORD='your_password_here'
export ANDROID_KEY_PASSWORD='your_password_here'
export ANDROID_KEY_ALIAS='homeschool-offline'

# Build
npm run tauri android build --release
```

Output will be at:
```
src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab
```

**Upload to Play Console:**
1. Visit: https://play.google.com/console
2. Create new app or select existing
3. Go to "Testing" → "Internal testing"
4. Create new release
5. Upload the `.aab` file
6. Add testers by email
7. Publish to internal testing

## 🔒 Security Checklist

Before committing:
- [ ] `upload-keystore.jks` is in `.gitignore` (already done)
- [ ] Passwords are saved in 1Password
- [ ] No passwords in any committed files
- [ ] `.mobileprovision` files not committed (if any)

## 🐛 Troubleshooting

**iOS Build Fails with "Signing Identity not found":**
- Verify your Apple Developer certificate is installed in Keychain
- Check that Team ID and Provisioning Profile UUID are correct
- Run `security find-identity -v -p codesigning` to see available signing identities

**Android Build Fails with "Keystore not found":**
- Make sure `upload-keystore.jks` exists in `src-tauri/`
- Verify environment variables are set
- Check that keystore alias is `homeschool-offline`

**"This app requires a newer iOS version":**
- Current minimum: iOS 14.0 (covers 99%+ of devices)
- Can be lowered in `src-tauri/ios/project.yml` if needed

## 📚 Full Documentation

See `SIGNING_SETUP.md` for complete details on:
- Detailed signing configuration
- CI/CD setup (future)
- Signature verification
- Security best practices

## ⏭️ After First Successful Build

1. **iOS**: Set up automatic version bumping
2. **Android**: Configure internal testing track
3. **Both**: Set up crash reporting (Sentry, Firebase, etc.)
4. **Both**: Configure analytics if needed
5. **CI/CD**: Automate builds with GitHub Actions

## 🎉 Success Criteria

You're ready for TestFlight/Play Store when:
- [x] iOS project builds successfully
- [x] Android project builds successfully
- [x] .ipa file generated and signed correctly
- [x] .aab file generated and signed correctly
- [x] You can upload to TestFlight without errors
- [x] You can upload to Play Console without errors
- [x] TestFlight build appears in App Store Connect
- [x] Internal testing track created in Play Console

## 🔗 Quick Links

- Apple Developer: https://developer.apple.com/account
- App Store Connect: https://appstoreconnect.apple.com
- Play Console: https://play.google.com/console
- Transporter (iOS uploads): https://apps.apple.com/app/transporter/id1450874784
