//! Wire models for the asr-native plugin.
//!
//! Per the contract discipline (`corpan/docs/STT_MASTERPLAN.md` §2.2), we do
//! NOT redeclare the shared structs — we RE-EXPORT them from
//! `corpan-asr-contract` so there is exactly one definition and serde can't
//! drift between providers. Anything native-specific (the OS-locale mapping)
//! lives here.

pub use corpan_asr_contract::{
    commands as contract_commands, AsrCapability, CaptureMode, EnsureArgs, EnsureResult,
    IsAvailableArgs, IsAvailableResult, LatencyClass, LevelEvent, PartialEvent, ProviderId,
    SessionErrorEvent, SessionRef, TranscribeArgs, TranscribeStartResult, TranscriptOut,
};

/// Map one of OUR language codes to the OS locale id the native engine wants
/// (e.g. `zh-Hans` → `zh_CN`, `ko-polite` → `ko_KR`, `pt-BR` → `pt_BR`). The
/// native layer (Swift/Kotlin) does the authoritative probe; this is the
/// best-effort hint the Rust side passes down. `None` = we don't expect the OS
/// to cover this code (router will skip native and fall through).
pub fn os_locale(our_code: &str) -> Option<&'static str> {
    Some(match our_code {
        "en" => "en_US",
        "es" => "es_ES",
        "fr" => "fr_FR",
        "de" => "de_DE",
        "it" => "it_IT",
        "pt-BR" => "pt_BR",
        "pt-PT" => "pt_BR", // Apple ships only pt_BR
        "nl" => "nl_NL",
        "ru" => "ru_RU",
        "sv" => "sv_SE",
        "da" => "da_DK",
        "no" => "nb_NO",
        "fi" => "fi_FI",
        "tr" => "tr_TR",
        "he" => "he_IL",
        "ar" => "ar_SA",
        "ja" => "ja_JP",
        "ko-polite" => "ko_KR",
        "zh-Hans" => "zh_CN",
        "zh-Hant" => "zh_TW",
        "yue-Hant-HK" => "yue_CN",
        "th" => "th_TH",
        "vi" => "vi_VN",
        "ms" => "ms_MY",
        // Languages Apple/Android on-device STT typically lack → None: the
        // router routes these to a downloadable provider or the keyboard.
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_script_variants_to_os_locales() {
        assert_eq!(os_locale("zh-Hans"), Some("zh_CN"));
        assert_eq!(os_locale("ko-polite"), Some("ko_KR"));
        assert_eq!(os_locale("yue-Hant-HK"), Some("yue_CN"));
        // A language native STT doesn't cover → None (router falls through).
        assert_eq!(os_locale("pa-Arab"), None);
        assert_eq!(os_locale("te"), None);
    }

    #[test]
    fn contract_command_names_are_reused() {
        // We point at the FROZEN contract names, never local string literals.
        assert_eq!(contract_commands::START_SESSION, "start_session");
        assert_eq!(contract_commands::CAPABILITIES, "capabilities");
    }
}
