import AVFoundation
import Foundation
import Speech
import Tauri
import os.log

// -----------------------------------------------------------------------------
// tauri-plugin-asr-native — iOS (Apple native STT), Phase-1 REAL implementation.
//
// Provider-agnostic dictation over Apple's on-device speech recognition,
// conforming to corpan-asr-contract. Out-of-process (the OS recognition
// daemon), ~0 added app memory, zero download for the OS's bundled locales.
//
// Engine: the SHIPPING implementation is SFSpeechRecognizer with
// `requiresOnDeviceRecognition = true` + a streaming AVAudioEngine tap — it
// compiles on the iOS 16 deployment target and covers every locale Apple
// supports on-device. (iOS 26's SpeechAnalyzer/SpeechTranscriber is a FUTURE
// upgrade behind an `#available(iOS 26)` branch — NOT in this file yet, so
// there is no iOS-26-only API here to break the build.)
//
// HARD CONSTRAINTS (all honored below):
//  • OUT-OF-PROCESS → no process-global init lock.
//  • COEXIST with tauri-plugin-radio-stream's `.longForm` AVAudioSession: we
//    set `.playAndRecord` with `.mixWithOthers` + `.duckOthers` and do NOT
//    deactivate the shared session on stop (only stop our tap). A reader/radio
//    stream keeps playing (ducked) and resumes full volume after.
//  • INTERRUPTED (call / Control-Center): AVAudioSession.interruptionNotification
//    → emit `asr://error` {code:"INTERRUPTED"} + clean cancel, never crash.
//  • Permission denied → emit {code:"MIC_DENIED"}; the JS MicInput launchpad
//    drives openSettingsURLString (iOS Settings deep-links are impossible).
//
// DEVICE-VALIDATION NOTES (the recognition path can only be confirmed on a real
// device — see DEVICE_RUNBOOK.md):
//  • Whether `capabilities()` lists the expected locales, the `.longForm`
//    radio/reader coexistence, INTERRUPTED, and MIC_DENIED all need a device.
//  • The RMS→VU scale (rms*4) + the 0.3s final-result settle are tuned by ear
//    on a real mic.
// COMPILE NOTE: cargo check on a DESKTOP target does NOT compile this Swift;
// only `tauri ios dev` does. Every throwing call here is handled (try/try?),
// resolve/reject are non-throwing, and the only iOS-version-sensitive API
// (record-permission) is `#available(iOS 17)`-branched.
// -----------------------------------------------------------------------------

private let LOG = OSLog(subsystem: "com.corpora.corpan", category: "AsrNative")

@inline(__always) private func log(_ s: String) {
    os_log("%{public}@", log: LOG, type: .info, s)
}

// MARK: - Wire types (mirror corpan-asr-contract; camelCase on the wire)

struct AsrCapability: Encodable {
    let providerId: String
    let languages: [String]
    let onDevice: Bool
    let modelSizeMB: Int
    let residentMemoryMB: Int
    let streaming: Bool
    let latencyClass: String
    let needsDownload: Bool
    let autoregressive: Bool
}

struct IsAvailableArgs: Decodable { let lang: String }
struct IsAvailableResult: Encodable { let ok: Bool; let needsDownload: Bool }

struct EnsureArgs: Decodable { let lang: String }
struct EnsureResult: Encodable { let ready: Bool; let downloading: Bool; let code: String? }

struct TranscribeArgs: Decodable { let sessionId: String; let lang: String; let mode: String }
struct TranscribeStartResult: Encodable { let started: Bool; let sessionId: String }

struct SessionRef: Decodable { let sessionId: String }
struct TranscriptOut: Encodable { let sessionId: String; let text: String; let confidence: Double; let language: String }

// Streaming event payloads (keyed by sessionId; the host routes to the JS
// AsrSession). Names mirror corpan-asr-contract's PartialEvent/LevelEvent/
// SessionErrorEvent.
private struct PartialEvent: Encodable { let sessionId: String; let text: String }
private struct LevelEvent: Encodable { let sessionId: String; let rms: Double; let tMs: Int }
private struct SessionErrorEvent: Encodable { let sessionId: String; let code: String; let message: String? }

// MARK: - Our-code ⇄ OS locale

/// Maps OUR language codes to a recognizer locale id. Mirrors the Rust
/// `os_locale` map so both layers agree on which codes the OS may cover.
private let OUR_TO_LOCALE: [String: String] = [
    "en": "en-US", "es": "es-ES", "fr": "fr-FR", "de": "de-DE", "it": "it-IT",
    "pt-BR": "pt-BR", "pt-PT": "pt-BR", "nl": "nl-NL", "ru": "ru-RU",
    "sv": "sv-SE", "da": "da-DK", "no": "nb-NO", "fi": "fi-FI", "tr": "tr-TR",
    "he": "he-IL", "ar": "ar-SA", "ja": "ja-JP", "ko-polite": "ko-KR",
    "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", "yue-Hant-HK": "yue-CN",
    "th": "th-TH", "vi": "vi-VN", "ms": "ms-MY",
]

private func localeId(for ourCode: String) -> String? { OUR_TO_LOCALE[ourCode] }

// MARK: - Plugin

class AsrNativePlugin: Plugin {

    private var sessions: [String: NativeSession] = [:]

    /// Which of OUR codes Apple actually supports on this device — computed by
    /// intersecting our locale map with SFSpeechRecognizer.supportedLocales()
    /// (the broad, always-present probe; SpeechTranscriber adds a few on 26).
    private func supportedOurCodes() -> [String] {
        let supported = SFSpeechRecognizer.supportedLocales().map { $0.identifier }
        let supportedSet = Set(supported.map { normalizeLocale($0) })
        return OUR_TO_LOCALE.compactMap { (our, loc) in
            supportedSet.contains(normalizeLocale(loc)) ? our : nil
        }
    }

    private func normalizeLocale(_ s: String) -> String {
        s.replacingOccurrences(of: "_", with: "-").lowercased()
    }

    @objc public func capabilities(_ invoke: Invoke) {
        let langs = supportedOurCodes()
        let cap = AsrCapability(
            providerId: "native",
            languages: langs,
            onDevice: true,
            modelSizeMB: 0,
            residentMemoryMB: 0,     // out-of-process: ~0 added app memory
            streaming: true,
            latencyClass: "instant",
            needsDownload: false,
            autoregressive: true)
        invoke.resolve(cap)
    }

    @objc public func isAvailable(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(IsAvailableArgs.self)
            guard let loc = localeId(for: args.lang) else {
                invoke.resolve(IsAvailableResult(ok: false, needsDownload: false))
                return
            }
            let rec = SFSpeechRecognizer(locale: Locale(identifier: loc))
            // Available AND supports on-device (we never use the network path).
            let ok = (rec?.isAvailable ?? false) && (rec?.supportsOnDeviceRecognition ?? false)
            log("isAvailable(\(args.lang)→\(loc)) ok=\(ok)")
            invoke.resolve(IsAvailableResult(ok: ok, needsDownload: false))
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func ensure(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(EnsureArgs.self)
            // SFSpeechRecognizer's on-device locales are present once supported;
            // there's no explicit per-locale download API pre-26. On iOS 26 the
            // SpeechTranscriber asset is fetched lazily on first analyze — we
            // report ready if the locale is supported, else unsupported.
            let supported = localeId(for: args.lang).map {
                SFSpeechRecognizer(locale: Locale(identifier: $0))?.supportsOnDeviceRecognition ?? false
            } ?? false
            invoke.resolve(EnsureResult(
                ready: supported, downloading: false,
                code: supported ? nil : "UNSUPPORTED_LANG"))
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func startSession(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(TranscribeArgs.self)
            guard let loc = localeId(for: args.lang) else {
                invoke.reject("UNSUPPORTED_LANG")
                return
            }
            // Permission gate — mic + speech-recognition. Denial is reported as
            // a structured session error (the JS launchpad opens Settings).
            requestAuthorization { [weak self] granted in
                guard let self = self else { return }
                guard granted else {
                    try? self.trigger("asr://error", data: SessionErrorEvent(
                        sessionId: args.sessionId, code: "MIC_DENIED",
                        message: "Microphone or speech permission denied"))
                    invoke.reject("MIC_DENIED")
                    return
                }
                do {
                    let session = try NativeSession(
                        sessionId: args.sessionId, locale: loc, ourLang: args.lang,
                        emit: { [weak self] name, payload in
                            try? self?.trigger(name, data: payload)
                        })
                    self.sessions[args.sessionId] = session
                    try session.start()
                    invoke.resolve(TranscribeStartResult(started: true, sessionId: args.sessionId))
                } catch {
                    try? self.trigger("asr://error", data: SessionErrorEvent(
                        sessionId: args.sessionId, code: "ENGINE",
                        message: error.localizedDescription))
                    invoke.reject(error.localizedDescription)
                }
            }
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func stopSession(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(SessionRef.self)
            guard let session = sessions[args.sessionId] else {
                invoke.resolve(TranscriptOut(sessionId: args.sessionId, text: "", confidence: 0, language: ""))
                return
            }
            session.finish { out in
                self.sessions[args.sessionId] = nil
                invoke.resolve(out)
            }
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func cancelSession(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(SessionRef.self)
            sessions[args.sessionId]?.cancel()
            sessions[args.sessionId] = nil
            invoke.resolve()
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    // Combined mic + speech-recognition authorization.
    private func requestAuthorization(_ done: @escaping (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            let speechOK = (status == .authorized)
            guard speechOK else { DispatchQueue.main.async { done(false) }; return }
            // iOS 17+ moved record-permission to AVAudioApplication; the old
            // AVAudioSession API is deprecated. Branch on availability (matches
            // tauri-plugin-stt) so the modern path is used + no deprecation noise.
            if #available(iOS 17.0, *) {
                AVAudioApplication.requestRecordPermission { micOK in
                    DispatchQueue.main.async { done(micOK) }
                }
            } else {
                AVAudioSession.sharedInstance().requestRecordPermission { micOK in
                    DispatchQueue.main.async { done(micOK) }
                }
            }
        }
    }
}

// MARK: - NativeSession (one live recognition)

/// Wraps an SFSpeechRecognizer streaming session driven by an AVAudioEngine tap.
/// Emits partial + level events and finalizes a transcript. Coexists with the
/// shared `.longForm` audio session (mix + duck; never deactivates it).
private final class NativeSession {
    private let sessionId: String
    private let ourLang: String
    private let recognizer: SFSpeechRecognizer
    private let request = SFSpeechAudioBufferRecognitionRequest()
    private let engine = AVAudioEngine()
    private var task: SFSpeechRecognitionTask?
    private let emit: (String, Encodable) -> Void
    private var startTime = Date()
    private var lastText = ""
    private var finished = false
    private var interruptionObserver: NSObjectProtocol?

    init(sessionId: String, locale: String, ourLang: String,
         emit: @escaping (String, Encodable) -> Void) throws {
        self.sessionId = sessionId
        self.ourLang = ourLang
        self.emit = emit
        guard let rec = SFSpeechRecognizer(locale: Locale(identifier: locale)) else {
            throw NSError(domain: "AsrNative", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "no recognizer for \(locale)"])
        }
        self.recognizer = rec
        // On-device ONLY — never the network path (privacy + offline).
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
    }

    func start() throws {
        // Configure the audio session to COEXIST with radio-stream's `.longForm`:
        // playAndRecord + mixWithOthers + duckOthers. We do NOT change the
        // category to something exclusive and we do NOT deactivate on stop, so a
        // reader/radio keeps playing (ducked) through the dictation.
        let audio = AVAudioSession.sharedInstance()
        try audio.setCategory(.playAndRecord, mode: .measurement,
                              options: [.duckOthers, .mixWithOthers, .defaultToSpeaker])
        try audio.setActive(true, options: [])

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            guard let self = self else { return }
            self.request.append(buffer)
            self.emitLevel(buffer)
        }

        startTime = Date()
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                self.lastText = result.bestTranscription.formattedString
                self.emit("asr://partial", PartialEvent(sessionId: self.sessionId, text: self.lastText))
            }
            if error != nil || (result?.isFinal ?? false) {
                // Natural end or engine error; finalization happens in finish()/cancel().
            }
        }

        observeInterruptions()
        engine.prepare()
        try engine.start()
        log("session \(sessionId) started (\(ourLang))")
    }

    func finish(_ done: @escaping (TranscriptOut) -> Void) {
        teardownAudio()
        request.endAudio()
        // Give the recognizer a brief moment to emit the final result, then
        // resolve with the best text we have.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            guard let self = self, !self.finished else { return }
            self.finished = true
            self.task?.finish()
            done(TranscriptOut(sessionId: self.sessionId, text: self.lastText,
                               confidence: self.lastText.isEmpty ? 0 : 0.9,
                               language: self.ourLang))
        }
    }

    func cancel() {
        finished = true
        teardownAudio()
        task?.cancel()
    }

    // MARK: internals

    private func emitLevel(_ buffer: AVAudioPCMBuffer) {
        guard let ch = buffer.floatChannelData?[0] else { return }
        let n = Int(buffer.frameLength)
        if n == 0 { return }
        var sum: Float = 0
        for i in 0..<n { let s = ch[i]; sum += s * s }
        let rms = Double((sum / Float(n)).squareRoot())
        let tMs = Int(Date().timeIntervalSince(startTime) * 1000)
        emit("asr://level", LevelEvent(sessionId: sessionId, rms: min(1.0, rms * 4), tMs: tMs))
    }

    private func observeInterruptions() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] note in
            guard let self = self else { return }
            guard let info = note.userInfo,
                  let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw),
                  type == .began else { return }
            // Call / Control-Center pull → clean cancel, structured event.
            self.emit("asr://error", SessionErrorEvent(
                sessionId: self.sessionId, code: "INTERRUPTED", message: nil))
            self.cancel()
        }
    }

    private func teardownAudio() {
        if let obs = interruptionObserver {
            NotificationCenter.default.removeObserver(obs)
            interruptionObserver = nil
        }
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
        // DELIBERATELY do not setActive(false): leave the shared `.longForm`
        // session active so radio-stream / the reader keep playing. The OS
        // un-ducks others when our recording stops.
    }
}

@_cdecl("init_plugin_asr_native")
func initPlugin() -> Plugin {
    return AsrNativePlugin()
}
