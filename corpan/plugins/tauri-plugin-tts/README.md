# Tauri Plugin tts

Text to speech plugin for Tauri apps.

Supported platforms:

- Android API 21+ (Using [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech))
- iOS 13+, 16+ recommended for the highest quality voices (Using [AVSpeechSynthesizer](https://developer.apple.com/documentation/avfaudio/avspeechsynthesizer/))

## Install

Add to your Cargo.toml:

```toml
tauri-plugin-tts = { git = "https://github.com/httpjamesm/tauri-plugin-tts.git" }
```

Connect to your Tauri builder:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .plugin(tauri_plugin_tts::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Permissions

Add `tts:allow-speak` to your capabilities file.

## Android Instructions

Make sure to add the following to your AndroidManifest.xml:

```xml
<queries>
  <intent>
    <action android:name="android.intent.action.TTS_SERVICE" />
  </intent>
</queries>
```

## iOS Instructions

The user must have at least one "Enhanced" or "Premium" voice installed. Premium is recommended on iOS 16+ as they are the most natural sounding voices. By default, they may not be installed, so you might want to prompt the user to install one.

If the device is on mute, the speech will not be audible.

## Usage

```typescript
import { invoke } from "@tauri-apps/api/core";

invoke("plugin:tts|speak", { text: "Hello, world!" });
```
