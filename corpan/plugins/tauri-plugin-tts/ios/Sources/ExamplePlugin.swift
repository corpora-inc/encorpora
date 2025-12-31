import AVFoundation
import Foundation
import Tauri
import os.log

#if canImport(AppKit)
    import AppKit
#endif

#if canImport(UIKit)
    import UIKit
#endif

// -----------------------------------------------------------------------------
// Logging
// -----------------------------------------------------------------------------
private let TTS_SUBSYSTEM = "com.corpora.corpan"
private let TTS_CATEGORY = "TTS"
private let ttsLogObj = OSLog(subsystem: TTS_SUBSYSTEM, category: TTS_CATEGORY)
@inline(__always) private func ttsLog(_ items: Any...) {
    os_log("%{public}@", log: ttsLogObj, type: .info, items.map { "\($0)" }.joined(separator: " "))
}

// -----------------------------------------------------------------------------
// Rate mapping (WEB ~0.1..1.5 → AVSpeech 0.03..0.73 with a slight skew)
// -----------------------------------------------------------------------------
private let IOS_RATE_MIN: Double = 0.03
private let IOS_RATE_MAX: Double = 0.73
private let IOS_RATE_SKEW: Double = -0.03

private func mapWebRateToAVRate(_ web: Double) -> Float {
    let clamped = max(0.1, min(1.5, web))
    var mapped = IOS_RATE_MIN + (clamped / 1.5) * (IOS_RATE_MAX - IOS_RATE_MIN)
    mapped = max(IOS_RATE_MIN, min(IOS_RATE_MAX, mapped + IOS_RATE_SKEW))
    return Float(mapped)
}

// -----------------------------------------------------------------------------
// Args (Decodable). Accept "voice_id" (snake) or "voiceId" (camel).
// -----------------------------------------------------------------------------
final class SpeakArgs: Decodable {
    let text: String
    let language: String?
    let voiceId: String?
    let rate: Double?
    let pitch: Double?
    let volume: Double?

    private enum CodingKeys: String, CodingKey {
        case text, language, rate, pitch, volume
        case voiceId  // <-- expect "voiceId"
    }
}

// -----------------------------------------------------------------------------
// Speaker (voice picking, audio session, speak/stop)
// -----------------------------------------------------------------------------
final class Speaker: NSObject, AVSpeechSynthesizerDelegate {
    private static let synth = AVSpeechSynthesizer()
    private static let cacheQueue = DispatchQueue(label: "com.corpora.tts.voiceCache")
    private static let cacheTTLSeconds: TimeInterval = 10.0

    private struct VoiceCache {
        let updatedAt: Date
        let listable: [AVSpeechSynthesisVoice]
        let usable: [AVSpeechSynthesisVoice]
        let usableById: [String: AVSpeechSynthesisVoice]
        let listPayload: [[String: Any?]]
    }

    private static var cachedVoices: VoiceCache?

    // Known “novelty/legacy” markers to avoid for production TTS
    private static let NOVELTY_TOKENS: [String] = [
        "trinoids", "bubbles", "bad", "zarvox", "boing", "hysterical", "pipe",
        "agnes", "albert", "fred", "junior", "kathy", "princess", "bahh", "cellos",
        "deranged", "bells", "whisper",
    ]
    private static let LEGACY_PREFIX = "com.apple.speech.synthesis.voice."  // old AppKit catalog
    private static let ELOQUENCE_PREFIX = "com.apple.eloquence."  // Eloquence catalog
    private static let VOICE_PREFIX = "com.apple.voice."

    // Quality tokens (best → worst): Premium(3) > Enhanced(2) > Default(1)
    // Siri is not a separate AV quality enum; we still allow it.
    private static let PREMIUM_TOKENS = ["premium", "neural", "natural", "studio", "hq", "pro"]
    private static let ENHANCED_TOKENS = ["enhanced", "improved", "hd"]

    override init() {
        super.init()
        Self.synth.delegate = self
        let all = AVSpeechSynthesisVoice.speechVoices()
        ttsLog("TTS init | voices:", all.count)
        // ttsLog("TTS catalog |", Self.voicesSummaryLine(all))
    }

    // Helpers
    private func normalizeTag(_ tag: String) -> String {
        tag.lowercased().replacingOccurrences(of: "_", with: "-")
    }
    private func baseLang(_ tag: String) -> String {
        tag.split(separator: "-").first.map(String.init) ?? tag
    }

    private func isLegacy(_ v: AVSpeechSynthesisVoice) -> Bool {
        v.identifier.hasPrefix(Self.LEGACY_PREFIX)
    }
    private func isEloquence(_ v: AVSpeechSynthesisVoice) -> Bool {
        v.identifier.hasPrefix(Self.ELOQUENCE_PREFIX)
    }
    private func isNovelty(_ v: AVSpeechSynthesisVoice) -> Bool {
        let blob = (v.identifier + " " + v.name).lowercased()
        return Self.NOVELTY_TOKENS.contains { blob.contains($0) }
    }
    private func isModern(_ v: AVSpeechSynthesisVoice) -> Bool {
        !(isLegacy(v) || isEloquence(v))
    }

    private func qualityString(_ v: AVSpeechSynthesisVoice) -> String {
        if #available(iOS 16.0, macOS 13.0, *) {
            switch v.quality {
            case .premium: return "premium"
            case .enhanced: return "enhanced"
            default: return "default"
            }
        } else {
            // Older OSes don't have `.premium`
            return (v.quality == .enhanced) ? "enhanced" : "default"
        }
    }

    // Rank for internal comparisons (premium 3 > enhanced 2 > default 1)
    private func qualityTier(_ v: AVSpeechSynthesisVoice) -> Int {
        if #available(iOS 16.0, macOS 13.0, *) {
            switch v.quality {
            case .premium: return 3
            case .enhanced: return 2
            default: return 1
            }
        } else {
            return v.quality == .enhanced ? 2 : 1
        }
    }

    private func langMatchScore(voiceTag: String, wantTag: String) -> Int {
        let v = voiceTag.lowercased()
        let w = wantTag.lowercased()
        if v == w { return 3 }
        let base = baseLang(w)
        if v == base || v.hasPrefix(base + "-") { return 2 }
        return 0
    }

    private func allUsableVoices() -> [AVSpeechSynthesisVoice] {
        return getVoiceCache().usable
    }

    private func buildUsableVoices(from all: [AVSpeechSynthesisVoice]) -> [AVSpeechSynthesisVoice] {
        var keep: [AVSpeechSynthesisVoice] = []
        var droppedLegacy = 0
        var droppedEloq = 0
        var droppedNovelty = 0
        for v in all {
            if isLegacy(v) {
                droppedLegacy += 1
                continue
            }
            if isEloquence(v) {
                droppedEloq += 1
                continue
            }
            if isNovelty(v) {
                droppedNovelty += 1
                continue
            }
            keep.append(v)
        }
        // ttsLog(
        //     "TTS filter | kept:", keep.count,
        //     "| legacy:", droppedLegacy, "| eloquence:", droppedEloq, "| novelty:", droppedNovelty)
        return keep
    }

    // Only expose modern Apple Voices in the list (no eloquence / legacy / novelty).
    private func buildListableVoices(from all: [AVSpeechSynthesisVoice]) -> [AVSpeechSynthesisVoice] {
        let list = all.filter { $0.identifier.hasPrefix(Self.VOICE_PREFIX) }
        // ttsLog("TTS list filter | total:", all.count, "| com.apple.voice:*:", list.count)
        if list.isEmpty {
            ttsLog(
                "TTS list filter | WARNING: no com.apple.voice.* voices present on this device/sim."
            )
        }
        return list
    }

    private func buildListPayload(from listable: [AVSpeechSynthesisVoice]) -> [[String: Any?]] {
        // 1) Start from modern Apple voices only
        let all = listable

        // 2) Build a stable “base key” to collapse compact/enhanced/premium variants
        //    Use (language + last identifier token) so:
        //    com.apple.voice.compact.es-ES.Monica / ...enhanced.es-ES.Monica → same key.
        func baseKey(_ v: AVSpeechSynthesisVoice) -> String {
            let lastToken = v.identifier.split(separator: ".").last.map(String.init) ?? v.name
            return "\(v.language.lowercased())|\(lastToken.lowercased())"
        }

        // 3) Pick the best quality per base key
        var best: [String: AVSpeechSynthesisVoice] = [:]
        for v in all {
            let k = baseKey(v)
            if let cur = best[k] {
                let rNew = qualityTier(v)  // premium 3 > enhanced 2 > default 1
                let rCur = qualityTier(cur)
                if rNew > rCur
                    || (rNew == rCur && v.quality.rawValue > cur.quality.rawValue)
                    || (rNew == rCur && v.quality.rawValue == cur.quality.rawValue
                        && v.name.localizedCaseInsensitiveCompare(cur.name) == .orderedAscending)
                {
                    best[k] = v
                }
            } else {
                best[k] = v
            }
        }

        // 4) Deterministic order (lang, then name)
        let list = best.values.sorted {
            if $0.language != $1.language {
                return $0.language.localizedCaseInsensitiveCompare($1.language) == .orderedAscending
            }
            if $0.name != $1.name {
                return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
            return $0.identifier < $1.identifier
        }

        // 5) Shape payload
        return list.map { v in
            let genderStr: String? = {
                if #available(iOS 13.0, macOS 10.15, *) {
                    switch v.gender {
                    case .male: return "male"
                    case .female: return "female"
                    case .unspecified: return "unspecified"
                    @unknown default: return "unspecified"
                    }
                } else {
                    return nil
                }
            }()

            return [
                "id": v.identifier,
                "name": v.name,
                "language": v.language,
                "gender": genderStr as Any?,
                "quality": qualityString(v),  // "premium" | "enhanced" | "default"
                "engine": nil,
            ]
        }
    }

    private func getVoiceCache(force: Bool = false) -> VoiceCache {
        return Self.cacheQueue.sync {
            let now = Date()
            if !force, let cached = Self.cachedVoices,
                now.timeIntervalSince(cached.updatedAt) < Self.cacheTTLSeconds
            {
                return cached
            }

            let all = AVSpeechSynthesisVoice.speechVoices()
            let listable = buildListableVoices(from: all)
            let usable = buildUsableVoices(from: all)
            let byId = Dictionary(uniqueKeysWithValues: usable.map { ($0.identifier, $0) })
            let payload = buildListPayload(from: listable)

            let fresh = VoiceCache(
                updatedAt: now,
                listable: listable,
                usable: usable,
                usableById: byId,
                listPayload: payload
            )
            Self.cachedVoices = fresh
            return fresh
        }
    }

    private func pickBest(in pool: [AVSpeechSynthesisVoice], want: String)
        -> AVSpeechSynthesisVoice?
    {
        guard !pool.isEmpty else { return nil }
        return pool.max { a, b in
            let la = langMatchScore(voiceTag: a.language, wantTag: want)
            let lb = langMatchScore(voiceTag: b.language, wantTag: want)
            if la != lb { return la < lb }
            let qa = qualityTier(a)
            let qb = qualityTier(b)
            if qa != qb { return qa < qb }
            if a.quality.rawValue != b.quality.rawValue {
                return a.quality.rawValue < b.quality.rawValue
            }
            return a.name > b.name
        }
    }

    private func pickVoice(language wantRaw: String?) -> AVSpeechSynthesisVoice? {
        let usable = allUsableVoices()
        guard !usable.isEmpty else { return nil }

        guard let wantRaw, !wantRaw.isEmpty else {
            return pickBest(in: usable, want: "en-US")  // neutral-ish default
        }

        let want = normalizeTag(wantRaw)
        let base = baseLang(want)

        let exactPool = usable.filter { $0.language.lowercased() == want }
        if let bestExact = pickBest(in: exactPool, want: want) { return bestExact }

        let basePool = usable.filter {
            let l = $0.language.lowercased()
            return l == base || l.hasPrefix(base + "-")
        }
        if let bestBase = pickBest(in: basePool, want: want) { return bestBase }

        ttsLog(
            "TTS select | no usable \(want) or base \(base); leave voice unset (system default).")
        return nil
    }

    // One-line summary of all voices (for diagnostics)
    static func voicesSummaryLine(_ list: [AVSpeechSynthesisVoice]) -> String {
        list.map { v in "\(v.name)@\(v.language)[q=\(v.quality.rawValue)]{\(v.identifier)}" }
            .joined(separator: " | ")
    }

    private func prepareAudioSessionIfNeeded() {
        #if canImport(UIKit)
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
                try session.setActive(true, options: [])
                // ttsLog("TTS audio | AVAudioSession ready")
            } catch {
                // ttsLog("TTS audio | setup failed:", error.localizedDescription)
            }
        #endif
    }

    func speak(_ args: SpeakArgs, invoke: Invoke) {
        // Performance optimization: Do voice selection on background queue
        DispatchQueue.global(qos: .userInitiated).async {
            ttsLog(
                "TTS speak | lang:", args.language ?? "nil",
                "| id:", args.voiceId ?? "nil",
                "| rate:", args.rate ?? -1,
                "| pitch:", args.pitch ?? -1,
                "| volume:", args.volume ?? -1
            )

            // Voice selection on background thread (performance optimization)
            var selectedVoice: AVSpeechSynthesisVoice?

            // Prefer explicit voice by identifier
            if let id = args.voiceId, let v = self.getVoiceCache().usableById[id] {
                selectedVoice = v
                ttsLog("TTS voice | using id:", v.name, v.language, v.identifier)
            }

            // Otherwise pick by language ranking
            if selectedVoice == nil, let best = self.pickVoice(language: args.language) {
                selectedVoice = best
                ttsLog(
                    "TTS voice | picked:", best.name, best.language,
                    "tier:", self.qualityTier(best), "avQ:", best.quality.rawValue)
            }

            // Only dispatch to main thread for actual synthesis (required by AVFoundation)
            DispatchQueue.main.async {
                self.prepareAudioSessionIfNeeded()

                // If you want strict single-utterance behavior, uncomment:
                // if Self.synth.isSpeaking {
                //     Self.synth.stopSpeaking(at: .immediate)
                //     ttsLog("TTS synth | stopped previous utterance")
                // }

                let utter = AVSpeechUtterance(string: args.text)
                utter.voice = selectedVoice

                // Prosody
                utter.rate =
                    (args.rate != nil)
                    ? mapWebRateToAVRate(args.rate!) : AVSpeechUtteranceDefaultSpeechRate
                if let p = args.pitch { utter.pitchMultiplier = Float(p) }
                if let v = args.volume { utter.volume = Float(v) }
                // ttsLog(
                //     "TTS prosody | rate:", utter.rate, "pitch:", utter.pitchMultiplier, "volume:",
                //     utter.volume)

                Self.synth.speak(utter)
                // ttsLog("TTS synth | queued")
                invoke.resolve()
            }
        }
    }

    func stop(_ invoke: Invoke) {
        DispatchQueue.main.async {
            Self.synth.stopSpeaking(at: .immediate)
            // ttsLog("TTS stop | requested")
            invoke.resolve()
        }
    }

    func isSpeaking(_ invoke: Invoke) {
        invoke.resolve(Self.synth.isSpeaking)
    }

    // Replace your existing listVoices(...) with this version (dedup premium>enhanced>compact)
    func listVoices(_ invoke: Invoke) {
        DispatchQueue.global(qos: .userInitiated).async {
            let payload = self.getVoiceCache().listPayload
            DispatchQueue.main.async {
                invoke.resolve(["voices": payload])  // Tauri iOS expects an object wrapper
            }
        }
    }

}

// -----------------------------------------------------------------------------
// Tauri Plugin surface (names must match run_mobile_plugin calls from Rust)
// -----------------------------------------------------------------------------
final class TTSPlugin: Plugin {
    private static let speaker = Speaker()

    @objc public func speak(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SpeakArgs.self)
        Self.speaker.speak(args, invoke: invoke)
    }

    @objc public func stop(_ invoke: Invoke) {
        Self.speaker.stop(invoke)
    }

    // Not currently used by Rust, but handy for debugging.
    @objc public func isSpeaking(_ invoke: Invoke) {
        Self.speaker.isSpeaking(invoke)
    }

    // listVoices → returns { voices: [...] }
    @objc public func listVoices(_ invoke: Invoke) {
        Self.speaker.listVoices(invoke)
    }

    // ---- iOS app on macOS: open macOS System Settings via ObjC runtime (no AppKit) ----
    @inline(__always)
    private func openMacSystemSettingsForTTS_viaRuntime() -> Bool {
        guard #available(iOS 14.0, *), ProcessInfo.processInfo.isiOSAppOnMac else { return false }

        let targets = [
            "x-apple.systempreferences:com.apple.preference.universalaccess?SpokenContent",
            "x-apple.systempreferences:com.apple.preference.universalaccess?Hearing_SpokenContent",
            "x-apple.systempreferences:com.apple.preference.universalaccess?Hearing",
            "x-apple.systempreferences:com.apple.preference.universalaccess",
            "x-apple.systempreferences:com.apple.preference.speech?TTS",
            "x-apple.systempreferences:com.apple.preference.speech",
        ]

        guard let wsClass: AnyObject = NSClassFromString("NSWorkspace"),
            let shared = (wsClass as AnyObject)
                .perform(NSSelectorFromString("sharedWorkspace"))?
                .takeUnretainedValue()
        else { return false }

        let openSel = NSSelectorFromString("openURL:")
        for s in targets {
            if let u = URL(string: s) {
                _ = (shared as AnyObject).perform(openSel, with: u as NSURL)
                return true
            }
        }
        return false
    }

    // ---- Device Settings deep links (Accessibility ▸ Spoken Content ▸ Voices; older Speech paths) ----
    @inline(__always)
    private func iosTTSSettingsURLs() -> [URL] {
        let schemesNew = [
            // iOS 15+ Spoken Content
            "App-Prefs:root=ACCESSIBILITY&path=SPOKEN_CONTENT/VOICES",
            "App-Prefs:root=ACCESSIBILITY&path=SPOKEN_CONTENT",
            // Some devices still resolve via General/Accessibility/Speech
            "App-Prefs:root=General&path=ACCESSIBILITY/SPEECH/VOICES",
            "App-Prefs:root=General&path=ACCESSIBILITY/SPEECH",
            "App-Prefs:root=ACCESSIBILITY",

            // Legacy scheme variants
            "prefs:root=ACCESSIBILITY&path=SPOKEN_CONTENT/VOICES",
            "prefs:root=ACCESSIBILITY&path=SPOKEN_CONTENT",
            "prefs:root=General&path=ACCESSIBILITY/SPEECH/VOICES",
            "prefs:root=General&path=ACCESSIBILITY/SPEECH",
            "prefs:root=ACCESSIBILITY",
        ]

        let schemesOld = [
            // iOS 14 and earlier Speech paths first
            "App-Prefs:root=General&path=ACCESSIBILITY/SPEECH/VOICES",
            "App-Prefs:root=General&path=ACCESSIBILITY/SPEECH",
            "App-Prefs:root=ACCESSIBILITY",

            // Legacy scheme variants
            "prefs:root=General&path=ACCESSIBILITY/SPEECH/VOICES",
            "prefs:root=General&path=ACCESSIBILITY/SPEECH",
            "prefs:root=ACCESSIBILITY",
        ]

        if #available(iOS 15.0, *) {
            return schemesNew.compactMap(URL.init(string:))
        } else {
            return schemesOld.compactMap(URL.init(string:))
        }
    }

    // ---- Public entry point: try macOS → device Settings deeplinks → app Settings (last) ----
    @objc public func openTtsSettings(_ invoke: Invoke) {
        #if canImport(UIKit)
            // 1) iOS app running on macOS (not Catalyst): open macOS System Settings
            if openMacSystemSettingsForTTS_viaRuntime() {
                invoke.resolve()
                return
            }

            // 2) iPhone/iPad: try device Settings deep links (Accessibility ▸ Spoken Content ▸ Voices)
            for url in iosTTSSettingsURLs() {
                if UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url, options: [:]) { _ in invoke.resolve() }
                    return
                }
            }

            // 3) Last resort: open the app’s Settings page (at least lands in Settings)
            if let appSettings = URL(string: UIApplication.openSettingsURLString),
                UIApplication.shared.canOpenURL(appSettings)
            {
                UIApplication.shared.open(appSettings, options: [:]) { _ in invoke.resolve() }
                return
            }

            // 4) If absolutely nothing worked, still resolve so the UI doesn’t hang.
            invoke.resolve()
        #else
            invoke.resolve()
        #endif
    }

    // installTtsDataIfSupported: Not supported on iOS → return false.
    @objc public func installTtsDataIfSupported(_ invoke: Invoke) {
        invoke.resolve(false)
    }
}

@_cdecl("init_plugin_tts")
func init_plugin_tts() -> Plugin {
    ttsLog("TTS init_plugin_tts()")
    return TTSPlugin()
}
