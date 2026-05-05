import AVFoundation
import CoreML
import Foundation
import Tauri
import WhisperKit
import os.log

#if canImport(UIKit)
    import UIKit
#endif

// -----------------------------------------------------------------------------
// Logging
// -----------------------------------------------------------------------------
private let STT_SUBSYSTEM = "com.corpora.corpan"
private let STT_CATEGORY = "STT"
private let sttLogObj = OSLog(subsystem: STT_SUBSYSTEM, category: STT_CATEGORY)

@inline(__always) private func sttLog(_ items: Any...) {
    os_log(
        "%{public}@", log: sttLogObj, type: .info,
        items.map { "\($0)" }.joined(separator: " "))
}

@inline(__always) private func sttErr(_ items: Any...) {
    os_log(
        "%{public}@", log: sttLogObj, type: .error,
        items.map { "\($0)" }.joined(separator: " "))
}

// -----------------------------------------------------------------------------
// Args / Results
// -----------------------------------------------------------------------------
final class PrepareArgs: Decodable {
    let model: String?
    private enum CodingKeys: String, CodingKey { case model }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        model = try c.decodeIfPresent(String.self, forKey: .model)
    }
}

final class StartSessionArgs: Decodable {
    let sessionId: String
    let language: String
    let expectedText: String

    private enum CodingKeys: String, CodingKey {
        case sessionId, language, expectedText
        case session_id, expected_text
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let sessionCamel = try c.decodeIfPresent(String.self, forKey: .sessionId)
        let sessionSnake = try c.decodeIfPresent(String.self, forKey: .session_id)
        sessionId = sessionCamel ?? sessionSnake ?? UUID().uuidString
        language = (try c.decodeIfPresent(String.self, forKey: .language)) ?? "en"
        let expectedCamel = try c.decodeIfPresent(String.self, forKey: .expectedText)
        let expectedSnake = try c.decodeIfPresent(String.self, forKey: .expected_text)
        expectedText = expectedCamel ?? expectedSnake ?? ""
    }
}

final class SessionIdArgs: Decodable {
    let sessionId: String
    private enum CodingKeys: String, CodingKey {
        case sessionId
        case session_id
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let camel = try c.decodeIfPresent(String.self, forKey: .sessionId)
        let snake = try c.decodeIfPresent(String.self, forKey: .session_id)
        sessionId = camel ?? snake ?? ""
    }
}

struct WordTimingPayload: Encodable {
    let word: String
    let startMs: Int
    let endMs: Int
    let probability: Float
}

struct TranscriptionPayload: Encodable {
    let sessionId: String
    let text: String
    let expectedText: String
    /// The full language code the pack passed in (e.g. `"pa-Arab"`,
    /// `"zh-Hans"`). What the user asked us to transcribe.
    let language: String
    /// The two-letter base code we actually sent to Whisper (e.g. `"pa"`,
    /// `"zh"`). Surfaced so the UI can warn on script mismatches —
    /// Whisper can output `pa` only in Gurmukhi, but Corpan stores
    /// Shahmukhi for `pa-Arab`; their transcripts will never match.
    let whisperLanguage: String
    let durationMs: Int
    let overallScore: Float
    let transcriptScore: Float
    let likelihoodScore: Float
    let acousticScore: Float
    let avgLogprob: Float
    /// Max `noSpeechProb` across segments. Whisper's posterior that the
    /// audio contains no speech. > 0.5 → mic was effectively silent.
    let noSpeechProb: Float
    /// Max `compressionRatio` across segments. > 2.4 → repeating gibberish
    /// (Whisper's own threshold).
    let compressionRatio: Float
    /// Max sampling `temperature` across segments. > 0 → decoder fell back
    /// because greedy decoding failed quality gates internally.
    let temperature: Float
    /// Min per-token logprob (chosen-token, across all segments). Catches
    /// the case where average logprob is OK but one specific token was
    /// very weak — useful for low-resource languages where one bad token
    /// drags the whole utterance.
    let minTokenLogprob: Float
    /// Stdev of per-token chosen-token logprobs. High = some tokens
    /// confident, others not (an honest pronunciation problem signal).
    let tokenLogprobStdev: Float
    /// Levenshtein similarity between the **free-decode** transcript
    /// (no prompt/prefix) and the **constrained-decode** transcript
    /// (with `prefixTokens`). 1.0 = audio honestly says expected; <0.6 =
    /// prior is doing the work. Will be `1.0` until dual-decode is wired.
    let freeVsConstrainedSimilarity: Float
    /// What Whisper heard with no prompt/prefix bias — useful for
    /// diagnostics in the result UI. Empty string until dual-decode is
    /// wired.
    let freeText: String
    let words: [WordTimingPayload]
}

struct PreparePayload: Encodable {
    let ready: Bool
    let model: String
    let message: String?
}

struct StartSessionPayload: Encodable {
    let started: Bool
    let sessionId: String
}

struct StatusPayload: Encodable {
    let available: Bool
    let prepared: Bool
    let model: String?
    let recording: Bool
    let message: String?
}

struct InstallProgressPayload: Encodable {
    let model: String
    let phase: String  // downloading | verifying | verified | failed
    let fraction: Double?
    let completed: Int64?
    let total: Int64?
    let error: String?
}

struct InstallResultPayload: Encodable {
    let installed: Bool
    let model: String
    let alreadyInstalled: Bool
}

struct ValidateModelPayload: Encodable {
    let model: String
    let valid: Bool
    let problems: [String]
}

// -----------------------------------------------------------------------------
// Whisper Manager
// -----------------------------------------------------------------------------

private final class WhisperManager {
    static let shared = WhisperManager()

    private let queue = DispatchQueue(label: "com.corpora.stt.manager")
    private var whisperKit: WhisperKit?
    private var loadedModel: String?
    private var loadingTask: Task<Void, Error>?

    // Audio capture
    private var audioEngine: AVAudioEngine?
    private var converter: AVAudioConverter?
    private var converterOutputFormat: AVAudioFormat?
    private var capturedSamples: [Float] = []
    private var activeSessionId: String?
    private var activeLanguage: String = "en"
    private var activeExpected: String = ""
    private var sessionStartedAt: Date?
    private var isRecording = false

    private static let defaultModel = "openai_whisper-base"
    private static let targetSampleRate: Double = 16000.0

    /// CPU+GPU compute units for both audio encoder and text decoder.
    ///
    /// WhisperKit's default is `.cpuAndNeuralEngine` for the text decoder,
    /// which on certain Apple silicon (some M-series iPad chips in
    /// particular) fails to compile a CoreML execution plan for the
    /// `large-v3-turbo` text decoder graph and surfaces as error code -14.
    /// CPU+GPU is still hardware-accelerated, works for every model on
    /// every device we ship to, and is what argmax's own example app uses
    /// for cross-device safety.
    private static func makeComputeOptions() -> ModelComputeOptions {
        return ModelComputeOptions(
            audioEncoderCompute: .cpuAndGPU,
            textDecoderCompute: .cpuAndGPU
        )
    }

    // ---------------------------------------------------------------------
    // Model storage layout (must match WhisperKit / swift-transformers)
    // ---------------------------------------------------------------------
    private func documentsDir() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    private func modelDir(_ name: String) -> URL {
        return documentsDir()
            .appendingPathComponent("huggingface")
            .appendingPathComponent("models")
            .appendingPathComponent("argmaxinc")
            .appendingPathComponent("whisperkit-coreml")
            .appendingPathComponent(name)
    }

    private func cacheDir(_ name: String) -> URL {
        return documentsDir()
            .appendingPathComponent(".cache")
            .appendingPathComponent("huggingface")
            .appendingPathComponent("download")
            .appendingPathComponent("argmaxinc")
            .appendingPathComponent("whisperkit-coreml")
            .appendingPathComponent(name)
    }

    /// Walks the on-disk model dir and returns any required `weights/weight.bin`
    /// files that are missing OR suspiciously small. swift-transformers has a
    /// bug where a partial download is reported as success without the rename
    /// completing, leaving 0-byte / truncated weight files. Real WhisperKit
    /// weight.bin files are always > 1 MB; we use 1 KB as a generous floor.
    private func validateModel(_ name: String) -> [String] {
        let root = modelDir(name)
        let fm = FileManager.default
        var problems: [String] = []
        guard let contents = try? fm.contentsOfDirectory(atPath: root.path) else {
            return ["<model dir missing>"]
        }
        var sawMlmodelc = false
        for entry in contents where entry.hasSuffix(".mlmodelc") {
            sawMlmodelc = true
            let mil = root.appendingPathComponent(entry).appendingPathComponent("model.mil")
            let weightFile = root.appendingPathComponent(entry)
                .appendingPathComponent("weights")
                .appendingPathComponent("weight.bin")
            if !fm.fileExists(atPath: mil.path) {
                problems.append("\(entry)/model.mil")
            }
            if !fm.fileExists(atPath: weightFile.path) {
                problems.append("\(entry)/weights/weight.bin")
                continue
            }
            let attrs = try? fm.attributesOfItem(atPath: weightFile.path)
            let size = (attrs?[.size] as? NSNumber)?.intValue ?? 0
            if size < 1024 {
                problems.append("\(entry)/weights/weight.bin (size=\(size) too small)")
            }
        }
        if !sawMlmodelc { problems.append("<no .mlmodelc subdirs>") }
        return problems
    }

    fileprivate func wipeModel(_ name: String) {
        let fm = FileManager.default
        try? fm.removeItem(at: modelDir(name))
        try? fm.removeItem(at: cacheDir(name))
        sttLog("Whisper | wiped model + cache for re-download:", name)
    }

    /// Public validation entry point — pack calls this on boot to decide
    /// between the install flow and the recording flow.
    func validateInstall(model requested: String?) -> (
        model: String, valid: Bool, problems: [String]
    ) {
        let modelName = requested ?? Self.defaultModel
        let problems = self.validateModel(modelName)
        return (modelName, problems.isEmpty, problems)
    }

    /// Public wipe entry point — pack calls this when it sees a hang or a
    /// CoreML "could not open" / error -14 to recover from a corrupt download.
    func wipe(model requested: String?) {
        let modelName = requested ?? Self.defaultModel
        queue.sync {
            // Drop any in-memory kit pointing at the corrupt files so the next
            // prepare() rebuilds from disk.
            if self.loadedModel == modelName {
                self.whisperKit = nil
                self.loadedModel = nil
            }
        }
        wipeModel(modelName)
    }

    // ---------------------------------------------------------------------
    // Status
    // ---------------------------------------------------------------------
    func status() -> StatusPayload {
        return queue.sync {
            StatusPayload(
                available: true,
                prepared: whisperKit != nil,
                model: loadedModel,
                recording: isRecording,
                message: nil
            )
        }
    }

    func isAvailable() -> Bool { true }

    // ---------------------------------------------------------------------
    // Install (download + verify, with progress events)
    //
    // Separated from `prepare` so the heavy network/disk work happens in
    // an explicit onboarding flow with a progress UI. Once a model is
    // verified-installed, prepare() never touches the network or
    // re-downloads — it just maps the on-disk weights into memory.
    // ---------------------------------------------------------------------
    func installModel(
        model requested: String?,
        progress onProgress: @escaping (InstallProgressPayload) -> Void,
        completion: @escaping (Result<InstallResultPayload, Error>) -> Void
    ) {
        let modelName = requested ?? Self.defaultModel
        sttLog("Whisper | install requested:", modelName)

        if self.validateModel(modelName).isEmpty {
            sttLog("Whisper | already installed and valid:", modelName)
            onProgress(
                InstallProgressPayload(
                    model: modelName, phase: "verified",
                    fraction: 1.0, completed: nil, total: nil, error: nil))
            completion(
                .success(
                    InstallResultPayload(
                        installed: true, model: modelName, alreadyInstalled: true)))
            return
        }

        sttLog("Whisper | wiping any partial state before install:", modelName)
        self.wipeModel(modelName)

        onProgress(
            InstallProgressPayload(
                model: modelName, phase: "downloading",
                fraction: 0.0, completed: nil, total: nil, error: nil))

        Task {
            do {
                let folder = try await WhisperKit.download(
                    variant: modelName,
                    progressCallback: { p in
                        onProgress(
                            InstallProgressPayload(
                                model: modelName,
                                phase: "downloading",
                                fraction: p.fractionCompleted,
                                completed: p.completedUnitCount,
                                total: p.totalUnitCount,
                                error: nil))
                    }
                )
                sttLog("Whisper | download finished:", folder.path)

                onProgress(
                    InstallProgressPayload(
                        model: modelName, phase: "verifying",
                        fraction: 1.0, completed: nil, total: nil, error: nil))

                // Tier 1 — file-level: every required weight.bin present
                // and at least 1 KB. Cheap; catches obviously-missing files.
                let problems = self.validateModel(modelName)
                if !problems.isEmpty {
                    sttErr(
                        "Whisper | post-download file check failed:",
                        problems.joined(separator: ", "))
                    self.wipeModel(modelName)
                    let msg =
                        "Verification failed: \(problems.joined(separator: ", "))"
                    onProgress(
                        InstallProgressPayload(
                            model: modelName, phase: "failed",
                            fraction: nil, completed: nil, total: nil, error: msg))
                    completion(
                        .failure(
                            NSError(
                                domain: "STT", code: 30,
                                userInfo: [NSLocalizedDescriptionKey: msg])))
                    return
                }

                // Tier 2 — semantic: actually load the model through
                // WhisperKit (which means CoreML compiles each mlmodelc
                // into an ANE execution plan). If the on-disk bytes are
                // truncated or otherwise garbage, CoreML throws here with
                // "could not open weight.bin" or "error code -14". This is
                // the real verifier — file size says nothing about whether
                // the bytes actually parse.
                sttLog("Whisper | running CoreML load test:", modelName)
                do {
                    let folder = self.modelDir(modelName).path
                    let config = WhisperKitConfig(
                        model: modelName,
                        modelFolder: folder,
                        computeOptions: Self.makeComputeOptions(),
                        prewarm: true,  // force CoreML specialization once at install
                        download: false)
                    let kit = try await WhisperKit(config)

                    // Cache the loaded kit so the next prepare() is instant
                    // — the ANE plan is already built and resident.
                    self.queue.sync {
                        self.whisperKit = kit
                        self.loadedModel = modelName
                    }
                } catch {
                    sttErr(
                        "Whisper | CoreML load test failed:",
                        error.localizedDescription)
                    self.wipeModel(modelName)
                    let msg =
                        "Model files downloaded but failed to load on-device. The download was probably truncated. (\(error.localizedDescription))"
                    onProgress(
                        InstallProgressPayload(
                            model: modelName, phase: "failed",
                            fraction: nil, completed: nil, total: nil, error: msg))
                    completion(
                        .failure(
                            NSError(
                                domain: "STT", code: 31,
                                userInfo: [NSLocalizedDescriptionKey: msg])))
                    return
                }

                onProgress(
                    InstallProgressPayload(
                        model: modelName, phase: "verified",
                        fraction: 1.0, completed: nil, total: nil, error: nil))
                sttLog("Whisper | install + load test ok:", modelName)
                completion(
                    .success(
                        InstallResultPayload(
                            installed: true, model: modelName, alreadyInstalled: false)))
            } catch {
                sttErr("Whisper | install failed:", error.localizedDescription)
                self.wipeModel(modelName)
                onProgress(
                    InstallProgressPayload(
                        model: modelName, phase: "failed",
                        fraction: nil, completed: nil, total: nil,
                        error: error.localizedDescription))
                completion(.failure(error))
            }
        }
    }

    // ---------------------------------------------------------------------
    // Prepare — local-only load.
    //
    // Strictly loads weights from disk into memory. NEVER downloads. If
    // the model isn't installed, returns ready=false with a clear message;
    // the caller is expected to surface an install flow.
    // ---------------------------------------------------------------------
    func prepare(model requested: String?, completion: @escaping (PreparePayload) -> Void) {
        let modelName = requested ?? Self.defaultModel
        sttLog("Whisper | prepare requested (local-only):", modelName)

        if let current = self.whisperKit, self.loadedModel == modelName {
            sttLog("Whisper | already loaded:", modelName)
            _ = current
            completion(PreparePayload(ready: true, model: modelName, message: nil))
            return
        }

        // Hard pre-flight: if any required weight is missing or truncated,
        // refuse to load. The recording UX should never silently re-download.
        let problems = self.validateModel(modelName)
        if !problems.isEmpty {
            sttErr(
                "Whisper | prepare refused — model not installed:",
                problems.joined(separator: ", "))
            completion(
                PreparePayload(
                    ready: false, model: modelName,
                    message:
                        "Model not installed. Run install first. (\(problems.joined(separator: ", ")))"
                ))
            return
        }

        // Unload the previously-loaded model BEFORE allocating the new
        // one. Without this, switching from Standard (`base`, ~150 MB)
        // → Advanced (`large-v3-turbo`, ~640 MB) peaks at the sum of
        // both models in resident memory plus their CoreML/ANE/GPU
        // weight buffers, which can blow past iOS's per-app limit and
        // crash the app. The reverse direction (large → small) didn't
        // crash because peak memory is bounded by the already-resident
        // large model. Drop the reference, then queue.sync on a noop
        // to flush the deallocation before we kick off the new load.
        if let prev = self.loadedModel, prev != modelName {
            sttLog("Whisper | unloading previous model before swap:", prev)
            self.queue.sync {
                self.whisperKit = nil
                self.loadedModel = nil
            }
        }

        Task {
            do {
                sttLog("Whisper | loading model from disk:", modelName)
                // download: false plus an explicit local modelFolder tells
                // WhisperKit "the model is already there, just load it" —
                // and it can never sneak in a network call. With download:
                // false alone, WhisperKit raises "Model folder is not set"
                // because it has nothing to discover.
                let folder = self.modelDir(modelName).path
                let config = WhisperKitConfig(
                    model: modelName,
                    modelFolder: folder,
                    computeOptions: Self.makeComputeOptions(),
                    prewarm: true,  // ensure CoreML specialized cache is hit before first transcribe
                    download: false)
                let kit = try await WhisperKit(config)

                self.queue.sync {
                    self.whisperKit = kit
                    self.loadedModel = modelName
                }
                sttLog("Whisper | loaded ok:", modelName)
                completion(PreparePayload(ready: true, model: modelName, message: nil))
            } catch {
                sttErr("Whisper | load failed:", error.localizedDescription)
                completion(
                    PreparePayload(
                        ready: false, model: modelName,
                        message: "load failed: \(error.localizedDescription)"))
            }
        }
    }

    // ---------------------------------------------------------------------
    // Mic permission
    // ---------------------------------------------------------------------
    private func ensureMicPermission(completion: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission { granted in
                completion(granted)
            }
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                completion(granted)
            }
        }
    }

    // ---------------------------------------------------------------------
    // Start recording
    // ---------------------------------------------------------------------
    func startSession(
        sessionId: String, language: String, expectedText: String,
        completion: @escaping (Result<StartSessionPayload, Error>) -> Void
    ) {
        sttLog(
            "Whisper | startSession id:", sessionId, "lang:", language,
            "expected:", expectedText.prefix(60))

        ensureMicPermission { granted in
            guard granted else {
                sttErr("Whisper | mic permission denied")
                completion(
                    .failure(
                        NSError(
                            domain: "STT", code: 1,
                            userInfo: [NSLocalizedDescriptionKey: "Microphone permission denied"])))
                return
            }

            self.queue.async {
                if self.isRecording {
                    sttLog("Whisper | stopping previous session before new start")
                    self.teardownAudio()
                }

                do {
                    try self.configureSession()
                    try self.startAudioEngine()
                } catch {
                    sttErr("Whisper | audio engine start failed:", error.localizedDescription)
                    completion(.failure(error))
                    return
                }

                self.activeSessionId = sessionId
                self.activeLanguage = language
                self.activeExpected = expectedText
                self.sessionStartedAt = Date()
                self.capturedSamples.removeAll(keepingCapacity: true)
                self.isRecording = true

                sttLog("Whisper | session started ok:", sessionId)
                completion(.success(StartSessionPayload(started: true, sessionId: sessionId)))
            }
        }
    }

    // ---------------------------------------------------------------------
    // Stop and transcribe
    // ---------------------------------------------------------------------
    func stopSession(
        sessionId: String,
        completion: @escaping (Result<TranscriptionPayload, Error>) -> Void
    ) {
        sttLog("Whisper | stopSession id:", sessionId)

        // Snapshot session state on the queue
        let snapshot: (
            captured: [Float], language: String, expected: String,
            startedAt: Date?, activeId: String?
        ) = queue.sync {
            let s = (
                captured: self.capturedSamples,
                language: self.activeLanguage,
                expected: self.activeExpected,
                startedAt: self.sessionStartedAt,
                activeId: self.activeSessionId
            )
            self.teardownAudio()
            self.isRecording = false
            self.activeSessionId = nil
            self.capturedSamples.removeAll(keepingCapacity: false)
            return s
        }
        let captured = snapshot.captured
        let language = snapshot.language
        let expected = snapshot.expected
        let startedAt = snapshot.startedAt
        let activeId = snapshot.activeId

        if activeId == nil {
            sttErr("Whisper | stopSession called with no active session")
        }

        guard let kit = whisperKit else {
            sttErr("Whisper | stopSession but model not loaded; calling prepare first")
            completion(
                .failure(
                    NSError(
                        domain: "STT", code: 2,
                        userInfo: [NSLocalizedDescriptionKey: "WhisperKit not prepared"])))
            return
        }

        let durationMs = startedAt.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
        sttLog(
            "Whisper | transcribing samples:", captured.count, "duration_ms:", durationMs)

        let modelForRecovery = self.loadedModel
        let transcribeTimeoutNs: UInt64 = 60 * 1_000_000_000  // 60s — generous; corrupt models hang here

        Task {
            do {
                let baseLang = String(language.split(separator: "-").first ?? Substring(language))
                    .lowercased()

                // Validate the code against Whisper's 99-language list.
                // If we pass an unsupported code, Whisper silently falls
                // back to English transcription (or worse), and we'd
                // score the user against gibberish.
                guard Constants.languageCodes.contains(baseLang) else {
                    sttErr(
                        "Whisper | unsupported language code:", baseLang,
                        "(from", language, ") — refusing to score")
                    completion(
                        .failure(
                            NSError(
                                domain: "STT", code: 60,
                                userInfo: [
                                    NSLocalizedDescriptionKey:
                                        "Whisper doesn't support language '\(baseLang)' — pronunciation scoring isn't available for this language."
                                ])))
                    return
                }

                var options = DecodingOptions()
                options.language = baseLang
                options.task = .transcribe
                options.wordTimestamps = true
                options.usePrefillPrompt = true

                // `prefixTokens` is the right knob for "I expect the
                // decoder to output approximately these tokens". It's
                // appended after the SOT/lang/task prefill and (unlike
                // `promptTokens`, which is treated as conversation
                // context) feeds directly into the output sequence —
                // giving us per-token logprobs against the *expected*
                // text. With `promptTokens` the chosen tokens were the
                // free-decode tokens, and the prior bias was indirect.
                var expectedTokenCount = 0
                if !expected.isEmpty, let tokenizer = kit.tokenizer {
                    let tokens = tokenizer.encode(text: expected)
                    if !tokens.isEmpty {
                        options.prefixTokens = tokens
                        expectedTokenCount = tokens.count
                    }
                }

                // Latency caps. Nonsense audio (which hits the no-stop
                // case in greedy decoding then thrashes through every
                // temperature fallback) was taking 5–10× longer than
                // good-pronunciation audio. Two knobs to pin it:
                //
                //   - `sampleLength`: phrase-aware token cap. Default
                //     is 224 (Constants.maxTokenContext). For practice
                //     phrases of typically <30 words (~60 tokens),
                //     capping to ~3× the expected token count keeps
                //     good speech fast and bounds the worst case.
                //   - `temperatureFallbackCount`: default 5 (greedy
                //     plus 5 retries at temperatures 0.2/0.4/0.6/0.8/1.0).
                //     For pronunciation training we WANT the honest
                //     greedy result — fallback was Whisper rescuing
                //     bad audio at high temperature, which is exactly
                //     the prior-rescue pattern we're fighting. Drop to
                //     0 so the greedy pass is final.
                let cappedSampleLength = max(40, min(120, expectedTokenCount * 3))

                options.sampleLength = cappedSampleLength
                options.temperatureFallbackCount = 0

                // Pass A — constrained decode (with prefixTokens biasing
                // the decoder toward the expected text). This is the
                // primary path; word timings and the rich segment signals
                // come from here.
                //
                // Pass B — free decode (no prefix, no prompt). What does
                // Whisper hear when not biased? If it diverges from
                // expected the prior was rescuing weak audio, which is
                // the FR/ES "got away with murder" pattern.
                //
                // We pay ~2× transcribe latency for this. An encoder-
                // shared optimization (run audio encoder once, decode
                // twice with shared output) would bring it back to ~1.3×
                // but requires reaching past kit.transcribe(...) into
                // the TextDecoding/AudioEncoding protocols and rebuilding
                // sampler / prompt-builder / language-detect bookkeeping
                // by hand. Worth doing only if user-visible latency
                // proves a problem.
                var freeOptions = DecodingOptions()
                freeOptions.language = baseLang
                freeOptions.task = .transcribe
                freeOptions.wordTimestamps = false  // don't need timings for the free pass
                freeOptions.usePrefillPrompt = true
                freeOptions.sampleLength = cappedSampleLength
                freeOptions.temperatureFallbackCount = 0
                // No prefixTokens, no promptTokens — pure unconditioned decode.

                let dualResults: (
                    constrained: [TranscriptionResult], free: [TranscriptionResult]
                ) = try await withThrowingTaskGroup(
                    of: (Int, [TranscriptionResult]).self
                ) { group in
                    // Constrained
                    group.addTask {
                        let r = try await kit.transcribe(
                            audioArray: captured, decodeOptions: options)
                        return (0, r)
                    }
                    // Free
                    group.addTask {
                        let r = try await kit.transcribe(
                            audioArray: captured, decodeOptions: freeOptions)
                        return (1, r)
                    }
                    // Hard deadline so a CoreML hang can't lock the UI.
                    group.addTask {
                        try await Task.sleep(nanoseconds: transcribeTimeoutNs)
                        throw NSError(
                            domain: "STT", code: 50,
                            userInfo: [
                                NSLocalizedDescriptionKey:
                                    "Transcription timed out — model may be corrupt"
                            ])
                    }

                    var constrained: [TranscriptionResult] = []
                    var free: [TranscriptionResult] = []
                    for _ in 0..<2 {
                        let (which, r) = try await group.next()!
                        if which == 0 {
                            constrained = r
                        } else {
                            free = r
                        }
                    }
                    group.cancelAll()
                    return (constrained, free)
                }

                let merged = self.mergeResults(dualResults.constrained)
                let freeText = dualResults.free
                    .map { $0.text }
                    .joined(separator: " ")
                    .trimmingCharacters(in: .whitespacesAndNewlines)

                // Loud failure surfacing. Empty free-decode with a
                // non-empty expected phrase means Whisper couldn't
                // transcribe the audio without the prefix prefix-bias
                // crutch — a genuine pronunciation failure mode that
                // we MUST NOT silently downgrade to constrained-only
                // scoring (which would return an inflated number from
                // the prior-rescued constrained pass).
                if freeText.isEmpty && !expected.isEmpty {
                    sttErr(
                        "Whisper | free decode returned EMPTY for session",
                        sessionId,
                        "| lang:", baseLang,
                        "| expected:", expected.prefix(80),
                        "| constrained heard:", merged.text.prefix(80),
                        "— scoring will treat as zero free-similarity")
                }

                let scoring = self.computeScores(
                    merged: merged, expected: expected,
                    language: baseLang, freeText: freeText)

                let payload = TranscriptionPayload(
                    sessionId: sessionId,
                    text: merged.text,
                    expectedText: expected,
                    language: language,
                    whisperLanguage: baseLang,
                    durationMs: durationMs,
                    overallScore: scoring.overall,
                    transcriptScore: scoring.transcript,
                    likelihoodScore: scoring.likelihood,
                    acousticScore: scoring.acoustic,
                    avgLogprob: merged.avgLogprob,
                    noSpeechProb: merged.noSpeechProb,
                    compressionRatio: merged.compressionRatio,
                    temperature: merged.temperature,
                    minTokenLogprob: merged.minTokenLogprob,
                    tokenLogprobStdev: merged.tokenLogprobStdev,
                    freeVsConstrainedSimilarity: scoring.freeVsConstrainedSimilarity,
                    freeText: freeText,
                    words: merged.words
                )

                let avgWordProb =
                    merged.words.isEmpty
                    ? Float(0)
                    : merged.words.map { $0.probability }.reduce(0, +)
                        / Float(merged.words.count)
                let minWordProb = merged.words.map { $0.probability }.min() ?? 0
                let normHeard = self.normalize(merged.text, lang: baseLang)
                let normExp = self.normalize(expected, lang: baseLang)
                sttLog(
                    "Whisper | [stt-cal] lang(pack):", language,
                    "| lang(whisper):", baseLang,
                    "| heard:", merged.text.prefix(80),
                    "| expected:", expected.prefix(80))
                sttLog(
                    "Whisper | [stt-cal] normHeard:", normHeard.prefix(80),
                    "| normExp:", normExp.prefix(80))
                sttLog(
                    "Whisper | [stt-cal] wordCount:", merged.words.count,
                    "| transcript:", String(format: "%.2f", scoring.transcript),
                    "| avgWordProb:", String(format: "%.2f", avgWordProb),
                    "| minWordProb:", String(format: "%.2f", minWordProb),
                    "| acoustic:", String(format: "%.2f", scoring.acoustic),
                    "| likelihood:", String(format: "%.2f", scoring.likelihood),
                    "| overall:", String(format: "%.2f", scoring.overall))
                sttLog(
                    "Whisper | [stt-cal] noSpeech:",
                    String(format: "%.2f", merged.noSpeechProb),
                    "| compression:",
                    String(format: "%.2f", merged.compressionRatio),
                    "| temperature:",
                    String(format: "%.2f", merged.temperature),
                    "| minTokenLogprob:",
                    String(format: "%.2f", merged.minTokenLogprob),
                    "| tokenLogprobStdev:",
                    String(format: "%.2f", merged.tokenLogprobStdev),
                    "| freeVsConstrained:",
                    String(format: "%.2f", scoring.freeVsConstrainedSimilarity))

                completion(.success(payload))
            } catch {
                sttErr("Whisper | transcribe failed:", error.localizedDescription)
                // Heuristic: if the failure mentions weight/MIL/execution-plan or
                // we timed out, the model on disk is bad. Drop the in-memory kit
                // so the next prepare() re-validates and re-downloads if needed.
                let msg = error.localizedDescription.lowercased()
                let looksCorrupt =
                    msg.contains("weight.bin") || msg.contains("model.mil")
                    || msg.contains("execution plan") || msg.contains("timed out")
                    || msg.contains("could not open") || msg.contains("error code : -14")
                if looksCorrupt, let m = modelForRecovery {
                    sttErr("Whisper | model looks corrupt, dropping in-memory kit:", m)
                    self.queue.sync {
                        if self.loadedModel == m {
                            self.whisperKit = nil
                            self.loadedModel = nil
                        }
                    }
                }
                completion(.failure(error))
            }
        }
    }

    // ---------------------------------------------------------------------
    // Cancel
    // ---------------------------------------------------------------------
    func cancelSession(sessionId: String) {
        sttLog("Whisper | cancelSession id:", sessionId)
        queue.sync {
            self.teardownAudio()
            self.isRecording = false
            self.activeSessionId = nil
            self.capturedSamples.removeAll(keepingCapacity: false)
        }
    }

    // ---------------------------------------------------------------------
    // Audio session / engine plumbing
    // ---------------------------------------------------------------------
    private func configureSession() throws {
        #if canImport(UIKit)
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
                .playAndRecord, mode: .measurement,
                options: [.defaultToSpeaker, .duckOthers])
            try session.setActive(true, options: [])
        #endif
    }

    private func startAudioEngine() throws {
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)

        guard
            let target = AVAudioFormat(
                commonFormat: .pcmFormatFloat32,
                sampleRate: Self.targetSampleRate,
                channels: 1,
                interleaved: false)
        else {
            throw NSError(
                domain: "STT", code: 10,
                userInfo: [NSLocalizedDescriptionKey: "Failed to build target format"])
        }

        guard let conv = AVAudioConverter(from: inputFormat, to: target) else {
            throw NSError(
                domain: "STT", code: 11,
                userInfo: [NSLocalizedDescriptionKey: "Failed to build audio converter"])
        }

        self.audioEngine = engine
        self.converter = conv
        self.converterOutputFormat = target

        let bufferSize: AVAudioFrameCount = 4096
        input.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) {
            [weak self] buffer, _ in
            self?.handleInput(buffer: buffer)
        }

        engine.prepare()
        try engine.start()
        sttLog(
            "Whisper | audio engine started inputFormat:",
            "\(inputFormat.sampleRate)Hz",
            "ch:", inputFormat.channelCount)
    }

    private func teardownAudio() {
        if let engine = audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        audioEngine = nil
        converter = nil
        converterOutputFormat = nil

        #if canImport(UIKit)
            do {
                try AVAudioSession.sharedInstance().setActive(
                    false, options: .notifyOthersOnDeactivation)
            } catch {
                // best effort
            }
        #endif
    }

    private func handleInput(buffer: AVAudioPCMBuffer) {
        guard let conv = self.converter,
            let outFormat = self.converterOutputFormat
        else { return }

        // Estimate output frame capacity using sample-rate ratio.
        let ratio = outFormat.sampleRate / buffer.format.sampleRate
        let cap = AVAudioFrameCount(Double(buffer.frameLength) * ratio + 1024)

        guard let outBuf = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: cap)
        else { return }

        var fed = false
        let status = conv.convert(to: outBuf, error: nil) { _, outStatus in
            if fed {
                outStatus.pointee = .noDataNow
                return nil
            }
            fed = true
            outStatus.pointee = .haveData
            return buffer
        }

        guard status != .error, let chans = outBuf.floatChannelData else { return }
        let frames = Int(outBuf.frameLength)
        if frames == 0 { return }

        let ptr = chans[0]
        let chunk = Array(UnsafeBufferPointer(start: ptr, count: frames))

        queue.async {
            self.capturedSamples.append(contentsOf: chunk)
        }
    }

    // ---------------------------------------------------------------------
    // Result merging + scoring
    // ---------------------------------------------------------------------
    private struct MergedResult {
        let text: String
        let avgLogprob: Float
        let words: [WordTimingPayload]
        let noSpeechProb: Float  // worst (max) across segments
        let compressionRatio: Float  // worst (max) across segments
        let temperature: Float  // worst (max) — > 0 means decoder fell back
        let minTokenLogprob: Float  // worst chosen-token logprob
        let tokenLogprobStdev: Float  // spread of chosen-token logprobs
    }

    private func mergeResults(_ results: [TranscriptionResult]) -> MergedResult {
        var fullText = ""
        var logprobSum: Float = 0
        var logprobCount: Int = 0
        var words: [WordTimingPayload] = []
        var maxNoSpeech: Float = 0
        var maxCompression: Float = 0
        var maxTemperature: Float = 0
        var perTokenLogprobs: [Float] = []

        for result in results {
            fullText.append(result.text)
            for segment in result.segments {
                logprobSum += segment.avgLogprob
                logprobCount += 1
                maxNoSpeech = max(maxNoSpeech, segment.noSpeechProb)
                maxCompression = max(maxCompression, segment.compressionRatio)
                maxTemperature = max(maxTemperature, segment.temperature)

                // tokenLogProbs[i] is a dict {tokenId -> logprob} for the
                // i-th generated position. The chosen token's id is at
                // segment.tokens[i]; its logprob is the entry we want.
                let tokenIds = segment.tokens
                let tokenDicts = segment.tokenLogProbs
                let count = min(tokenIds.count, tokenDicts.count)
                for i in 0..<count {
                    if let lp = tokenDicts[i][tokenIds[i]] {
                        perTokenLogprobs.append(lp)
                    }
                }

                if let segWords = segment.words {
                    for w in segWords {
                        words.append(
                            WordTimingPayload(
                                word: w.word,
                                startMs: Int(w.start * 1000),
                                endMs: Int(w.end * 1000),
                                probability: w.probability))
                    }
                }
            }
        }

        let avg = logprobCount > 0 ? logprobSum / Float(logprobCount) : 0

        let minTokenLogprob = perTokenLogprobs.min() ?? 0
        let tokenLogprobStdev: Float = {
            guard perTokenLogprobs.count > 1 else { return 0 }
            let mean = perTokenLogprobs.reduce(0, +) / Float(perTokenLogprobs.count)
            let variance = perTokenLogprobs.map { ($0 - mean) * ($0 - mean) }
                .reduce(0, +) / Float(perTokenLogprobs.count)
            return sqrt(variance)
        }()

        return MergedResult(
            text: fullText.trimmingCharacters(in: .whitespacesAndNewlines),
            avgLogprob: avg, words: words,
            noSpeechProb: maxNoSpeech,
            compressionRatio: maxCompression,
            temperature: maxTemperature,
            minTokenLogprob: minTokenLogprob,
            tokenLogprobStdev: tokenLogprobStdev
        )
    }

    private struct Scores {
        let transcript: Float
        let likelihood: Float
        let acoustic: Float
        let overall: Float
        /// Set when a hard gate fires ("Couldn't hear you" / "Garbled").
        /// JS uses this to render a specific message instead of a numeric
        /// score breakdown.
        let earlyExitMessage: String?
        /// Levenshtein similarity between free-decode and constrained
        /// transcripts. 1.0 if dual-decode wasn't run (no penalty).
        let freeVsConstrainedSimilarity: Float
    }

    /// Normalize for text comparison. Switches from allowlist (only L*)
    /// to blocklist (strip punctuation + symbols + controls) so Indic
    /// vowel marks (categories Mn / Mc — essential for Telugu, Tamil,
    /// Bengali, Malayalam, Marathi, Gujarati, Punjabi spelling) survive.
    /// NFC-normalizes first so composed/decomposed accented forms compare
    /// equal across scripts.
    // Per-language number-word → digit map. Whisper transcribes spoken
    // numbers as digits ("90" not "novanta", "10" not "ten") regardless
    // of how the speaker said them, which made same-meaning utterances
    // mismatch on text comparison. Mapping the EXPECTED side's
    // number-words to digits before comparing closes the gap. We also
    // map digit→words isn't needed — heard side is already digits.
    //
    // Coverage: 0–20 explicitly, plus the round tens/hundreds/thousand.
    // Compound forms ("ventuno", "twenty-one") are out of scope; users
    // hitting them will see slightly lower per-word similarity but the
    // common round-number practice case is covered.
    private static let numberWordToDigit: [String: [String: String]] = [
        "en": [
            "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
            "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
            "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
            "fourteen": "14", "fifteen": "15", "sixteen": "16",
            "seventeen": "17", "eighteen": "18", "nineteen": "19",
            "twenty": "20", "thirty": "30", "forty": "40", "fifty": "50",
            "sixty": "60", "seventy": "70", "eighty": "80", "ninety": "90",
            "hundred": "100", "thousand": "1000",
        ],
        "es": [
            "cero": "0", "uno": "1", "una": "1", "dos": "2", "tres": "3",
            "cuatro": "4", "cinco": "5", "seis": "6", "siete": "7",
            "ocho": "8", "nueve": "9", "diez": "10", "once": "11",
            "doce": "12", "trece": "13", "catorce": "14", "quince": "15",
            "dieciséis": "16", "dieciseis": "16", "diecisiete": "17",
            "dieciocho": "18", "diecinueve": "19", "veinte": "20",
            "treinta": "30", "cuarenta": "40", "cincuenta": "50",
            "sesenta": "60", "setenta": "70", "ochenta": "80",
            "noventa": "90", "cien": "100", "ciento": "100", "mil": "1000",
        ],
        "fr": [
            "zéro": "0", "zero": "0", "un": "1", "une": "1", "deux": "2",
            "trois": "3", "quatre": "4", "cinq": "5", "six": "6", "sept": "7",
            "huit": "8", "neuf": "9", "dix": "10", "onze": "11", "douze": "12",
            "treize": "13", "quatorze": "14", "quinze": "15", "seize": "16",
            "vingt": "20", "trente": "30", "quarante": "40", "cinquante": "50",
            "soixante": "60", "cent": "100", "mille": "1000",
        ],
        "it": [
            "zero": "0", "uno": "1", "una": "1", "due": "2", "tre": "3",
            "quattro": "4", "cinque": "5", "sei": "6", "sette": "7",
            "otto": "8", "nove": "9", "dieci": "10", "undici": "11",
            "dodici": "12", "tredici": "13", "quattordici": "14",
            "quindici": "15", "sedici": "16", "diciassette": "17",
            "diciotto": "18", "diciannove": "19", "venti": "20",
            "trenta": "30", "quaranta": "40", "cinquanta": "50",
            "sessanta": "60", "settanta": "70", "ottanta": "80",
            "novanta": "90", "cento": "100", "mille": "1000",
        ],
        "de": [
            "null": "0", "eins": "1", "ein": "1", "eine": "1", "zwei": "2",
            "drei": "3", "vier": "4", "fünf": "5", "funf": "5", "sechs": "6",
            "sieben": "7", "acht": "8", "neun": "9", "zehn": "10", "elf": "11",
            "zwölf": "12", "zwolf": "12", "dreizehn": "13", "vierzehn": "14",
            "fünfzehn": "15", "funfzehn": "15", "sechzehn": "16",
            "siebzehn": "17", "achtzehn": "18", "neunzehn": "19",
            "zwanzig": "20", "dreißig": "30", "dreissig": "30",
            "vierzig": "40", "fünfzig": "50", "funfzig": "50",
            "sechzig": "60", "siebzig": "70", "achtzig": "80", "neunzig": "90",
            "hundert": "100", "tausend": "1000",
        ],
        "pt": [
            "zero": "0", "um": "1", "uma": "1", "dois": "2", "duas": "2",
            "três": "3", "tres": "3", "quatro": "4", "cinco": "5",
            "seis": "6", "sete": "7", "oito": "8", "nove": "9", "dez": "10",
            "onze": "11", "doze": "12", "treze": "13", "catorze": "14",
            "quatorze": "14", "quinze": "15", "dezesseis": "16",
            "dezasseis": "16", "dezessete": "17", "dezassete": "17",
            "dezoito": "18", "dezenove": "19", "dezanove": "19",
            "vinte": "20", "trinta": "30", "quarenta": "40", "cinquenta": "50",
            "cinquénta": "50", "sessenta": "60", "setenta": "70",
            "oitenta": "80", "noventa": "90", "cem": "100", "cento": "100",
            "mil": "1000",
        ],
    ]

    private func normalize(_ s: String, lang: String? = nil) -> String {
        let nfc = s.precomposedStringWithCanonicalMapping
        let lower = nfc.lowercased()

        var strip = CharacterSet.punctuationCharacters
        strip.formUnion(.symbols)
        strip.formUnion(.controlCharacters)
        strip.formUnion(.illegalCharacters)
        // Note: ZWJ/ZWNJ (format-category) are intentionally KEPT —
        // Persian and several Indic scripts use them as part of correct
        // spelling, and Whisper's output preserves them.

        let kept = lower.unicodeScalars.filter { !strip.contains($0) }
        let collapsed = String(String.UnicodeScalarView(kept))
            .replacingOccurrences(
                of: "\\s+", with: " ", options: .regularExpression)
        let trimmed = collapsed.trimmingCharacters(in: .whitespacesAndNewlines)

        // Word→digit substitution so "novanta" === "90" === "ninety" at
        // comparison time. Heard side is already in digit form
        // (Whisper's default), so this is mostly a one-way nudge on the
        // expected side — but we apply uniformly for safety.
        guard
            let lang = lang?.lowercased(),
            let dict = Self.numberWordToDigit[lang]
        else { return trimmed }
        if trimmed.isEmpty { return trimmed }
        let words = trimmed.split(separator: " ", omittingEmptySubsequences: true)
        let mapped: [String] = words.map { word -> String in
            let key = String(word)
            return dict[key] ?? key
        }
        return mapped.joined(separator: " ")
    }

    private func levenshteinSimilarity(_ a: String, _ b: String) -> Float {
        if a.isEmpty && b.isEmpty { return 1 }
        let aChars = Array(a)
        let bChars = Array(b)
        let n = aChars.count
        let m = bChars.count
        if n == 0 || m == 0 { return 0 }

        var prev = Array(0...m)
        var curr = Array(repeating: 0, count: m + 1)
        for i in 1...n {
            curr[0] = i
            for j in 1...m {
                let cost = (aChars[i - 1] == bChars[j - 1]) ? 0 : 1
                curr[j] = min(
                    prev[j] + 1,  // deletion
                    curr[j - 1] + 1,  // insertion
                    prev[j - 1] + cost  // substitution
                )
            }
            (prev, curr) = (curr, prev)
        }
        let dist = Float(prev[m])
        let maxLen = Float(max(n, m))
        return max(0, 1 - dist / maxLen)
    }

    /// Word-level Levenshtein similarity. Each whitespace-delimited
    /// token is treated as a single atomic unit, so a transcript that
    /// matches at the character level via accidental letter overlap
    /// (e.g. "si comes bien …" mispronounced as "sitcoms been …" still
    /// has 0.6 *character* similarity) drops to honest word-level
    /// similarity (~0.2). Used in tandem with `levenshteinSimilarity`
    /// (char-level): we take `min(charSim, wordSim)` so both signals
    /// must agree on "this is a good match" to award full credit.
    private func wordLevenshteinSimilarity(_ a: String, _ b: String) -> Float {
        let aWords = a.split(separator: " ", omittingEmptySubsequences: true)
            .map(String.init)
        let bWords = b.split(separator: " ", omittingEmptySubsequences: true)
            .map(String.init)
        if aWords.isEmpty && bWords.isEmpty { return 1 }
        if aWords.isEmpty || bWords.isEmpty { return 0 }
        let n = aWords.count
        let m = bWords.count
        var prev = Array(0...m).map(Float.init)
        var curr = Array(repeating: Float(0), count: m + 1)
        for i in 1...n {
            curr[0] = Float(i)
            for j in 1...m {
                if aWords[i - 1] == bWords[j - 1] {
                    curr[j] = prev[j - 1]
                } else {
                    curr[j] = 1 + min(prev[j], curr[j - 1], prev[j - 1])
                }
            }
            (prev, curr) = (curr, prev)
        }
        return max(0, 1 - prev[m] / Float(max(n, m)))
    }

    /// Whisper's per-word probabilities are calibrated very differently
    /// across languages because the training corpus is dominated by
    /// English/Spanish/French/etc. For low-resource languages the model
    /// is intrinsically less confident even on perfect speech (more BPE
    /// fragments per word, lower base posterior over the right answer),
    /// so a single hard threshold tuned on English makes Telugu/Tamil/
    /// Bengali score "30% no matter what". We split into two tiers and
    /// use a softer ramp for low-resource languages.
    ///
    /// Tier source: Whisper-paper word-error-rate clusters. Languages
    /// where the multilingual large model still does well even with the
    /// thinner training data get tier-1 treatment; the rest go to
    /// tier-2.
    private static let lowResourceLangs: Set<String> = [
        "te",  // Telugu
        "ta",  // Tamil
        "bn",  // Bengali
        "ml",  // Malayalam
        "mr",  // Marathi
        "gu",  // Gujarati
        "pa",  // Punjabi
        "ur",  // Urdu
        "fa",  // Persian / Farsi
        "kn",  // Kannada (not in our stack today, harmless)
        "si",  // Sinhala
        "ne",  // Nepali
        "or",  // Odia
        "as",  // Assamese
    ]

    private struct AcousticRamp {
        let avgZero: Float  // avgWordProb at which acoustic=0
        let avgOne: Float  // avgWordProb at which acoustic=1
        let minZero: Float
        let minOne: Float
        let textFloor: Float  // partial credit if transcript matches but acoustic is 0
    }

    // Ramp tuning targets the upper end of the score curve. Earlier
    // values (highRes avgOne=0.85, minOne=0.50) collapsed to acoustic=
    // 1.0 the moment Whisper's per-word probabilities crossed
    // "decent", so passable speech scored 100% and there was no
    // visible gap between "phrase understood, accent clearly off" and
    // "near-native". Pushing avgOne / minOne meaningfully higher and
    // weighting minWordProb more heavily (0.4 vs 0.3) makes a single
    // weak token visible in the score.
    private static let highResRamp = AcousticRamp(
        avgZero: 0.40, avgOne: 0.95,
        minZero: 0.20, minOne: 0.78,
        textFloor: 0.10
    )
    private static let lowResRamp = AcousticRamp(
        avgZero: 0.15, avgOne: 0.70,
        minZero: 0.05, minOne: 0.45,
        textFloor: 0.30  // more partial credit since acoustic is intrinsically lower
    )

    private func computeScores(
        merged: MergedResult, expected: String, language: String,
        freeText: String
    ) -> Scores {
        let baseLangNormHint = String(
            language.split(separator: "-").first ?? Substring(language)
        ).lowercased()
        let normTranscript = normalize(merged.text, lang: baseLangNormHint)
        let normExpected = normalize(expected, lang: baseLangNormHint)

        // ---------------------------------------------------------------
        // Hard gates — use Whisper's own quality signals before scoring.
        // ---------------------------------------------------------------
        // noSpeechProb is the model's posterior that the segment is not
        // speech. > 0.5 means the user effectively didn't talk — don't
        // confuse this with bad pronunciation.
        if merged.noSpeechProb > 0.5 {
            sttLog(
                "Whisper | gate: noSpeechProb",
                String(format: "%.2f", merged.noSpeechProb), "→ Couldn't hear you")
            return Scores(
                transcript: 0, likelihood: 0, acoustic: 0, overall: 0,
                earlyExitMessage:
                    "Couldn't hear you — try again with the mic closer.",
                freeVsConstrainedSimilarity: 1.0)
        }

        // ---------------------------------------------------------------
        // Text match. The constrained pass uses `prefixTokens`, so its
        // text matches expected almost by construction — that signal is
        // mostly noise. The free pass (no prefix, no prompt) is what
        // Whisper *honestly* heard. Take the min so prior rescue can't
        // inflate the score: a strong free match ratifies the constrained
        // match; a weak free match drags the transcript score down.
        // ---------------------------------------------------------------
        // Combine char-level and word-level similarity. Char-level is
        // forgiving of segmentation noise but lets accidental letter
        // overlap inflate the score on substantively-wrong words
        // ("si comes bien" mispronounced as "sitcoms been" still
        // shares enough characters to read 0.6 char-sim, even though
        // every word is wrong). Word-level reflects per-word
        // pronunciation honestly. We take `min` so both must agree
        // on "good match" before full credit is awarded.
        let combinedSim: (String, String) -> Float = { a, b in
            let charSim = self.levenshteinSimilarity(a, b)
            // CJK and other no-whitespace scripts — char-level IS
            // word-level (each grapheme is a meaningful unit), so
            // word-level Levenshtein on a single "word" produces a
            // useless 0/1 binary. Skip it.
            let aHasSpaces = a.contains(" ")
            let bHasSpaces = b.contains(" ")
            if !aHasSpaces && !bHasSpaces { return charSim }
            let wordSim = self.wordLevenshteinSimilarity(a, b)
            return min(charSim, wordSim)
        }
        let transcriptScoreConstrained: Float
        if normExpected.isEmpty {
            transcriptScoreConstrained = 0
        } else {
            transcriptScoreConstrained = combinedSim(normTranscript, normExpected)
        }
        let transcriptScoreFree: Float
        if !freeText.isEmpty && !normExpected.isEmpty {
            transcriptScoreFree = combinedSim(
                normalize(freeText, lang: baseLangNormHint), normExpected)
        } else if !normExpected.isEmpty {
            // Free decode is supposed to run on every transcribe (dual
            // decode is unconditional). Empty free text with a real
            // expected phrase = genuine failure: Whisper couldn't get
            // anything useful out of the audio without the prefix
            // crutch. Treat as zero similarity so the score floors
            // honestly. NEVER fall back to constrained-only — that
            // path silently inflates scores via the prior rescue we
            // were trying to detect.
            transcriptScoreFree = 0
        } else {
            // Truly empty expected (no phrase to score against) —
            // ignore free, defer to constrained.
            transcriptScoreFree = transcriptScoreConstrained
        }
        let transcriptScore = min(transcriptScoreConstrained, transcriptScoreFree)

        // ---------------------------------------------------------------
        // Acoustic score — per-word posterior with per-language ramps.
        // Falls back to logprob-based mapping if no word timings.
        // ---------------------------------------------------------------
        let probs = merged.words.map { $0.probability }
        let avgWordProb: Float =
            probs.isEmpty ? 0 : probs.reduce(0, +) / Float(probs.count)
        let minWordProb: Float = probs.min() ?? 0

        let baseLang = baseLangNormHint
        let ramp =
            Self.lowResourceLangs.contains(baseLang) ? Self.lowResRamp : Self.highResRamp

        var acousticScore: Float
        if merged.words.isEmpty {
            sttLog(
                "Whisper | no per-word timings; falling back to avgLogprob for",
                baseLang)
            acousticScore = max(0, min(1, (merged.avgLogprob + 1.5) / 1.5))
        } else {
            let avgAcoustic = max(
                0,
                min(
                    1,
                    (avgWordProb - ramp.avgZero) / max(0.001, ramp.avgOne - ramp.avgZero)))
            let minAcoustic = max(
                0,
                min(
                    1,
                    (minWordProb - ramp.minZero) / max(0.001, ramp.minOne - ramp.minZero)))
            // Weight min more heavily so a single weak word visibly
            // hurts the score — that's the "great pronunciation except
            // for one mangled word" case we want to reflect honestly.
            acousticScore = 0.6 * avgAcoustic + 0.4 * minAcoustic
        }

        // ---------------------------------------------------------------
        // Penalties.
        // ---------------------------------------------------------------
        // Per-token logprob spread: high stdev means some tokens were
        // confident, others weren't — an honest pronunciation problem.
        // Halve acoustic if stdev > 0.8 (empirical; calibrate later).
        if merged.tokenLogprobStdev > 0.8 {
            acousticScore *= 0.5
        }

        // Free-vs-expected divergence is now baked into `transcriptScore`
        // directly (via `min(constrained, free)` with combined char+word
        // similarity), so the acoustic-side penalty curve that used to
        // live here is removed — applying it on top would double-count
        // the same signal. We still expose `freeVsConstrainedSimilarity`
        // for the diagnostic chip and OSLog.
        let freeVsConstrained: Float = transcriptScoreFree

        // Decoder fallback: if temperature > 0, Whisper's greedy decode
        // failed and it sampled at higher temperature. Small penalty.
        if merged.temperature > 0 {
            acousticScore *= 0.8
        }

        // ---------------------------------------------------------------
        // Soft cap from compression ratio (gibberish detector).
        // > 2.4 → cap overall ≤ 0.4 to keep "Nailed it!" out of reach.
        // ---------------------------------------------------------------
        // Legacy logprob-based likelihood, exposed for telemetry/UI.
        let likelihoodScore = max(0, min(1, 1 + merged.avgLogprob))

        var overall: Float
        if normExpected.isEmpty {
            overall = acousticScore
        } else {
            overall = transcriptScore * (ramp.textFloor + (1 - ramp.textFloor) * acousticScore)
        }
        // Compression-ratio gate is calibrated for English / Latin-
        // script languages (Whisper's 2.4 default). Indic and Persian
        // BPE tokenizes a single phoneme into 2–4 sub-tokens, so even
        // clean speech in te/ta/bn/ml/mr/gu/pa/ur/fa/si/ne/or/as can
        // legitimately push compressionRatio past 2.4 — false-flagging
        // it as gibberish and capping a 100/100 attempt at 40%.
        // Loosen the threshold for low-resource langs.
        let isLowRes = Self.lowResourceLangs.contains(baseLang)
        let compressionThreshold: Float = isLowRes ? 3.5 : 2.4
        if merged.compressionRatio > compressionThreshold {
            overall = min(overall, 0.4)
            sttLog(
                "Whisper | gate: compressionRatio",
                String(format: "%.2f", merged.compressionRatio),
                "→ capped at 0.4 (threshold",
                String(format: "%.1f", compressionThreshold), ")")
        }

        return Scores(
            transcript: transcriptScore,
            likelihood: likelihoodScore,
            acoustic: acousticScore,
            overall: overall,
            earlyExitMessage: nil,
            freeVsConstrainedSimilarity: freeVsConstrained)
    }
}

// -----------------------------------------------------------------------------
// Tauri Plugin surface
// -----------------------------------------------------------------------------

final class STTPlugin: Plugin {
    private static let manager = WhisperManager.shared

    @objc public func prepare(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(PrepareArgs.self)
        Self.manager.prepare(model: args.model) { payload in
            invoke.resolve(payload)
        }
    }

    @objc public func startSession(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(StartSessionArgs.self)
        Self.manager.startSession(
            sessionId: args.sessionId,
            language: args.language,
            expectedText: args.expectedText
        ) { result in
            switch result {
            case .success(let payload):
                invoke.resolve(payload)
            case .failure(let error):
                invoke.reject(error.localizedDescription)
            }
        }
    }

    @objc public func stopSession(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SessionIdArgs.self)
        Self.manager.stopSession(sessionId: args.sessionId) { result in
            switch result {
            case .success(let payload):
                invoke.resolve(payload)
            case .failure(let error):
                invoke.reject(error.localizedDescription)
            }
        }
    }

    @objc public func cancelSession(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SessionIdArgs.self)
        Self.manager.cancelSession(sessionId: args.sessionId)
        invoke.resolve()
    }

    @objc public func isAvailable(_ invoke: Invoke) {
        invoke.resolve(Self.manager.isAvailable())
    }

    @objc public func getStatus(_ invoke: Invoke) {
        invoke.resolve(Self.manager.status())
    }

    @objc public func wipeModel(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(PrepareArgs.self)
        Self.manager.wipe(model: args.model)
        invoke.resolve(["wiped": true, "model": args.model ?? ""])
    }

    @objc public func installModel(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(PrepareArgs.self)
        Self.manager.installModel(
            model: args.model,
            progress: { [weak self] payload in
                // Fan progress out to JS as a plugin event. The pack
                // subscribes via addPluginListener("stt", "install_progress").
                guard let self else { return }
                do {
                    try self.trigger("install_progress", data: payload)
                } catch {
                    sttErr(
                        "Whisper | trigger install_progress failed:",
                        error.localizedDescription)
                }
            },
            completion: { result in
                switch result {
                case .success(let payload):
                    invoke.resolve(payload)
                case .failure(let error):
                    invoke.reject(error.localizedDescription)
                }
            }
        )
    }

    @objc public func validateModel(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(PrepareArgs.self)
        let r = Self.manager.validateInstall(model: args.model)
        invoke.resolve(
            ValidateModelPayload(
                model: r.model, valid: r.valid, problems: r.problems))
    }
}

@_cdecl("init_plugin_stt")
func init_plugin_stt() -> Plugin {
    sttLog("STT init_plugin_stt()")
    return STTPlugin()
}
