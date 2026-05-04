# Marketing assets — layout and workflow

App Store / Play Store screenshots and App Previews live in S3, not git, so
binaries don't bloat the repo and multiple agents/workstations can share them.

- **Bucket**: `s3://corpan-assets/marketing/`  (region `us-east-2`)
- **Local mirror**: `~/encorpora/marketing/`
- **Sync up**:    `infra/sync-marketing-to-s3.sh`
- **Sync down**:  `infra/hydrate-marketing.sh`

Both scripts auto-source `~/Code/corpora/encorpora/.env` for AWS creds; you can
also export `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` or set `AWS_PROFILE`.

## Directory layout

```
marketing/
  <platform>/                  # ios | android
    <device>/                  # ipad-13 | iphone-6.9 | phone | tablet-10 | ...
      <app-version>/           # 0.12.1, 0.13.0, ...
        screenshots/
          raw/                 # everything captured, archived by date
            YYYY-MM-DD/
              IMG_xxxx.PNG     # native filename from device
              ...
          final/               # curated set actually uploaded to the store
            01-home.png
            02-stargate-narration.png
            ...
        app-previews/
          raw/
            YYYY-MM-DD/
              recording-N.mov
          final/
            01-stargate-reader.mov
            02-world-radio.mov
            03-pack-discovery.mov
```

## Axis conventions

| Axis | Allowed values | Notes |
|------|----------------|-------|
| `platform` | `ios`, `android` | One per app store. |
| `device` | `iphone-6.9`, `iphone-6.5`, `ipad-13`, `phone`, `tablet-7`, `tablet-10` | Matches the upload slot in App Store Connect / Play Console. iPhone 6.9" is now Apple's required baseline (replaced 6.5"); 6.5" only needed if shipping a fallback set. iPad 13" covers iPad Pro 12.9" (2732×2048) and 13" M4 (2752×2064). |
| `app-version` | dotted semver from `corpan-app/src-tauri/tauri.conf.json` | Bump when the captured UI no longer reflects what's shipping. |
| asset type | `screenshots`, `app-previews` | Both stores accept both kinds. |
| `raw/` | full capture sessions, by date | Keep everything; cheap and traceable. |
| `final/` | curated upload set, ordered names | `NN-slug.ext` so the order matches what the store displays. |

## Capture sources by platform

- **iOS, real device over USB** (preferred for App Store — uses real production
  rendering): pull screenshots and screen-recordings from the Camera Roll via
  `afcclient` (libimobiledevice). Example:
  ```
  UDID=$(idevice_id -l | head -1)
  afcclient -u "$UDID" ls DCIM/100APPLE/
  afcclient -u "$UDID" get DCIM/100APPLE/IMG_0051.PNG ./IMG_0051.PNG
  ```
  Stash under `marketing/ios/<device>/<version>/screenshots/raw/<YYYY-MM-DD>/`.
- **iOS Simulator** (fallback when the right hardware isn't available, e.g. for
  the iPad 13" slot when only an iPhone is to hand): `xcrun simctl io booted
  screenshot out.png` and `xcrun simctl io booted recordVideo out.mov`.
- **Android device over ADB**: `adb shell screencap -p > out.png` and
  `adb shell screenrecord /sdcard/out.mp4`.

## Capture specs (current as of 2026-05)

- **iPad 13" screenshots**: 2064×2752 (M4) or 2048×2732 (12.9" Pro), portrait
  or landscape. App Store Connect accepts either resolution for the 13" slot.
- **iPhone 6.9" screenshots**: 1290×2796 (e.g. iPhone 16 Pro Max, native).
- **App Previews**: 15–30 s, `.mov` or `.mp4` (H.264), no overlays/hands/
  third-party content beyond what the user controls. Up to 3 per locale per
  device size. Up to 10 screenshots per locale per device size.

## Workflow

1. Capture on device → screenshots land in Camera Roll, recordings in Photos.
2. Pull to `marketing/<platform>/<device>/<version>/<asset-type>/raw/<YYYY-MM-DD>/`.
3. Run `./infra/sync-marketing-to-s3.sh` to back up to S3.
4. When ready to submit: curate the chosen set into the sibling `final/`
   directory with `NN-slug.ext` names, re-run the sync, then upload `final/`
   files to App Store Connect / Play Console.
5. On a new workstation, run `./infra/hydrate-marketing.sh` to pull everything
   back down.

## Notes for the iPhone agent

To add iPhone assets, mirror this exact layout under
`marketing/ios/iphone-6.9/<app-version>/`. No changes to scripts or bucket
needed — just create the directories and sync. If you also capture a 6.5"
fallback set, use `marketing/ios/iphone-6.5/<app-version>/`.
