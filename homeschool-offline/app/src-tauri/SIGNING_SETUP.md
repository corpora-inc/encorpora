# Signing Setup for Homeschool Offline

This document explains how to set up code signing for iOS and Android builds.

## iOS Signing Setup

### Prerequisites
- Apple Developer Account with Corpora Inc team membership
- Xcode installed on your Mac
- Access to Apple Developer Portal

### Steps

1. **Get Your Team ID**
   - Log into https://developer.apple.com/account
   - Go to Membership
   - Copy your Team ID (currently using `F9AV5HKF6N` for Corpora Inc)

2. **Create/Download Provisioning Profile**
   - Go to https://developer.apple.com/account/resources/profiles
   - Create a new "App Store" provisioning profile
   - Bundle ID: `com.homeschool.offline`
   - Download the profile and note its UUID (you can see this in the filename or by opening it)

3. **Update iOS Configuration Files**

   Edit `src-tauri/ios/project.yml`:
   - Replace `YOUR_TEAM_ID_HERE` with your Team ID
   - Replace `YOUR_PROVISIONING_PROFILE_UUID_HERE` with your provisioning profile UUID
   - Update `CODE_SIGN_IDENTITY` if needed (should be "iPhone Distribution")

   Edit `src-tauri/ios/ExportOptions.plist`:
   - Replace `YOUR_TEAM_ID_HERE` with your Team ID
   - Replace `YOUR_PROVISIONING_PROFILE_UUID_HERE` with your provisioning profile UUID

4. **Update tauri.conf.json**
   - Add iOS signing configuration (see below)

### Using Wildcard Provisioning (Like corpan-app)

If you have a wildcard provisioning profile (`com.corpora.*`), you can reuse it:
- The profile UUID would be the same as corpan-app: `4d5c5e29-f71e-4053-a7b6-fc1d5874d97a`
- You'll need to ensure the bundle ID is under the wildcard domain

## Android Signing Setup

### Option 1: Generate New Keystore (Recommended for separate apps)

Generate a new keystore specifically for Homeschool Offline:

```bash
cd src-tauri
keytool -genkey -v -keystore upload-keystore.jks -alias homeschool-offline \
  -keyalg RSA -keysize 2048 -validity 10000 -storepass YOUR_STORE_PASSWORD
```

When prompted, provide:
- Key password: (choose a strong password, save it securely)
- Your name: Homeschool Offline
- Organization: Corpora Inc
- City, State, Country: (your details)

**IMPORTANT**: Save the following information securely (1Password, etc.):
- Keystore password (store password)
- Key alias: `homeschool-offline`
- Key password

### Option 2: Copy Existing Keystore from corpan-app

If you want to reuse the corpan-app keystore (not recommended unless they're closely related):

```bash
cp ../../corpan/corpan-app/src-tauri/upload-keystore.jks ./upload-keystore.jks
```

You'll need the existing keystore password and alias.

### Android Build Configuration

The keystore will be used automatically by Tauri during Android builds. You'll need to provide the credentials via environment variables:

```bash
export ANDROID_KEYSTORE_PASSWORD="your_store_password"
export ANDROID_KEY_PASSWORD="your_key_password"
export ANDROID_KEY_ALIAS="homeschool-offline"
```

Or create a `key.properties` file (DO NOT commit to git):

```properties
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=homeschool-offline
storeFile=../upload-keystore.jks
```

## Update tauri.conf.json

Add the following to your `tauri.conf.json`:

```json
{
  "bundle": {
    "iOS": {
      "minimumSystemVersion": "14.0",
      "developmentTeam": "YOUR_TEAM_ID_HERE",
      "template": "ios/project.yml"
    },
    "macOS": {
      "signingIdentity": "3rd Party Mac Developer Application: Corpora Inc (YOUR_TEAM_ID_HERE)"
    }
  }
}
```

## TestFlight Upload (iOS)

Once signing is configured:

1. Build the iOS app:
   ```bash
   npm run tauri ios build
   ```

2. Archive will be created at:
   ```
   src-tauri/gen/apple/build/arm64/Homeschool Offline.ipa
   ```

3. Upload to TestFlight using Xcode or Transporter app:
   - Open Transporter
   - Drag the .ipa file
   - Sign in with your Apple ID
   - Upload

## Play Store Internal Testing (Android)

Once signing is configured:

1. Build the Android app:
   ```bash
   npm run tauri android build
   ```

2. AAB will be created at:
   ```
   src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab
   ```

3. Upload to Play Console:
   - Go to https://play.google.com/console
   - Select app or create new app
   - Go to "Internal testing"
   - Upload the AAB file
   - Add testers by email

## Security Notes

1. **Never commit sensitive files to git**:
   - `upload-keystore.jks` (Android keystore)
   - `key.properties` (Android keystore credentials)
   - `.p12` or `.cer` files (iOS certificates)
   - `.mobileprovision` files (iOS provisioning profiles)

2. **Add to .gitignore**:
   ```
   src-tauri/upload-keystore.jks
   src-tauri/key.properties
   src-tauri/ios/*.mobileprovision
   src-tauri/ios/*.p12
   src-tauri/ios/*.cer
   ```

3. **Store credentials securely**:
   - Use 1Password, LastPass, or similar for passwords
   - Use GitHub Secrets for CI/CD
   - Never share passwords in chat or email

## Verification

Before submitting to stores, verify signing:

### iOS
```bash
# Check the IPA signature
codesign -dvv "src-tauri/gen/apple/build/arm64/Homeschool Offline.app"
```

### Android
```bash
# Check the AAB signature
jarsigner -verify -verbose -certs src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab
```

## CI/CD Integration (Future)

For automated builds in GitHub Actions, you'll need to:
1. Store keystore as base64-encoded secret
2. Store passwords as GitHub Secrets
3. Configure provisioning profiles for iOS
4. Set up automatic versioning

See corpan-app's CI/CD setup for reference once you're ready to automate.
