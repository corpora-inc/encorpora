# Homeschool Offline — TestFlight & Play Store setup

Status: **not wired into CI.** Nothing under `homeschool-offline/` is built by
`.github/workflows/release-mobile.yml` — that pipeline ships Corpán only. Everything
below is the manual, local path. If this app ever ships regularly, wire it into the
existing workflow rather than repeating this by hand.

Bundle id: **`com.corpora.homeschool`** (`tauri.conf.json` → `identifier`).

## iOS signing — you need a dedicated App ID

**Do not reuse Corpán's provisioning profile.** A provisioning profile is bound to the
App ID it was issued for; signing a different bundle id with it fails, and if it did
succeed App Store Connect would reject the upload because the binary's bundle id does
not match the app record.

**Do not use a wildcard App ID either.** A wildcard App ID (`com.corpora.*`) cannot
carry the capabilities a shipping app needs — In-App Purchase, Push Notifications,
App Groups and Sign in with Apple all require an **explicit** App ID. A wildcard
profile gets you a build that installs locally and then dies at the first purchase
call.

The real procedure, once:

1. **Register an explicit App ID** at
   <https://developer.apple.com/account/resources/identifiers> for
   `com.corpora.homeschool`. Enable exactly the capabilities the app uses.
2. **Create the App Store Connect app record** for that same bundle id at
   <https://appstoreconnect.apple.com>.
3. **Create an App Store distribution provisioning profile** for that App ID at
   <https://developer.apple.com/account/resources/profiles> (type: *App Store*), tied
   to your Apple Distribution certificate. Download it and note its UUID.
4. **Fill in the config files** with your own Team ID and the UUID from step 3.
   Neither value belongs in a committed doc — read them from the developer portal.

   `src-tauri/ios/project.yml`:
   ```yaml
   DEVELOPMENT_TEAM: <YOUR_TEAM_ID>
   CODE_SIGN_IDENTITY: "Apple Distribution"
   PROVISIONING_PROFILE_SPECIFIER: <YOUR_PROFILE_UUID>
   PRODUCT_BUNDLE_IDENTIFIER: com.corpora.homeschool
   ```

   `src-tauri/ios/ExportOptions.plist` — under `provisioningProfiles`, map the bundle
   id to the profile:
   ```xml
   <key>com.corpora.homeschool</key>
   <string>YOUR_PROFILE_UUID</string>
   ```

   `src-tauri/tauri.conf.json`:
   ```json
   "developmentTeam": "<YOUR_TEAM_ID>"
   ```
   `signingIdentity` there is the **macOS** identity and is irrelevant to an iOS
   TestFlight build; leave it alone unless you are shipping the Mac target.

5. Confirm the certificate is actually in your keychain:
   ```bash
   security find-identity -v -p codesigning
   ```

## Android signing

Generate this app's **own** upload keystore. Do not copy Corpán's — Play ties the
upload key to the app listing, and sharing one key across two listings means one
compromise burns both.

```bash
cd src-tauri
./generate-android-keystore.sh   # writes upload-keystore.jks, alias `homeschool-offline`
```

Store the passwords in a password manager. The keystore is gitignored; losing it means
you cannot update the listing without a Play key-reset request.

## Build

iOS:
```bash
npm run tauri ios build --release
# → src-tauri/gen/apple/build/arm64/Homeschool Offline.ipa
```
Upload with Transporter, or `xcrun altool` / `notarytool` from the command line.

Android:
```bash
export ANDROID_KEYSTORE_PASSWORD='…'
export ANDROID_KEY_PASSWORD='…'
export ANDROID_KEY_ALIAS='homeschool-offline'
npm run tauri android build --release
# → src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab
```
Upload the `.aab` to Play Console → Testing → Internal testing.

Build numbers must increase monotonically on both stores. Corpán derives them from
`$(date +%s)/60` in `release-mobile.yml`; do the same here rather than hand-incrementing.

## Before committing

- `upload-keystore.jks` is gitignored — confirm it is not staged.
- No passwords, `.p8` keys, key ids, issuer ids, profile UUIDs or `.mobileprovision`
  files in any tracked file. **This repository is public.**

## Troubleshooting

**"Signing identity not found"** — the Apple Distribution certificate is not in the
keychain, or the profile UUID does not match a profile in
`~/Library/MobileDevice/Provisioning Profiles/`.

**Upload rejected for bundle-id mismatch** — you signed with a profile issued for a
different App ID. Go back to step 1.

**"Keystore not found"** — `upload-keystore.jks` is missing from `src-tauri/`, or the
alias is not `homeschool-offline`.

## See also

`SIGNING_SETUP.md` (detail), `BUILD_COMMANDS.md`, and
`corpan/corpan-app/RELEASE_SETUP.md` for how the automated Corpán pipeline does all of
this in GitHub Actions.
