#![allow(unexpected_cfgs)]

//! Native streaming radio player.
//!
//! Wraps platform-native media players so the World Radio pack can deliver
//! reliable lock-screen background playback with ICY metadata, the way a
//! pure-WebView `<audio>` element fundamentally cannot:
//!
//! - **Android**: ExoPlayer + Media3 `MediaSessionService`. Plays MP3, AAC LC,
//!   HE-AAC v1/v2 SBR/PS, Vorbis, Opus, FLAC, HLS, DASH, with native ICY
//!   metadata via `IcyHeaders`/`IcyInfo`, audio focus + becoming-noisy handled
//!   by Media3, foreground-service notification + lock-screen card auto-published
//!   by `MediaSessionService` 1.1+.
//! - **iOS**: `AVPlayer` + `AVPlayerItem`. Plays HLS, ICY, MP3, AAC LC, HE-AAC,
//!   FLAC. ICY metadata via KVO on `timedMetadata` (`commonIdentifierTitle`).
//!   `AVAudioSession.playback`. `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter`
//!   drive the lock-screen card and remote commands.
//! - **macOS**: same `AVPlayer` + `MPNowPlayingInfoCenter` story without
//!   `AVAudioSession`.
//! - **Other desktop**: no-op. The pack falls back to its WebView path for
//!   `npm run dev`.
//!
//! See `models.rs` for command shapes; the JS bridge in
//! `corpan/packs/shared/audio/nativeRadio.ts` is the single consumer.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::RadioStream;
#[cfg(mobile)]
use mobile::RadioStream;

/// Extensions to access the radio-stream APIs from a Tauri runtime handle.
pub trait RadioStreamExt<R: Runtime> {
    fn radio_stream(&self) -> &RadioStream<R>;
}

impl<R: Runtime, T: Manager<R>> crate::RadioStreamExt<R> for T {
    fn radio_stream(&self) -> &RadioStream<R> {
        self.state::<RadioStream<R>>().inner()
    }
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_radio_stream);

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("radio-stream")
        .invoke_handler(tauri::generate_handler![
            commands::play,
            commands::pause,
            commands::resume,
            commands::stop,
            commands::set_volume,
            commands::register_listener,
            commands::remove_listener,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let radio = mobile::init(app, api)?;
                app.manage(radio);
            }

            #[cfg(desktop)]
            {
                let radio = desktop::init(app, api)?;
                app.manage(radio);
            }

            Ok(())
        })
        .build()
}
