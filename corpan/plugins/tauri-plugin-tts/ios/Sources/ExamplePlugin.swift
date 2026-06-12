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
        case voice_id // <-- accept "voice_id"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text = try container.decode(String.self, forKey: .text)
        language = try container.decodeIfPresent(String.self, forKey: .language)
        rate = try container.decodeIfPresent(Double.self, forKey: .rate)
        pitch = try container.decodeIfPresent(Double.self, forKey: .pitch)
        volume = try container.decodeIfPresent(Double.self, forKey: .volume)

        let camel = try container.decodeIfPresent(String.self, forKey: .voiceId)
        let snake = try container.decodeIfPresent(String.self, forKey: .voice_id)
        voiceId = camel ?? snake
    }
}

final class SpeakConcurrentArgs: Decodable {
    let text: String
    let language: String?
    let voiceId: String?
    let rate: Double?

    private enum CodingKeys: String, CodingKey {
        case text, language, rate
        case voiceId
        case voice_id
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text = try container.decode(String.self, forKey: .text)
        language = try container.decodeIfPresent(String.self, forKey: .language)
        rate = try container.decodeIfPresent(Double.self, forKey: .rate)

        let camel = try container.decodeIfPresent(String.self, forKey: .voiceId)
        let snake = try container.decodeIfPresent(String.self, forKey: .voice_id)
        voiceId = camel ?? snake
    }
}

/// Args for `synthesizeToBuffer` — render to raw audio (no speaker playback).
/// Same shape as SpeakArgs (text/language/rate/voiceId, snake-or-camel).
final class SynthesizeArgs: Decodable {
    let text: String
    let language: String?
    let voiceId: String?
    let rate: Double?

    private enum CodingKeys: String, CodingKey {
        case text, language, rate
        case voiceId
        case voice_id
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text = try container.decode(String.self, forKey: .text)
        language = try container.decodeIfPresent(String.self, forKey: .language)
        rate = try container.decodeIfPresent(Double.self, forKey: .rate)

        let camel = try container.decodeIfPresent(String.self, forKey: .voiceId)
        let snake = try container.decodeIfPresent(String.self, forKey: .voice_id)
        voiceId = camel ?? snake
    }
}

// -----------------------------------------------------------------------------
// Synthesizer Pool for Concurrent TTS
// -----------------------------------------------------------------------------
private final class SynthesizerSlot: NSObject, AVSpeechSynthesizerDelegate {
    let synth: AVSpeechSynthesizer
    var busy = false
    var currentUtteranceId: String?
    var onFinished: ((String?) -> Void)?

    override init() {
        synth = AVSpeechSynthesizer()
        super.init()
        synth.delegate = self
    }

    func speak(
        text: String, voice: AVSpeechSynthesisVoice?, rate: Float,
        pitch: Float?, volume: Float?, utteranceId: String
    ) {
        busy = true
        currentUtteranceId = utteranceId

        let utter = AVSpeechUtterance(string: text)
        utter.voice = voice
        utter.rate = rate
        if let p = pitch { utter.pitchMultiplier = p }
        if let v = volume { utter.volume = v }

        synth.speak(utter)
    }

    // AVSpeechSynthesizerDelegate
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let uttId = currentUtteranceId
        busy = false
        currentUtteranceId = nil
        onFinished?(uttId)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        let uttId = currentUtteranceId
        busy = false
        currentUtteranceId = nil
        onFinished?(uttId)
    }
}

private struct PendingUtterance {
    let text: String
    let voice: AVSpeechSynthesisVoice?
    let rate: Float
    let pitch: Float?
    let volume: Float?
    let utteranceId: String
}

private final class SynthesizerPool {
    static let shared = SynthesizerPool()
    private static let poolSize = 8

    private var slots: [SynthesizerSlot] = []
    private var pendingQueue: [PendingUtterance] = []
    private var utteranceCounter: UInt64 = 0
    private let queue = DispatchQueue(label: "com.corpora.tts.pool")

    init() {
        for _ in 0..<Self.poolSize {
            let slot = SynthesizerSlot()
            slot.onFinished = { [weak self] _ in
                self?.processQueue()
            }
            slots.append(slot)
        }
    }

    func speakConcurrent(
        text: String, voice: AVSpeechSynthesisVoice?, rate: Float,
        pitch: Float? = nil, volume: Float? = nil
    ) -> String {
        var utteranceId = ""
        queue.sync {
            utteranceCounter += 1
            utteranceId = "utt_\(utteranceCounter)"

            // Find an idle slot
            if let slot = slots.first(where: { !$0.busy }) {
                slot.speak(text: text, voice: voice, rate: rate, pitch: pitch, volume: volume, utteranceId: utteranceId)
            } else {
                // Queue for later
                pendingQueue.append(PendingUtterance(
                    text: text, voice: voice, rate: rate, pitch: pitch, volume: volume, utteranceId: utteranceId
                ))
            }
        }
        return utteranceId
    }

    private func processQueue() {
        queue.async { [weak self] in
            guard let self = self, !self.pendingQueue.isEmpty else { return }

            if let slot = self.slots.first(where: { !$0.busy }) {
                let pending = self.pendingQueue.removeFirst()
                DispatchQueue.main.async {
                    slot.speak(
                        text: pending.text, voice: pending.voice, rate: pending.rate,
                        pitch: pending.pitch, volume: pending.volume, utteranceId: pending.utteranceId
                    )
                }
            }
        }
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

    func speakConcurrent(_ args: SpeakConcurrentArgs, invoke: Invoke) {
        // Performance optimization: Do voice selection on background queue
        DispatchQueue.global(qos: .userInitiated).async {
            ttsLog(
                "TTS speakConcurrent | lang:", args.language ?? "nil",
                "| id:", args.voiceId ?? "nil",
                "| rate:", args.rate ?? -1
            )

            // Voice selection on background thread
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

            let rate: Float = (args.rate != nil)
                ? mapWebRateToAVRate(args.rate!) : AVSpeechUtteranceDefaultSpeechRate

            // Use the synthesizer pool for concurrent playback
            DispatchQueue.main.async {
                self.prepareAudioSessionIfNeeded()

                let utteranceId = SynthesizerPool.shared.speakConcurrent(
                    text: args.text,
                    voice: selectedVoice,
                    rate: rate
                )

                invoke.resolve(["utteranceId": utteranceId])
            }
        }
    }

    /// Render TTS to a RAW 16-bit PCM WAV buffer WITHOUT playing through the
    /// speaker. This is the music-pack capture path: `AVSpeechSynthesizer.write`
    /// renders the utterance to `AVAudioPCMBuffer` chunks and NEVER touches the
    /// audio session for playback ⇒ no `.duckOthers` ⇒ no ducking of the music.
    ///
    /// We accumulate the float samples (downmixed to mono), convert to
    /// little-endian Int16, wrap a 16-bit PCM WAV container, base64-encode, and
    /// resolve with the SynthesizeResult shape Rust/JS expect.
    /// Strong refs to in-flight offline renderers. AVSpeechSynthesizer.write does
    /// NOT retain self, so without holding the synth here it deallocates before
    /// the render callbacks fire and we get an EMPTY buffer (the "boop"). Each
    /// entry is removed in finish() once its render completes.
    private static var renderSynths = [AVSpeechSynthesizer]()
    private static let renderSynthsLock = NSLock()

    func synthesizeToBuffer(_ args: SynthesizeArgs, invoke: Invoke) {
        DispatchQueue.global(qos: .userInitiated).async {
            ttsLog(
                "TTS synthesizeToBuffer | lang:", args.language ?? "nil",
                "| id:", args.voiceId ?? "nil",
                "| rate:", args.rate ?? -1
            )

            // Voice selection — mirror speak(): explicit id first, else best-by-language.
            var selectedVoice: AVSpeechSynthesisVoice?
            if let id = args.voiceId, let v = self.getVoiceCache().usableById[id] {
                selectedVoice = v
            }
            if selectedVoice == nil, let best = self.pickVoice(language: args.language) {
                selectedVoice = best
            }

            let utter = AVSpeechUtterance(string: args.text)
            utter.voice = selectedVoice
            utter.rate =
                (args.rate != nil)
                ? mapWebRateToAVRate(args.rate!) : AVSpeechUtteranceDefaultSpeechRate

            // A dedicated synthesizer for offline rendering — must NOT be the
            // shared playback synth, and we keep a STRONG reference until done
            // (else ARC frees it before the render callbacks run → empty audio).
            let writer = AVSpeechSynthesizer()
            Self.renderSynthsLock.lock()
            Self.renderSynths.append(writer)
            Self.renderSynthsLock.unlock()

            // Accumulators (filled on the synthesizer's callback queue).
            var pcm16 = Data()
            var outSampleRate: Double = 0
            var totalFrames: Int = 0
            var resolved = false

            // Guard so we resolve exactly once (the final buffer has 0 frames).
            let finish: () -> Void = { [weak writer] in
                if resolved { return }
                resolved = true
                // Release the strong ref now that this render is done.
                if let w = writer {
                    Self.renderSynthsLock.lock()
                    Self.renderSynths.removeAll { $0 === w }
                    Self.renderSynthsLock.unlock()
                }

                let sampleRate = outSampleRate > 0 ? UInt32(outSampleRate) : 22050
                let wav = Speaker.makeWavData(
                    pcm16le: pcm16, sampleRate: sampleRate, channels: 1)
                let base64 = wav.base64EncodedString()
                let durationMs =
                    sampleRate > 0 ? UInt32((Double(totalFrames) / Double(sampleRate)) * 1000.0) : 0

                ttsLog(
                    "TTS synthesizeToBuffer done | frames:", totalFrames,
                    "sr:", sampleRate, "bytes:", wav.count)

                DispatchQueue.main.async {
                    invoke.resolve([
                        "pcmBase64": base64,
                        "sampleRate": Int(sampleRate),
                        "channels": 1,
                        "durationMs": Int(durationMs),
                        "codec": "wav",
                        "voiceId": selectedVoice?.identifier ?? args.voiceId ?? "",
                    ])
                }
            }

            // `write` delivers AVAudioBuffer chunks; an empty (0-frame) buffer
            // signals end-of-stream. We convert each chunk to mono Int16.
            writer.write(utter) { (buffer: AVAudioBuffer) in
                guard let pcmBuffer = buffer as? AVAudioPCMBuffer else {
                    // Non-PCM buffer (shouldn't happen for utterances) — ignore.
                    return
                }
                let frames = Int(pcmBuffer.frameLength)
                if frames == 0 {
                    // End-of-stream sentinel.
                    finish()
                    return
                }
                if outSampleRate == 0 {
                    outSampleRate = pcmBuffer.format.sampleRate
                }
                totalFrames += frames
                Speaker.appendMonoInt16(from: pcmBuffer, into: &pcm16)
            }

            // Safety net: if the engine never emits a 0-frame buffer on this OS,
            // resolve after a bounded wait once we have *some* audio. (Most iOS
            // versions DO send the terminating empty buffer.)
            DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 8.0) {
                if !resolved {
                    ttsLog("TTS synthesizeToBuffer | watchdog finalize")
                    finish()
                }
            }
        }
    }

    /// Downmix an AVAudioPCMBuffer (float32 or int16, interleaved or not) to mono
    /// little-endian Int16 and append to `out`.
    static func appendMonoInt16(from buffer: AVAudioPCMBuffer, into out: inout Data) {
        let frames = Int(buffer.frameLength)
        let channels = Int(buffer.format.channelCount)
        if frames == 0 || channels == 0 { return }

        func clampToInt16(_ v: Float) -> Int16 {
            let scaled = v * 32767.0
            if scaled >= 32767.0 { return Int16.max }
            if scaled <= -32768.0 { return Int16.min }
            return Int16(scaled)
        }

        out.reserveCapacity(out.count + frames * 2)

        if let floatData = buffer.floatChannelData {
            // Non-interleaved float32: floatData[ch][frame].
            for f in 0..<frames {
                var acc: Float = 0
                for ch in 0..<channels {
                    acc += floatData[ch][f]
                }
                let mono = acc / Float(channels)
                var s = clampToInt16(mono).littleEndian
                withUnsafeBytes(of: &s) { out.append(contentsOf: $0) }
            }
        } else if let int16Data = buffer.int16ChannelData {
            // Non-interleaved int16: int16Data[ch][frame].
            for f in 0..<frames {
                var acc: Int32 = 0
                for ch in 0..<channels {
                    acc += Int32(int16Data[ch][f])
                }
                var s = Int16(truncatingIfNeeded: acc / Int32(channels)).littleEndian
                withUnsafeBytes(of: &s) { out.append(contentsOf: $0) }
            }
        }
    }

    /// Wrap raw little-endian 16-bit PCM in a canonical 44-byte WAV header.
    static func makeWavData(pcm16le: Data, sampleRate: UInt32, channels: UInt16) -> Data {
        let bitsPerSample: UInt16 = 16
        let byteRate = sampleRate * UInt32(channels) * UInt32(bitsPerSample / 8)
        let blockAlign = channels * (bitsPerSample / 8)
        let dataSize = UInt32(pcm16le.count)
        let chunkSize = 36 + dataSize

        var d = Data()
        func appendLE32(_ v: UInt32) { var x = v.littleEndian; withUnsafeBytes(of: &x) { d.append(contentsOf: $0) } }
        func appendLE16(_ v: UInt16) { var x = v.littleEndian; withUnsafeBytes(of: &x) { d.append(contentsOf: $0) } }

        d.append(contentsOf: Array("RIFF".utf8))
        appendLE32(chunkSize)
        d.append(contentsOf: Array("WAVE".utf8))
        d.append(contentsOf: Array("fmt ".utf8))
        appendLE32(16)            // Subchunk1Size for PCM
        appendLE16(1)             // AudioFormat = PCM
        appendLE16(channels)
        appendLE32(sampleRate)
        appendLE32(byteRate)
        appendLE16(blockAlign)
        appendLE16(bitsPerSample)
        d.append(contentsOf: Array("data".utf8))
        appendLE32(dataSize)
        d.append(pcm16le)
        return d
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

    @objc public func speakConcurrent(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SpeakConcurrentArgs.self)
        Self.speaker.speakConcurrent(args, invoke: invoke)
    }

    // synthesizeToBuffer → renders raw audio (WAV/base64) without speaker playback.
    @objc public func synthesizeToBuffer(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SynthesizeArgs.self)
        Self.speaker.synthesizeToBuffer(args, invoke: invoke)
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

    // ---- Public entry point: open Settings as a launchpad ----
    //
    // NOTE (proven on-device, iPadOS 26.4.2): a third-party app CANNOT deep-link
    // into Settings beyond its own page. Every `prefs:`, `App-Prefs:` and even
    // iOS 26's native `settings-navigation:` URL returns open() ok=false here —
    // including the bare scheme roots — so there is no way to land the user on
    // Accessibility ▸ Spoken Content ▸ Voices. Those schemes are also private
    // API / an App Store rejection risk. The ONLY thing iOS lets us open is
    // `openSettingsURLString` (the app's own Settings page), which at least gets
    // the user INTO Settings; the in-app UI shows the exact tap path from there.
    @objc public func openTtsSettings(_ invoke: Invoke) {
        #if canImport(UIKit)
            // iOS app running on macOS (not Catalyst): open macOS System Settings.
            if openMacSystemSettingsForTTS_viaRuntime() {
                invoke.resolve()
                return
            }
            // iPhone/iPad: there is NO public API to reach Settings ▸
            // Accessibility ▸ Spoken Content ▸ Voices, the Accessibility root,
            // or even the Settings frontage (all confirmed on-device). The ONLY
            // openable Settings URL is the app's own page. An in-app modal shows
            // the exact tap path from there. (The official AccessibilitySettings
            // API only reaches a fixed allow-list — Personal Voice etc. — none
            // of which is Spoken Content/Voices, and landing on "Personal Voice"
            // misleads, so we don't use it.)
            openAppSettingsPage(invoke)
        #else
            invoke.resolve()
        #endif
    }

    #if canImport(UIKit)
        /// Open the app's own Settings page — the only public Settings URL that
        /// reliably opens (there is NO public API for the Settings root).
        private func openAppSettingsPage(_ invoke: Invoke) {
            if let appSettings = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(appSettings, options: [:]) { ok in
                    ttsLog("ttsdbg openTtsSettings | openSettingsURLString ok=", ok)
                    invoke.resolve()
                }
            } else {
                invoke.resolve()
            }
        }
    #endif

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
