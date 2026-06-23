# Google Play Automation with Fastlane

This guide shows how to automate **all** Google Play Store operations via CLI/API, including metadata updates. This scales to 100+ apps.

## One-Time Setup (Per App)

### 1. Create Google Cloud Service Account

1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing): "Homeschool Offline API"
3. Enable **Google Play Android Developer API**:
   - Search for "Google Play Android Developer API"
   - Click Enable
4. Create Service Account:
   - Go to IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Name: `fastlane-deployer`
   - Grant role: `Service Account User`
   - Click "Create Key" → JSON
   - Download the JSON file
5. Save JSON key to: `fastlane/google-play-key.json`
6. Add to `.gitignore`: `google-play-key.json`

### 2. Link Service Account to Play Console

1. Go to https://play.google.com/console/
2. Navigate to: **Setup → API access**
3. Click "Link" next to your service account
4. Grant permissions:
   - ✅ Admin (Releases) - for uploading APKs
   - ✅ Edit store listing - for metadata updates
   - ✅ Manage testing tracks - for internal/beta releases

### 3. Update Fastlane Appfile

Edit `fastlane/Appfile`:

```ruby
# For Android
json_key_file("fastlane/google-play-key.json")
package_name("com.corpora.homeschool")
```

### 4. First-Time Manual Setup (Only Once)

You need to manually complete these in Play Console **one time** before automation works:

**Required (app won't go live without these):**
- Privacy policy URL
- App category
- Content rating questionnaire
- Target audience (age groups)
- Data safety form
- Contact details (email, phone, address)

**Tip:** Do these once, then Fastlane handles all updates going forward.

---

## Metadata Structure

All app metadata lives in `fastlane/metadata/android/en-US/`:

```
fastlane/metadata/android/
└── en-US/
    ├── title.txt              # App name (max 50 chars)
    ├── short_description.txt  # Short desc (max 80 chars)
    ├── full_description.txt   # Long desc (max 4000 chars)
    ├── video.txt              # YouTube URL (optional)
    ├── images/
    │   ├── icon.png           # 512x512 PNG
    │   ├── featureGraphic.png # 1024x500 PNG
    │   ├── phoneScreenshots/  # 2-8 images, 16:9 or 9:16
    │   │   ├── 1_home.png
    │   │   ├── 2_calendar.png
    │   │   └── 3_settings.png
    │   └── sevenInchScreenshots/  # Tablet (optional)
    └── changelogs/
        └── 12.txt             # Version 12 changelog (max 500 chars)
```

### Multiple Languages

Add more locales as needed:

```
metadata/android/
├── en-US/
├── es-ES/
├── fr-FR/
└── de-DE/
```

---

## CLI Commands

### Download Current Metadata from Play Store

```bash
cd /Users/skyl/Code/corpora/encorpora/homeschool-offline/app
fastlane android download_metadata
```

This creates the full metadata structure from your current Play Store listing.

### Upload Metadata Only

```bash
fastlane android upload_metadata
```

Updates descriptions, screenshots, etc. without uploading a new APK.

### Upload APK to Internal Testing

```bash
# Build first
npm run tauri android build -- --target aarch64

# Upload to internal track
fastlane android internal
```

### Upload APK to Beta (Closed Testing)

```bash
fastlane android beta
```

### Upload Both Metadata + APK

```bash
fastlane android release
```

### Promote Internal → Beta

```bash
fastlane android promote_to_beta
```

### Promote Beta → Production

```bash
fastlane android promote_to_production
```

---

## Example: Update App Description

1. Edit `metadata/android/en-US/full_description.txt`:

```
Homeschool Offline is a 100% offline calendar app for homeschooling parents.

✨ Features:
• Track homeschool days
• Add daily notes
• Attach photos
• Export/import all data
• Multiple students
• Complete privacy - no cloud

📱 Works on all devices:
• iPhone & iPad
• Android phones & tablets
• macOS, Windows, Linux

🔒 Your data stays yours:
• 100% offline
• No login required
• No subscriptions
• No ads
```

2. Run:

```bash
fastlane android upload_metadata
```

Done! Description updated on Play Store.

---

## Scaling to 100+ Apps

### Repository Structure

```
corpora-apps/
├── homeschool-offline/
│   ├── app/
│   └── fastlane/
│       ├── google-play-key.json (gitignored, use env var instead)
│       └── metadata/
├── reading-app/
│   ├── app/
│   └── fastlane/
│       └── metadata/
└── math-app/
    ├── app/
    └── fastlane/
        └── metadata/
```

### Shared Fastfile Template

Create `shared/Fastfile.template` for all apps:

```ruby
platform :android do
  lane :release do |options|
    upload_to_play_store(
      package_name: ENV['PACKAGE_NAME'],
      json_key: ENV['GOOGLE_PLAY_KEY_PATH'],
      apk: options[:apk],
      track: 'internal'
    )
  end
end
```

### CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy Android

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build APK
        run: |
          cd app
          npm install
          npm run tauri android build -- --target aarch64

      - name: Setup Fastlane
        run: |
          gem install fastlane
          echo "${{ secrets.GOOGLE_PLAY_KEY }}" > fastlane/google-play-key.json

      - name: Upload to Play Store
        run: fastlane android internal
```

### Environment Variables

Store keys securely:

```bash
# In CI/CD or .env
export GOOGLE_PLAY_KEY_PATH="/path/to/key.json"
export PACKAGE_NAME="com.corpora.homeschool"
```

---

## What Can Be Automated?

✅ **Fully Automated:**
- App descriptions (all languages)
- Screenshots
- Feature graphics
- APK/AAB uploads
- Release track promotions (internal → beta → production)
- Changelogs
- Version codes/names

⚠️ **One-Time Manual Setup:**
- Privacy policy URL
- App category
- Content rating
- Target audience
- Data safety form
- Developer account details

❌ **Not Automatable:**
- App review appeals
- Developer account verification

---

## Tips

1. **Test with Internal Track First:** Always upload to `internal` track first, test thoroughly, then promote.

2. **Staged Rollouts:** Use `rollout: 0.1` to release to 10% of users first:
   ```ruby
   upload_to_play_store(
     track: 'production',
     rollout: 0.1
   )
   ```

3. **Multiple APKs:** If you build both ARM and x86:
   ```ruby
   upload_to_play_store(
     apk_paths: [
       'app-arm64-v8a-release.apk',
       'app-x86_64-release.apk'
     ]
   )
   ```

4. **Shared Metadata Across Apps:** Symlink common assets:
   ```bash
   ln -s ../../shared/privacy-policy.txt metadata/android/en-US/
   ```

---

## Next Steps

1. Complete the one-time manual setup in Play Console
2. Run `fastlane android download_metadata` to pull current state
3. Edit metadata files in `metadata/android/en-US/`
4. Test with `fastlane android upload_metadata`
5. Set up CI/CD for automated deployments

For 100 apps, this same pattern repeats with different package names and service accounts. All controlled via git!
