#![allow(unexpected_cfgs)] // quiet objc macro warnings in this file

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::VoiceInfo;

// Initialize desktop TTS handle
pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Tts<R>> {
    Ok(Tts(app.clone()))
}

/// Access to the tts APIs (desktop)
pub struct Tts<R: Runtime>(AppHandle<R>);

impl<R: Runtime> Tts<R> {
    pub fn speak(
        &self,
        text: String,
        language: Option<String>,
        rate: Option<f32>,
        voice_id: Option<String>,
    ) -> crate::Result<()> {
        #[cfg(target_os = "macos")]
        {
            macos_speak(&text, language.as_deref(), rate, voice_id.as_deref())?;
            return Ok(());
        }
        #[cfg(not(target_os = "macos"))]
        {
            // On non-mac desktop, fall back to legacy (no-op)
            self.speak(text, language, rate)
        }
    }

    pub fn stop(&self) -> crate::Result<()> {
        #[cfg(target_os = "macos")]
        {
            macos_stop()?;
        }
        Ok(())
    }

    /// Open system UI closest to TTS voice management.
    pub fn open_tts_settings(&self) -> crate::Result<()> {
        #[cfg(target_os = "macos")]
        {
            // Prefer Spoken Content panel (macOS Ventura+)
            let primary =
                "x-apple.systempreferences:com.apple.preference.universalaccess?SpokenContent";
            let fallback = "x-apple.systempreferences:com.apple.preference.universalaccess";

            if open_url_with_open_cmd(primary).is_err() {
                let _ = open_url_with_open_cmd(fallback);
            }
        }
        Ok(())
    }

    /// Programmatic install is not supported on desktop
    pub fn install_tts_data_if_supported(&self) -> crate::Result<bool> {
        Ok(false)
    }

    /// Enumerate installed voices with simple, cross-platform metadata
    pub fn list_voices(&self) -> crate::Result<Vec<VoiceInfo>> {
        #[cfg(target_os = "macos")]
        {
            return Ok(macos_list_voices());
        }
        #[cfg(not(target_os = "macos"))]
        {
            Ok(Vec::new())
        }
    }
}

#[cfg(target_os = "macos")]
fn open_url_with_open_cmd(url: &str) -> std::io::Result<()> {
    use std::process::Command;
    Command::new("open").arg(url).status().map(|_| ())
}

// ------------------------- macOS implementation (AVFoundation) -------------------------
#[cfg(target_os = "macos")]
mod macos_impl {
    use super::VoiceInfo;
    use cocoa::base::id;
    use cocoa::foundation::NSString; // brings init_str trait into scope
    use objc::{class, msg_send, sel, sel_impl};
    use std::ffi::CStr;
    use std::sync::{Mutex, Once};

    // tiny helper for NSString literals
    #[macro_export]
    macro_rules! ns_string {
        ($s:expr) => {{
            cocoa::foundation::NSString::alloc(cocoa::base::nil).init_str($s)
        }};
    }

    // Static synthesizer instance for performance (reuse instead of creating new one per call)
    static SYNTH_INIT: Once = Once::new();
    static mut SYNTH_INSTANCE: Option<Mutex<id>> = None;

    /// Get or create the shared synthesizer instance
    unsafe fn get_synthesizer() -> &'static Mutex<id> {
        SYNTH_INIT.call_once(|| {
            let synth: id = msg_send![class!(AVSpeechSynthesizer), new];
            SYNTH_INSTANCE = Some(Mutex::new(synth));
        });
        SYNTH_INSTANCE.as_ref().unwrap()
    }

    #[inline]
    unsafe fn nsstring_to_rust(ns: id) -> String {
        let c: *const std::os::raw::c_char = msg_send![ns, UTF8String];
        if c.is_null() {
            String::new()
        } else {
            CStr::from_ptr(c).to_string_lossy().into_owned()
        }
    }

    #[inline]
    fn normalize_tag(tag: &str) -> String {
        tag.to_lowercase().replace('_', "-")
    }
    #[inline]
    fn base_lang(tag: &str) -> String {
        let t = normalize_tag(tag);
        t.split_once('-').map(|(b, _)| b.to_string()).unwrap_or(t)
    }

    #[inline]
    fn clamp(v: f32, lo: f32, hi: f32) -> f32 {
        if v < lo {
            lo
        } else if v > hi {
            hi
        } else {
            v
        }
    }

    /// Map web-style 0.1..1.5 to AVFoundation 0.0..1.0 (keep 1.0 ≈ 0.5)
    #[inline]
    fn map_web_rate_to_av(web_rate: f32) -> f32 {
        const W_MIN: f32 = 0.10;
        const W_DEF: f32 = 1.00;
        const W_MAX: f32 = 1.50;

        const AV_MIN: f32 = 0.00;
        const AV_DEF: f32 = 0.50;
        const AV_MAX: f32 = 0.70;

        const PAD: f32 = 0.01;

        let w = clamp(web_rate, W_MIN, W_MAX);
        if (w - W_DEF).abs() < f32::EPSILON {
            return AV_DEF;
        }
        if w < W_DEF {
            let t = (w - W_MIN) / (W_DEF - W_MIN);
            (AV_MIN + PAD) + t * (AV_DEF - (AV_MIN + PAD))
        } else {
            let t = (w - W_DEF) / (W_MAX - W_DEF);
            AV_DEF + t * ((AV_MAX - PAD) - AV_DEF)
        }
    }

    fn quality_bucket(name: &str, ident: &str, av_quality: i64) -> Option<String> {
        let n = name.to_lowercase();
        let i = ident.to_lowercase();

        // Premium-ish tokens often present in Siri/Studio bundles on Apple platforms
        let premium_tokens = ["premium", "natural", "neural", "studio", "hq", "pro"];
        let enhanced_tokens = ["enhanced", "improved", "hd"];

        if premium_tokens
            .iter()
            .any(|t| n.contains(t) || i.contains(t))
        {
            return Some("very_high".to_string());
        }
        // AVFoundation exposes `.quality`: 1 = default, 2 = enhanced
        if av_quality >= 2
            || enhanced_tokens
                .iter()
                .any(|t| n.contains(t) || i.contains(t))
        {
            return Some("enhanced".to_string());
        }
        Some("normal".to_string())
    }

    fn is_blocked_vendor(ident: &str) -> bool {
        // Filter anything from the old AppKit catalog, Eloquence, or TTS bundles
        ident.starts_with("com.apple.speech.")
            || ident.starts_with("com.apple.eloquence.")
            || ident.starts_with("com.apple.ttsbundle.")
    }

    fn is_novelty(name: &str, ident: &str) -> bool {
        let blob = format!("{} {}", name.to_lowercase(), ident.to_lowercase());
        let novelty = [
            "trinoids",
            "bubbles",
            "bad",
            "zarvox",
            "boing",
            "hysterical",
            "pipe",
            "agnes",
            "albert",
            "fred",
            "junior",
            "kathy",
            "princess",
            "bahh",
            "cellos",
            "deranged",
            "bells",
            "whisper",
        ];
        novelty.iter().any(|t| blob.contains(t))
    }

    pub(super) fn macos_list_voices() -> Vec<VoiceInfo> {
        unsafe {
            let voices: id = msg_send![class!(AVSpeechSynthesisVoice), speechVoices];
            let count: usize = msg_send![voices, count];

            println!("[NATIVE_TTS:DEBUG] macOS found {} total voices from AVSpeechSynthesisVoice", count);

            // Collect all voices (no deduplication by quality)
            let mut out: Vec<VoiceInfo> = Vec::new();

            for idx in 0..count {
                let v: id = msg_send![voices, objectAtIndex: idx];

                let name_ns: id = msg_send![v, name];
                let id_ns: id = msg_send![v, identifier];
                let lang_ns: id = msg_send![v, language];
                let av_q: i64 = msg_send![v, quality];

                let name = nsstring_to_rust(name_ns);
                let ident = nsstring_to_rust(id_ns);
                let lang = nsstring_to_rust(lang_ns);

                println!("[NATIVE_TTS:DEBUG]   Voice {}: name='{}', id='{}', lang='{}', quality={}",
                    idx, name, ident, lang, av_q);

                // Filter legacy/Eloquence/novelty
                if is_blocked_vendor(&ident) {
                    println!("[NATIVE_TTS:DEBUG]     ↳ FILTERED (blocked vendor)");
                    continue;
                }
                if is_novelty(&name, &ident) {
                    println!("[NATIVE_TTS:DEBUG]     ↳ FILTERED (novelty)");
                    continue;
                }

                // Optional gender (macOS 10.15+)
                let gender_opt = {
                    #[cfg(any(target_os = "macos", target_os = "ios"))]
                    {
                        let g: i64 = msg_send![v, gender];
                        match g {
                            1 => Some("male".to_string()),
                            2 => Some("female".to_string()),
                            _ => Some("unspecified".to_string()),
                        }
                    }
                    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
                    {
                        None
                    }
                };

                let vi = VoiceInfo {
                    id: ident.clone(),
                    name: Some(name.clone()),
                    language: lang.clone(),
                    engine: Some("Apple TTS".to_string()),
                    gender: gender_opt,
                    quality: quality_bucket(&name, &ident, av_q),
                };

                out.push(vi);
            }
            // Stable UX ordering: language, then quality (high to low), then name
            out.sort_by(|a, b| {
                let lang_cmp = a.language.to_lowercase().cmp(&b.language.to_lowercase());
                if lang_cmp != std::cmp::Ordering::Equal {
                    return lang_cmp;
                }

                // Sort by quality descending (higher quality first)
                let quality_level = |q: &Option<String>| -> i32 {
                    match q.as_deref() {
                        Some("very_high") => 5,
                        Some("enhanced") => 4,
                        Some("normal") => 3,
                        Some("default") => 2,
                        Some("low") => 1,
                        _ => 0,
                    }
                };
                let qa = quality_level(&a.quality);
                let qb = quality_level(&b.quality);
                let quality_cmp = qb.cmp(&qa); // descending
                if quality_cmp != std::cmp::Ordering::Equal {
                    return quality_cmp;
                }

                // Finally by name
                let an = a.name.clone().unwrap_or_default().to_lowercase();
                let bn = b.name.clone().unwrap_or_default().to_lowercase();
                an.cmp(&bn)
            });

            println!("[NATIVE_TTS:DEBUG] After filtering (no quality deduplication): {} voices", out.len());
            println!("[NATIVE_TTS:DEBUG] Languages present: {:?}",
                out.iter()
                    .map(|v| v.language.as_str())
                    .collect::<std::collections::HashSet<_>>()
            );

            out
        }
    }

    fn normalize_want(want: &str) -> (String, String) {
        let want_lc = normalize_tag(want);
        let base = base_lang(&want_lc);
        (want_lc, base)
    }

    /// Choose best matching AVFoundation voice for an optional language.
    unsafe fn best_avfoundation_voice(lang: Option<&str>) -> Option<id> {
        let (want_norm, base_lang) = match lang {
            Some(w) if !w.is_empty() => normalize_want(w),
            _ => ("".to_string(), "".to_string()),
        };

        let voices: id = msg_send![class!(AVSpeechSynthesisVoice), speechVoices];
        let count: usize = msg_send![voices, count];
        if count == 0 {
            return None;
        }

        let mut best: Option<(i32, i32, String, id)> = None;
        for i in 0..count {
            let v: id = msg_send![voices, objectAtIndex: i];

            let lang_ns: id = msg_send![v, language];
            let lang = nsstring_to_rust(lang_ns);
            let q: i64 = msg_send![v, quality];

            let name_ns: id = msg_send![v, name];
            let name = nsstring_to_rust(name_ns);

            let lang_lc = normalize_tag(&lang);
            let lang_score = if want_norm.is_empty() {
                1 // no preference → treat all equal on lang
            } else if lang_lc == want_norm {
                3
            } else if lang_lc == base_lang || lang_lc.starts_with(&(base_lang.clone() + "-")) {
                2
            } else {
                0
            };

            // Sort key: (lang_score desc, quality desc, name asc)
            let key = (lang_score as i32, q as i32, name.clone(), v);
            best = match best {
                None => Some((key.0, key.1, key.2, key.3)),
                Some((bls, bq, bname, bv)) => {
                    if (key.0, key.1, &key.2) > (bls, bq, &bname) {
                        Some((key.0, key.1, key.2, key.3))
                    } else {
                        Some((bls, bq, bname, bv))
                    }
                }
            };
        }
        best.map(|t| t.3)
    }

    pub(super) fn macos_speak(
        text: &str,
        language: Option<&str>,
        rate: Option<f32>,
        voice_id: Option<&str>,
    ) -> crate::Result<()> {
        unsafe {
            let utter: id = msg_send![
                class!(AVSpeechUtterance),
                speechUtteranceWithString: crate::ns_string!(text)
            ];

            if let Some(r) = rate {
                let mapped = map_web_rate_to_av(r);
                let _: () = msg_send![utter, setRate: mapped];
            }

            // 1) If explicit voice id is provided, try to use it
            if let Some(req) = voice_id {
                let v: id = msg_send![
                    class!(AVSpeechSynthesisVoice),
                    voiceWithIdentifier: crate::ns_string!(req)
                ];
                if !v.is_null() {
                    let _: () = msg_send![utter, setVoice: v];
                }
            }

            // 2) Else choose best voice for the language
            if voice_id.is_none() {
                if let Some(vc) = best_avfoundation_voice(language) {
                    let _: () = msg_send![utter, setVoice: vc];
                } else if let Some(lang) = language {
                    let v: id = msg_send![
                        class!(AVSpeechSynthesisVoice),
                        voiceWithLanguage: crate::ns_string!(lang)
                    ];
                    if !v.is_null() {
                        let _: () = msg_send![utter, setVoice: v];
                    }
                }
            }

            // Use the static synthesizer instance (performance optimization)
            let synth_mutex = get_synthesizer();
            let synth = *synth_mutex.lock().unwrap();
            let _: () = msg_send![synth, speakUtterance: utter];
        }
        Ok(())
    }

    /// Stop the current speech synthesis
    pub(super) fn macos_stop() -> crate::Result<()> {
        unsafe {
            let synth_mutex = get_synthesizer();
            let synth = *synth_mutex.lock().unwrap();
            let _: () = msg_send![synth, stopSpeakingAtBoundary: 0]; // 0 = immediate
        }
        Ok(())
    }
}

#[cfg(target_os = "macos")]
use macos_impl::{macos_list_voices, macos_speak, macos_stop};
