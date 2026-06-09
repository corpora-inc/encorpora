import AVFoundation
import Darwin  // malloc_zone_pressure_relief
import Foundation
import Tauri
import os.log
import whisper

#if canImport(UIKit)
    import UIKit
#endif

// -----------------------------------------------------------------------------
// 0.4.0 — runtime swapped from WhisperKit to whisper.cpp. Background:
// every WhisperKit large-v3 variant on argmax's HF repo crashes on
// iPadOS 26.4.x in one of two distinct Apple compiler bugs (compile-
// time error -14 or predict-time `MPSGraphTensorData initWithMTLBuffer`
// SIGABRT). whisper.cpp ships its own Metal compute shaders and does
// NOT route through MPSGraph — same Metal hardware, different code
// path that Apple's compiler regression doesn't touch. See
// memory/feedback_whisper_ipados26_mps_crash.md for the full failure
// matrix and the canonical Swift wrapper pattern (cribbed from
// `examples/whisper.swiftui/whisper.cpp.swift/LibWhisper.swift` in
// ggml-org/whisper.cpp).
//
// Wire shape on the JS side is preserved — the pack expects the same
// SttApi method signatures and TranscriptionPayload field shape, so
// pronunciation-coach 0.3.x continues to work without changes.
// Several scoring inputs that WhisperKit surfaces as first-class
// (noSpeechProb, compressionRatio, temperature, per-token logprobs)
// are not directly exposed by whisper.cpp's Swift surface — for Phase 1
// we feed sane defaults (mostly 0) so the existing scoring math doesn't
// fire false-positive gates.
// -----------------------------------------------------------------------------

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

/// Snapshot resident memory + estimated headroom for diagnostic logs.
/// Cheap (a few syscalls) — call at any boundary where we want to see
/// "what was the memory state when X happened?" without a debugger.
///
/// `os_proc_available_memory()` returns the bytes still available to
/// this app before iOS will jetsam it (iOS 13+; documented public API).
/// `mach_task_basic_info` gives the current resident size.
private func sttMemSnapshot(_ tag: String) {
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size / MemoryLayout<integer_t>.size)
    let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) { ptr in
        ptr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
            task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
    }
    let residentMB: String
    if kerr == KERN_SUCCESS {
        residentMB = String(format: "%.0f", Double(info.resident_size) / 1_048_576.0)
    } else {
        residentMB = "?"
    }
    let availableMB: String
    if #available(iOS 13.0, *) {
        availableMB = String(format: "%.0f", Double(os_proc_available_memory()) / 1_048_576.0)
    } else {
        availableMB = "?"
    }
    sttLog(
        "Whisper | mem [\(tag)] resident=\(residentMB)MB available=\(availableMB)MB")
}

// -----------------------------------------------------------------------------
// Args / Results
// -----------------------------------------------------------------------------
final class PrepareArgs: Decodable {
    let model: String?
    /// Optional override of the source URL. Used by `installModel`
    /// for models we host ourselves (community Indic fine-tunes,
    /// self-quantized variants ggerganov doesn't publish, etc.).
    /// When nil, the install path falls back to the hardcoded
    /// `huggingface.co/ggerganov/whisper.cpp/resolve/main/` base.
    /// `prepare` ignores this field — it only reads `model`.
    let downloadUrl: String?
    private enum CodingKeys: String, CodingKey {
        case model, downloadUrl
        case download_url
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        model = try c.decodeIfPresent(String.self, forKey: .model)
        let urlCamel = try c.decodeIfPresent(String.self, forKey: .downloadUrl)
        let urlSnake = try c.decodeIfPresent(String.self, forKey: .download_url)
        downloadUrl = urlCamel ?? urlSnake
    }
}

/// Per-call overrides on top of `whisper_full_default_params`. Every
/// field is optional; a missing field means "use the library default."
/// Pack sends this on startSession so we can A/B different decoder
/// settings per language without rebuilding the plugin.
///
/// Field names match `whisper_full_params` in whisper.h. There is
/// deliberately no `compression_ratio_thold` here — whisper.cpp's
/// `entropy_thold` is its compression-ratio-style filter (per the
/// upstream comment at whisper.h:547).
struct WhisperParamsArg: Decodable {
    let temperature: Float?
    let temperature_inc: Float?
    let entropy_thold: Float?
    let logprob_thold: Float?
    let no_speech_thold: Float?
    let suppress_blank: Bool?
    let suppress_nst: Bool?
    let n_threads: Int32?
    /// Initial-prompt primer for the decoder. Whisper prepends up to
    /// ~224 tokens of this before generating, biasing output toward
    /// the prompt's script and vocabulary. Empty = no priming.
    let initial_prompt: String?
}

/// Per-call scoring overrides applied on top of the native acoustic
/// ramp picked by `pickAcousticRamp(modelName, baseLang)` and the
/// compression-ratio threshold. Every field optional; a nil field
/// means "use the native default for this slot." Mirrors the Rust
/// `ScoringParams` and the JS `ScoringParams` in
/// `packs/pronunciation-coach/src/scoringTuning.ts`.
struct ScoringParamsArg: Decodable {
    let avgZero: Float?
    let avgOne: Float?
    let minZero: Float?
    let minOne: Float?
    let textFloor: Float?
    let compressionThreshold: Float?
}

final class StartSessionArgs: Decodable {
    let sessionId: String
    let language: String
    let expectedText: String
    let whisperParams: WhisperParamsArg?
    let scoringParams: ScoringParamsArg?

    private enum CodingKeys: String, CodingKey {
        case sessionId, language, expectedText, whisperParams, scoringParams
        case session_id, expected_text, whisper_params, scoring_params
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
        let paramsCamel = try c.decodeIfPresent(WhisperParamsArg.self, forKey: .whisperParams)
        let paramsSnake = try c.decodeIfPresent(WhisperParamsArg.self, forKey: .whisper_params)
        whisperParams = paramsCamel ?? paramsSnake
        let scoringCamel = try c.decodeIfPresent(ScoringParamsArg.self, forKey: .scoringParams)
        let scoringSnake = try c.decodeIfPresent(ScoringParamsArg.self, forKey: .scoring_params)
        scoringParams = scoringCamel ?? scoringSnake
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
    let language: String
    let whisperLanguage: String
    let durationMs: Int
    let overallScore: Float
    let transcriptScore: Float
    let likelihoodScore: Float
    let acousticScore: Float
    let avgLogprob: Float
    let noSpeechProb: Float
    let compressionRatio: Float
    let temperature: Float
    let minTokenLogprob: Float
    let tokenLogprobStdev: Float
    let freeVsConstrainedSimilarity: Float
    let freeText: String
    let words: [WordTimingPayload]
}

struct PreparePayload: Encodable {
    let ready: Bool
    let model: String
    let message: String?
    let code: String?
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
    let availableMemoryMB: Int?
    let physicalMemoryMB: Int?
    let priorInitCrash: String?
}

struct InstallProgressPayload: Encodable {
    let model: String
    let phase: String  // downloading | verifying | verified | failed
    let fraction: Double?
    let completed: Int64?
    let total: Int64?
    let error: String?
    let code: String?
}

struct AudioLevelPayload: Encodable {
    let rms: Float
    let t: Int
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

struct InstalledModelPayload: Encodable {
    let model: String
    let valid: Bool
    let problems: [String]
    let sizeBytes: Int64
    let isLoaded: Bool
}

struct ListInstalledPayload: Encodable {
    let models: [InstalledModelPayload]
}

final class ListInstalledArgs: Decodable {
    let models: [String]?
    private enum CodingKeys: String, CodingKey { case models }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        models = try c.decodeIfPresent([String].self, forKey: .models)
    }
}

// -----------------------------------------------------------------------------
// Structured error codes — surfaced to JS as the prefix of `error.message`,
// formatted as `"CODE: human-readable description"`. JS dispatches on code.
// -----------------------------------------------------------------------------
enum SttErrorCode: String {
    case modelNotInstalled = "MODEL_NOT_INSTALLED"
    case modelNotLoaded = "MODEL_NOT_LOADED"
    case network = "NETWORK"
    case loadFailed = "LOAD_FAILED"
    case ioFailed = "IO_FAILED"
    case busy = "BUSY"
    case cancelled = "CANCELLED"
    case micPermissionDenied = "MIC_PERMISSION_DENIED"
    case noActiveSession = "NO_ACTIVE_SESSION"
    case audioFailed = "AUDIO_FAILED"
    /// `prepare()` ran the unload+pressure-relief sequence to free the
    /// previous model's memory but the OS still doesn't have enough
    /// headroom to safely allocate the requested model's weights. The
    /// previous model has already been dropped at this point, so the
    /// pack should route the user to "restart the app and try again"
    /// rather than retry in-process. This is the only structured code
    /// the user can recover from by relaunching Corpán.
    case insufficientMemory = "INSUFFICIENT_MEMORY"
    case unknown = "UNKNOWN"
}

@inline(__always) private func sttRejectMessage(
    _ code: SttErrorCode, _ description: String
) -> String {
    return "\(code.rawValue): \(description)"
}

struct SttFailure: Error {
    let code: SttErrorCode
    let description: String
}

/// Classify a download/load Error from URLSession or whisper.cpp init
/// into our structured code. URLSession errors land in NSURLErrorDomain
/// with a meaningful code; everything else is treated as LOAD_FAILED.
private func classifyLoadError(_ error: Error) -> SttErrorCode {
    let nsErr = error as NSError
    if nsErr.domain == NSURLErrorDomain { return .network }
    let desc = nsErr.localizedDescription.lowercased()
    if desc.contains("network") || desc.contains("offline") || desc.contains("internet")
        || desc.contains("timed out") || desc.contains("timeout")
    {
        return .network
    }
    if desc.contains("no such file") || desc.contains("not found") {
        return .modelNotInstalled
    }
    return .loadFailed
}

private let ggmlFileMagic: UInt32 = 0x67676d6c
private let minPlausibleModelBytes: Int64 = 1_000_000
private let modelProbeBytes = 4096

private func sttFileSizeBytes(_ url: URL) -> Int64 {
    let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
    return Int64((attrs?[.size] as? NSNumber)?.int64Value ?? 0)
}

private func sttPosixError(_ operation: String, _ path: String) -> NSError {
    return NSError(
        domain: NSPOSIXErrorDomain,
        code: Int(errno),
        userInfo: [
            NSLocalizedDescriptionKey:
                "\(operation) failed for \(path): \(String(cString: strerror(errno)))"
        ])
}

/// Best-effort durability barrier after URLSession moves a multi-GB model
/// into place. APFS rename semantics are already strong, but fsync + readback
/// removes two avoidable sources of "download finished, native init touched it
/// immediately" risk on first install.
private func syncModelFileToDisk(_ url: URL) throws {
    let fd = url.path.withCString { pathPtr in Darwin.open(pathPtr, O_RDONLY) }
    if fd < 0 { throw sttPosixError("open", url.path) }
    defer { Darwin.close(fd) }
    if Darwin.fsync(fd) != 0 { throw sttPosixError("fsync", url.path) }

    // Directory fsync is not available on every iOS filesystem view. Treat it
    // as a bonus barrier, not an install failure.
    let parent = url.deletingLastPathComponent()
    let dirFd = parent.path.withCString { pathPtr in Darwin.open(pathPtr, O_RDONLY) }
    if dirFd >= 0 {
        _ = Darwin.fsync(dirFd)
        Darwin.close(dirFd)
    }
}

/// Cheap model-file sanity check before native whisper.cpp sees the file.
/// Reads only the first and last 4 KiB: enough to reject HTML error pages,
/// empty/truncated artifacts, unreadable files, and storage-layer readback
/// failures without buffering a giant model in memory.
private func validateGgmlModelFile(_ url: URL, expectedBytes: Int64? = nil) -> [String] {
    let fm = FileManager.default
    guard fm.fileExists(atPath: url.path) else { return ["<model file missing>"] }
    guard fm.isReadableFile(atPath: url.path) else { return ["<model file unreadable>"] }

    let size = sttFileSizeBytes(url)
    if size < minPlausibleModelBytes {
        return ["<model file too small: \(size) bytes>"]
    }
    if let expectedBytes, expectedBytes > 0, size != expectedBytes {
        return ["<model file size mismatch: got \(size) of \(expectedBytes) bytes>"]
    }

    do {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        guard let head = try handle.read(upToCount: modelProbeBytes),
            head.count >= 4
        else {
            return ["<model file header unreadable>"]
        }
        let b = Array(head.prefix(4))
        let magic =
            UInt32(b[0])
            | (UInt32(b[1]) << 8)
            | (UInt32(b[2]) << 16)
            | (UInt32(b[3]) << 24)
        if magic != ggmlFileMagic {
            return [
                String(
                    format: "<bad ggml magic: 0x%08x>",
                    Int(magic))
            ]
        }

        if size > Int64(modelProbeBytes) {
            try handle.seek(toOffset: UInt64(max(0, size - Int64(modelProbeBytes))))
            guard let tail = try handle.read(upToCount: modelProbeBytes),
                !tail.isEmpty
            else {
                return ["<model file tail unreadable>"]
            }
        }
    } catch {
        return ["<model file readback failed: \(error.localizedDescription)>"]
    }
    return []
}

// -----------------------------------------------------------------------------
// WhisperCppContext — Swift actor wrapping the whisper.cpp C API.
//
// Pattern cribbed from `examples/whisper.swiftui/whisper.cpp.swift/LibWhisper.swift`
// in ggml-org/whisper.cpp. whisper.cpp's C contract: don't access a
// single context from more than one thread concurrently. The actor
// gives us that for free under Swift concurrency.
// -----------------------------------------------------------------------------
actor WhisperCppContext {
    private let context: OpaquePointer
    let modelPath: String

    private init(context: OpaquePointer, modelPath: String) {
        self.context = context
        self.modelPath = modelPath
    }

    deinit {
        whisper_free(context)
    }

    /// Load a `ggml-*.bin` model from disk. Returns nil if whisper.cpp
    /// init fails (corrupt file, unsupported format, OOM, etc.).
    static func load(path: String) -> WhisperCppContext? {
        var params = whisper_context_default_params()
        #if targetEnvironment(simulator)
            params.use_gpu = false
        #else
            // Metal compute is the whole point of choosing whisper.cpp over
            // WhisperKit on this OS. flash_attn is enabled for Metal in the
            // upstream LibWhisper.swift template; whisper.cpp falls back
            // gracefully if a model doesn't support it.
            params.use_gpu = true
            params.flash_attn = true
        #endif
        guard let ctx = whisper_init_from_file_with_params(path, params) else {
            sttErr("Whisper | whisper_init_from_file_with_params returned nil for", path)
            return nil
        }
        return WhisperCppContext(context: ctx, modelPath: path)
    }

    /// Single-word entry assembled from one or more BPE tokens. Mirrors
    /// the wire shape of `WordTimingPayload` (we use the same struct on
    /// the JS side via `mergeResults`).
    struct WordEntry {
        let word: String
        let startMs: Int
        let endMs: Int
        let probability: Float  // mean of token `p` across the word
    }

    struct SegmentInfo {
        let text: String
        /// Average per-token logprob (chosen-token plog), summarized
        /// across this segment. Approximates WhisperKit's `avgLogprob`.
        let avgLogprob: Float
        /// Per-token chosen-token logprobs across the segment. Used by
        /// scoring's stdev / minTokenLogprob calculations.
        let perTokenLogprobs: [Float]
        /// Word-level data assembled from token grouping (only populated
        /// when `params.token_timestamps = true`). Drives the acoustic
        /// score's per-word probability ramp.
        let words: [WordEntry]
        /// Whisper's posterior that this segment contains no speech.
        /// > 0.5 → user effectively didn't talk; scoring's hard gate
        /// returns "Couldn't hear you".
        let noSpeechProb: Float
    }

    struct TranscribeOutput {
        let text: String
        let segments: [SegmentInfo]
    }

    /// Run whisper_full() over the supplied 16 kHz f32 mono samples in
    /// the requested language. Returns concatenated text + per-segment
    /// stats. Returns nil on whisper_full failure.
    ///
    /// `overrides` is the optional bag of per-call whisper_full_params
    /// fields sent by the pack via `startSession.whisperParams`. Each
    /// non-nil field is applied AFTER our own defaults below, so a
    /// caller can e.g. set `temperature_inc = 0` to disable whisper.cpp's
    /// internal temperature-fallback loop for low-resource languages.
    func transcribe(
        samples: [Float], language: String, overrides: WhisperParamsArg? = nil
    ) -> TranscribeOutput? {
        // Two free cores keeps the UI thread responsive on iPad while
        // whisper.cpp pegs the rest. Same heuristic as upstream
        // LibWhisper.swift.
        let nThreads = max(1, min(8, ProcessInfo.processInfo.processorCount - 2))

        var params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY)
        params.print_progress = false
        params.print_realtime = false
        params.print_timestamps = false
        params.print_special = false
        params.translate = false
        params.detect_language = false
        params.no_context = true
        params.single_segment = false
        params.suppress_blank = true
        params.n_threads = Int32(nThreads)
        // Enable token-level timestamps so `whisper_token_data.t0/t1`
        // are populated. Without this they're zero and we can't compute
        // word-level start/end times for the WordTimingPayload that
        // computeScores() reads to produce the per-word acoustic ramp.
        params.token_timestamps = true

        // Pack-side overrides. Applied last so they win over the
        // defaults above. nil fields fall through unchanged.
        if let o = overrides {
            if let v = o.temperature { params.temperature = v }
            if let v = o.temperature_inc { params.temperature_inc = v }
            if let v = o.entropy_thold { params.entropy_thold = v }
            if let v = o.logprob_thold { params.logprob_thold = v }
            if let v = o.no_speech_thold { params.no_speech_thold = v }
            if let v = o.suppress_blank { params.suppress_blank = v }
            if let v = o.suppress_nst { params.suppress_nst = v }
            if let v = o.n_threads, v > 0 { params.n_threads = v }
        }
        let promptStr = overrides?.initial_prompt ?? ""
        sttLog(
            "Whisper | params lang=\(language) "
                + "temp=\(params.temperature) "
                + "temp_inc=\(params.temperature_inc) "
                + "entropy=\(params.entropy_thold) "
                + "logprob=\(params.logprob_thold) "
                + "no_speech=\(params.no_speech_thold) "
                + "suppress_blank=\(params.suppress_blank) "
                + "suppress_nst=\(params.suppress_nst) "
                + "n_threads=\(params.n_threads) "
                + "initial_prompt=\(promptStr.isEmpty ? "(none)" : "\"\(promptStr.prefix(60))\(promptStr.count > 60 ? "…" : "")\"")")

        // C string lifetime: both `params.language` and
        // `params.initial_prompt` are `const char *` borrowed by
        // whisper_full() for the duration of the call. Nest two
        // `withCString` blocks so Swift keeps both strings alive
        // until whisper_full returns. The empty-prompt branch
        // leaves `params.initial_prompt` as its default (nil) — a
        // NULL pointer here disables priming entirely.
        return language.withCString { langPtr in
            params.language = langPtr

            let runRet: Int32
            if !promptStr.isEmpty {
                runRet = promptStr.withCString { promptPtr in
                    params.initial_prompt = promptPtr
                    return samples.withUnsafeBufferPointer { buf in
                        whisper_full(context, params, buf.baseAddress, Int32(buf.count))
                    }
                }
            } else {
                runRet = samples.withUnsafeBufferPointer { buf in
                    whisper_full(context, params, buf.baseAddress, Int32(buf.count))
                }
            }
            guard runRet == 0 else {
                sttErr(
                    "Whisper | whisper_full failed:",
                    "ret=\(runRet) lang=\(language) samples=\(samples.count)")
                return nil
            }

            let nSegments = whisper_full_n_segments(context)
            var fullText = ""
            var segments: [SegmentInfo] = []
            for i in 0..<nSegments {
                guard let cText = whisper_full_get_segment_text(context, i) else { continue }
                let text = String(cString: cText)
                fullText += text
                let nTokens = whisper_full_n_tokens(context, i)
                var logprobs: [Float] = []
                logprobs.reserveCapacity(Int(nTokens))
                var sumLogprob: Float = 0

                // Word grouping. Whisper's BPE emits tokens with a
                // leading space at word boundaries (e.g. " hola" then
                // " mundo"); subword continuations have no leading
                // space (e.g. "ola" continuing "h"). We accumulate
                // tokens into a current-word buffer and flush on the
                // next leading-space token. Special tokens (anything
                // that looks like `<|...|>`) are skipped.
                var words: [WordEntry] = []
                var curText = ""
                var curStart: Int64 = 0
                var curEnd: Int64 = 0
                var curProbs: [Float] = []
                let flushWord: () -> Void = {
                    let trimmed = curText.trimmingCharacters(in: .whitespaces)
                    if trimmed.isEmpty { return }
                    // Skip pure-punctuation "words" (e.g. ".", "?", "!",
                    // "¿"). Whisper-tiny tokenizes a trailing period
                    // as a standalone leading-space token (" .") which
                    // my grouping treats as a new word — but periods
                    // have uniformly low model confidence and dragging
                    // them into per-word probability stats torpedoes
                    // the acoustic min-word penalty even on perfectly
                    // pronounced phrases. Punctuation has no
                    // pronunciation meaning anyway; transcript scoring
                    // strips it via `normalize()`.
                    let isPureSymbol = trimmed.unicodeScalars.allSatisfy {
                        CharacterSet.punctuationCharacters.contains($0)
                            || CharacterSet.symbols.contains($0)
                    }
                    if isPureSymbol { return }
                    let avgP =
                        curProbs.isEmpty
                        ? Float(0)
                        : curProbs.reduce(0, +) / Float(curProbs.count)
                    // Whisper time units are 10 ms (1 = 10 ms = 1
                    // mel-frame hop). Multiply by 10 to get
                    // milliseconds for the JS-side WordTimingPayload.
                    words.append(
                        WordEntry(
                            word: trimmed,
                            startMs: Int(curStart * 10),
                            endMs: Int(curEnd * 10),
                            probability: avgP))
                    // DIAGNOSTIC: show every word entry going into the
                    // probability calc, so we can see what whisper-tiny
                    // is producing and tune accordingly.
                    sttLog(
                        "Whisper | word: [\(trimmed)] probs=\(curProbs.map { String(format: "%.2f", $0) }.joined(separator: ",")) avg=\(String(format: "%.2f", avgP))")
                }

                for j in 0..<nTokens {
                    let td = whisper_full_get_token_data(context, i, j)
                    let cTokText = whisper_full_get_token_text(context, i, j)
                    let tokText = cTokText.map { String(cString: $0) } ?? ""

                    // Skip control tokens FIRST — before contributing
                    // to either word grouping OR per-token logprob
                    // stats. Whisper.cpp emits these in two formats:
                    //   `<|startoftranscript|>`, `<|en|>`,
                    //   `<|notimestamps|>`, `<|0.00|>`
                    // and (when `params.token_timestamps = true`)
                    //   `[_BEG_]`, `[_END_]`, `[_TT_50]`, `[_PT_*]`
                    // Their probabilities are uniformly low (0.1–0.4
                    // range) which poisons `tokenLogprobStdev`, then
                    // trips the > 0.8 penalty in computeScores and
                    // halves the acoustic score. They also concatenate
                    // into the user's word (e.g. emitting
                    // `Poco.[_TT_50]` as a single 4-token word) if
                    // we let them into the grouping loop.
                    if tokText.hasPrefix("<|") { continue }
                    if tokText.hasPrefix("[_") && tokText.hasSuffix("]") { continue }
                    if tokText.isEmpty { continue }

                    // Per-token logprobs for the per-word stats —
                    // collected only for real text tokens. Skip pure-
                    // punctuation tokens too: their logprobs sit in a
                    // wildly different range than word tokens, which
                    // inflates `tokenLogprobStdev` and falsely triggers
                    // the `acoustic *= 0.5` penalty downstream even on
                    // clean pronunciation. Per-word probability rollup
                    // already skips these at flush time (see
                    // `isPureSymbol` check); extending the same logic
                    // here keeps the token-level stats consistent.
                    let isPunctOnlyToken = !tokText.isEmpty
                        && tokText.unicodeScalars.allSatisfy {
                            CharacterSet.punctuationCharacters.contains($0)
                                || CharacterSet.symbols.contains($0)
                                || CharacterSet.whitespaces.contains($0)
                        }
                    if !isPunctOnlyToken {
                        logprobs.append(td.plog)
                        sumLogprob += td.plog
                    }

                    // New word boundary: token starts with a space
                    // AND we already have an in-progress word.
                    let startsNewWord = tokText.first == " "
                    if startsNewWord && !curText.isEmpty {
                        flushWord()
                        curText = ""
                        curProbs = []
                    }

                    if curText.isEmpty {
                        curStart = td.t0
                    }
                    curEnd = td.t1
                    curText += tokText
                    // Only count letter/digit tokens toward the
                    // per-word probability average. Whisper often
                    // appends a punctuation token (".", "!", "?")
                    // onto the previous word with widely-varying
                    // prob; that prob has no pronunciation meaning
                    // and was dragging per-word avg down on clean
                    // speech (e.g. live-observed "gusto!" =
                    // ["gusto" 0.97, "!" 0.38] gave avg 0.68). The
                    // text still gets appended so the displayed
                    // word keeps its punctuation; only the score
                    // input changes.
                    if !isPunctOnlyToken {
                        curProbs.append(td.p)
                    }
                }
                // Flush the final word in this segment.
                if !curText.isEmpty { flushWord() }

                let avg: Float = nTokens > 0 ? sumLogprob / Float(nTokens) : 0
                let noSpeech = whisper_full_get_segment_no_speech_prob(context, i)
                segments.append(
                    SegmentInfo(
                        text: text,
                        avgLogprob: avg,
                        perTokenLogprobs: logprobs,
                        words: words,
                        noSpeechProb: noSpeech))
            }
            let trimmed = fullText.trimmingCharacters(in: .whitespacesAndNewlines)
            return TranscribeOutput(text: trimmed, segments: segments)
        }
    }
}

// -----------------------------------------------------------------------------
// URLSession download delegate — single-file install with progress
// callbacks shaped the same as WhisperKit's old multi-file Progress so
// the pack-side install UI doesn't change.
// -----------------------------------------------------------------------------
private final class WhisperDownloadDelegate: NSObject, URLSessionDownloadDelegate {
    private let modelName: String
    private let dest: URL
    private let onProgress: (InstallProgressPayload) -> Void
    private let onComplete: (Result<URL, Error>) -> Void
    private var lastLoggedFraction: Double = -1

    init(
        modelName: String, dest: URL,
        onProgress: @escaping (InstallProgressPayload) -> Void,
        onComplete: @escaping (Result<URL, Error>) -> Void
    ) {
        self.modelName = modelName
        self.dest = dest
        self.onProgress = onProgress
        self.onComplete = onComplete
    }

    func urlSession(
        _ session: URLSession, downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64
    ) {
        let total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : 0
        let fraction: Double =
            total > 0 ? Double(totalBytesWritten) / Double(total) : 0
        // Throttle log lines to every 10% to match the WhisperKit-era
        // cadence — pack progress UI gets every event regardless.
        if fraction - lastLoggedFraction >= 0.1 || fraction >= 1.0 {
            sttLog(
                "Whisper | install progress", modelName,
                "bytes:", totalBytesWritten, "/", total,
                "fraction:", String(format: "%.3f", fraction))
            lastLoggedFraction = fraction
        }
        onProgress(
            InstallProgressPayload(
                model: modelName,
                phase: "downloading",
                fraction: fraction,
                completed: totalBytesWritten,
                total: total,
                error: nil,
                code: nil))
    }

    func urlSession(
        _ session: URLSession, downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        // Move from the URLSession temp location to our final dest. iOS
        // will delete the temp file on return from this method, so we
        // MUST move synchronously here.
        let fm = FileManager.default
        do {
            try? fm.removeItem(at: dest)
            try fm.createDirectory(
                at: dest.deletingLastPathComponent(),
                withIntermediateDirectories: true)
            try fm.moveItem(at: location, to: dest)
            // Completeness gate (parity with the Android plugin). When the
            // server advertised a Content-Length, a file shorter than that
            // is a TRUNCATED download — a dropped connection or a CDN closing
            // the stream early. URLSession usually reports that via
            // didCompleteWithError, but in the case where it still calls us a
            // short ggml file would pass the magic-byte check and then SIGSEGV
            // inside whisper model load when native code reads tensor data
            // past EOF. Refuse it here so the install reports a clean,
            // retryable failure instead.
            let expected = downloadTask.response?.expectedContentLength ?? -1
            if expected > 0 {
                let attrs = try? fm.attributesOfItem(atPath: dest.path)
                let actual = (attrs?[.size] as? NSNumber)?.int64Value ?? -1
                if actual >= 0 && actual < expected {
                    try? fm.removeItem(at: dest)
                    onComplete(
                        .failure(
                            NSError(
                                domain: "stt", code: -1001,
                                userInfo: [
                                    NSLocalizedDescriptionKey:
                                        "truncated download: got \(actual) of \(expected) bytes"
                                ])))
                    return
                }
            }
            try syncModelFileToDisk(dest)
            let problems = validateGgmlModelFile(
                dest,
                expectedBytes: expected > 0 ? expected : nil)
            if !problems.isEmpty {
                try? fm.removeItem(at: dest)
                onComplete(
                    .failure(
                        NSError(
                            domain: "stt", code: -1002,
                            userInfo: [
                                NSLocalizedDescriptionKey:
                                    "downloaded model failed file verification: \(problems.joined(separator: ", "))"
                            ])))
                return
            }
            sttLog("Whisper | download finished + file barrier passed:", dest.path)
            onComplete(.success(dest))
        } catch {
            try? fm.removeItem(at: dest)
            onComplete(.failure(error))
        }
    }

    func urlSession(
        _ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?
    ) {
        if let error {
            onComplete(.failure(error))
        }
        // Success path is handled in didFinishDownloadingTo above; this
        // callback fires after that for a successful download but the
        // completion has already been delivered.
        session.invalidateAndCancel()
    }
}

// -----------------------------------------------------------------------------
// WhisperManager — owns the loaded context, install / load orchestration,
// audio capture, transcribe pipeline, and scoring.
// -----------------------------------------------------------------------------

private final class WhisperManager {
    static let shared = WhisperManager()

    private let queue = DispatchQueue(label: "com.corpora.stt.manager")
    private var ctx: WhisperCppContext?
    private var loadedModel: String?

    /// Tail of the prepare() chain. Every prepare() call appends to this
    /// chain so loads happen one at a time — preventing two prepare()
    /// calls from spawning concurrent allocations and stacking model
    /// memory. Each new prepare awaits this Task before doing any work,
    /// then assigns itself as the new tail.
    private var prepareChain: Task<Void, Never> = Task {}

    /// True while a load is actively running. Used purely for log
    /// observability so we can see when a new prepare queues behind a
    /// running one.
    private var loadInFlightFor: String?

    /// Per-process post-install cooling window. The file is already moved,
    /// fsynced, and header/tail-probed before install resolves; this just
    /// avoids immediately asking ggml/Metal to map a fresh multi-GB artifact
    /// in the same allocator pressure window as the download finalization.
    private var freshInstallReadyAt: [String: Date] = [:]

    /// One-shot native-init crash breadcrumb captured from the previous
    /// process. `status()` hands it to JS analytics once, then clears it.
    private var pendingInitCrash: String?

    // Audio capture
    private var audioEngine: AVAudioEngine?
    private var converter: AVAudioConverter?
    private var converterOutputFormat: AVAudioFormat?
    private var capturedSamples: [Float] = []
    private var activeSessionId: String?
    private var activeLanguage: String = "en"
    private var activeExpected: String = ""
    /// Per-call overrides for `whisper_full_params`, sent by the pack
    /// on `startSession`. nil here = no overrides for this session.
    private var activeWhisperParams: WhisperParamsArg?
    /// Per-call scoring overrides (acoustic ramp + textFloor +
    /// compression threshold). nil = use the ramp `pickAcousticRamp`
    /// returns and the 2.4/3.5 compression threshold unchanged.
    private var activeScoringParams: ScoringParamsArg?
    private var sessionStartedAt: Date?
    private var isRecording = false

    /// Called from `handleInput` while a session is recording, ~11 Hz,
    /// with the RMS of the most recent converted chunk + a millisecond
    /// offset from `sessionStartedAt`. The plugin sets this once and
    /// uses it to forward `audio_level` events to the WebView.
    var audioLevelEmitter: ((Float, Int) -> Void)?

    /// Default fallback model when the pack doesn't pass one. Phase 1
    /// proof-of-concept ships only `ggml-tiny.bin`, so the default is
    /// the only entry. Phase 2 replaces this with the real Small.
    private static let defaultModel = "ggml-tiny.bin"
    private static let targetSampleRate: Double = 16000.0

    private init() {
        pendingInitCrash = nil
        pendingInitCrash = reportPriorInitCrash()
    }

    // ---------------------------------------------------------------------
    // Model storage layout (whisper.cpp era)
    //
    // Each model is a single `ggml-*.bin` file. No multi-file directory,
    // no .mlmodelc tree, no separate weights/config split. The pack
    // passes the filename (e.g. "ggml-tiny.bin") as the model id and we
    // resolve it under our own private dir — distinct from the old
    // WhisperKit `huggingface/models/argmaxinc/whisperkit-coreml/` tree
    // so a future cleanup pass can wipe the orphaned WhisperKit installs
    // by deleting that whole subtree.
    // ---------------------------------------------------------------------
    private func documentsDir() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    private func modelFile(_ name: String) -> URL {
        return documentsDir()
            .appendingPathComponent("whisper-cpp")
            .appendingPathComponent("models")
            .appendingPathComponent(name)
    }

    /// Marker file that records "this variant has been successfully
    /// installed at least once on this device". We control its lifecycle:
    /// installed → write marker; wipe → remove marker. Source of truth
    /// for `is X installed?` — the `validateModel` heuristic also writes
    /// the marker as a fast-path cache.
    private func installMarkerURL(_ name: String) -> URL {
        return documentsDir()
            .appendingPathComponent(".pronunciation-coach")
            .appendingPathComponent("installed")
            .appendingPathComponent("\(name).marker")
    }

    private func initBreadcrumbURL() -> URL {
        return documentsDir()
            .appendingPathComponent(".pronunciation-coach")
            .appendingPathComponent("installed")
            .appendingPathComponent("stt-init-inflight.json")
    }

    private func writeInstallMarker(_ name: String) {
        let url = installMarkerURL(name)
        let fm = FileManager.default
        let dir = url.deletingLastPathComponent()
        do {
            try fm.createDirectory(
                at: dir, withIntermediateDirectories: true)
            let payload = """
                {"installed":true,"model":"\(name)","verifiedBy":"ggml-probe-v2","writtenAt":"\(Date())"}
                """
            try payload.write(to: url, atomically: true, encoding: .utf8)
            sttLog("Whisper | wrote install marker:", url.path)
        } catch {
            sttErr(
                "Whisper | failed to write install marker for", name,
                "—", error.localizedDescription)
        }
    }

    private func removeInstallMarker(_ name: String) {
        let url = installMarkerURL(name)
        try? FileManager.default.removeItem(at: url)
    }

    private func installMarkerExists(_ name: String) -> Bool {
        return FileManager.default.fileExists(atPath: installMarkerURL(name).path)
    }

    /// File size in bytes, or 0 if the file is missing.
    private func fileSizeBytes(_ url: URL) -> Int64 {
        return sttFileSizeBytes(url)
    }

    private func writeInitBreadcrumb(_ modelName: String) {
        let url = initBreadcrumbURL()
        do {
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(),
                withIntermediateDirectories: true)
            let payload = """
                {"model":"\(modelName)","phase":"native-init","uptimeMs":\(Int(ProcessInfo.processInfo.systemUptime * 1000)),"ts":"\(Date())"}
                """
            try payload.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            sttErr(
                "Whisper | failed to write init breadcrumb for",
                modelName, "—", error.localizedDescription)
        }
    }

    private func clearInitBreadcrumb() {
        try? FileManager.default.removeItem(at: initBreadcrumbURL())
    }

    private func reportPriorInitCrash() -> String? {
        let url = initBreadcrumbURL()
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let payload =
            (try? String(contentsOf: url, encoding: .utf8))
            ?? "<unreadable init breadcrumb>"
        sttErr(
            "STT_INIT_CRASH previous on-device whisper init did not complete",
            "context=\(payload)")
        try? FileManager.default.removeItem(at: url)
        return payload
    }

    private func loadGuarded(modelName: String, path: String) -> WhisperCppContext? {
        let file = URL(fileURLWithPath: path)
        let problems = validateGgmlModelFile(file)
        if !problems.isEmpty {
            sttErr(
                "Whisper | refusing native load for",
                modelName, "—", problems.joined(separator: ", "))
            return nil
        }
        writeInitBreadcrumb(modelName)
        defer { clearInitBreadcrumb() }
        return WhisperCppContext.load(path: path)
    }

    private func postInstallSettleSeconds(for modelName: String) -> TimeInterval {
        let size = fileSizeBytes(modelFile(modelName))
        if size >= 1_200_000_000 { return 5.0 }
        if size >= 800_000_000 { return 4.0 }
        if size >= 500_000_000 { return 2.5 }
        if size >= 250_000_000 { return 1.25 }
        return 0.4
    }

    private func markFreshInstall(_ modelName: String) {
        let seconds = postInstallSettleSeconds(for: modelName)
        let readyAt = Date().addingTimeInterval(seconds)
        queue.sync { self.freshInstallReadyAt[modelName] = readyAt }
        sttLog(
            "Whisper | fresh install cooldown:",
            modelName, "seconds=\(String(format: "%.2f", seconds))")
    }

    private func waitForFreshInstallSettleIfNeeded(_ modelName: String) async {
        let readyAt = queue.sync { self.freshInstallReadyAt[modelName] }
        guard let readyAt else { return }
        let remaining = readyAt.timeIntervalSinceNow
        if remaining > 0 {
            sttLog(
                "Whisper | waiting for fresh install to settle:",
                modelName, "seconds=\(String(format: "%.2f", remaining))")
            try? await Task.sleep(
                nanoseconds: UInt64(max(0.0, remaining) * 1_000_000_000.0))
        }
        queue.sync { _ = self.freshInstallReadyAt.removeValue(forKey: modelName) }
    }

    /// Authoritative "is this model installed?" answer.
    ///
    /// Disk is the truth. Heuristic: the .bin file exists and is at
    /// least 1 MB (even ggml-tiny is ~75 MB; anything smaller is a
    /// truncated download or accidental empty-file). On disagreement
    /// with the marker, we trust disk and rewrite the marker.
    private func validateModel(_ name: String) -> [String] {
        let file = modelFile(name)
        let problems = validateGgmlModelFile(file)
        if !problems.isEmpty {
            if installMarkerExists(name) {
                sttLog(
                    "Whisper | clearing stale marker (validation failed):",
                    name, problems.joined(separator: ", "))
                self.removeInstallMarker(name)
            }
            return problems
        }
        if !installMarkerExists(name) {
            self.writeInstallMarker(name)
        }
        return []
    }

    fileprivate func wipeModel(_ name: String) {
        let fm = FileManager.default
        try? fm.removeItem(at: modelFile(name))
        self.removeInstallMarker(name)
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

    /// Public wipe entry point — pack calls this when it sees a hang or
    /// load failure to recover from a corrupt download.
    func wipe(model requested: String?) {
        let modelName = requested ?? Self.defaultModel
        queue.sync {
            // Drop any in-memory ctx pointing at the corrupt file so
            // the next prepare() rebuilds from disk.
            if self.loadedModel == modelName {
                self.ctx = nil
                self.loadedModel = nil
            }
        }
        wipeModel(modelName)
    }

    // ---------------------------------------------------------------------
    // Status
    // ---------------------------------------------------------------------
    func status() -> StatusPayload {
        let availMB: Int?
        if #available(iOS 13.0, *) {
            availMB = Int(os_proc_available_memory() / 1_048_576)
        } else {
            availMB = nil
        }
        let physMB: Int = Int(ProcessInfo.processInfo.physicalMemory / 1_048_576)
        sttLog(
            "Whisper | status() returning availableMemoryMB=\(availMB.map { String($0) } ?? "nil") physicalMemoryMB=\(physMB)")
        return queue.sync {
            let prior = self.pendingInitCrash
            self.pendingInitCrash = nil
            return StatusPayload(
                available: true,
                prepared: ctx != nil,
                model: loadedModel,
                recording: isRecording,
                message: nil,
                availableMemoryMB: availMB,
                physicalMemoryMB: physMB,
                priorInitCrash: prior
            )
        }
    }

    func isAvailable() -> Bool { true }

    // ---------------------------------------------------------------------
    // Install — single-file URLSession download, then disk verification.
    //
    // The pack passes the model id as the .bin filename (e.g.
    // "ggml-tiny.bin"). We resolve it to the canonical Hugging Face
    // download URL on `ggml-org/whisper.cpp` and stream to our private
    // model dir. Native model init is intentionally left to prepare(),
    // where the memory gate, fresh-install cooldown, and crash breadcrumb
    // all run in one place.
    // ---------------------------------------------------------------------

    // Use ggerganov/whisper.cpp (not ggml-org/whisper.cpp) — the
    // GitHub repo was renamed to ggml-org but the HF model repo
    // still lives at the original ggerganov path. The ggml-org HF
    // path returns HTTP 401 "Invalid username or password." for
    // public files (verified 2026-05-10 against ggml-tiny.bin).
    private static let huggingFaceBase =
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/"

    private func downloadURL(for modelName: String) -> URL? {
        return URL(string: Self.huggingFaceBase + modelName)
    }

    func installModel(
        model requested: String?,
        downloadUrl: String? = nil,
        progress onProgress: @escaping (InstallProgressPayload) -> Void,
        completion: @escaping (Result<InstallResultPayload, SttFailure>) -> Void
    ) {
        let modelName = requested ?? Self.defaultModel
        sttLog(
            "Whisper | install requested:", modelName,
            "url:", downloadUrl ?? "(huggingface default)")

        // Fast path: already installed.
        let validationProblems = self.validateModel(modelName)
        if validationProblems.isEmpty {
            sttLog("Whisper | already installed (validateModel ok):", modelName)
            onProgress(
                InstallProgressPayload(
                    model: modelName, phase: "verified",
                    fraction: 1.0, completed: nil, total: nil, error: nil, code: nil))
            completion(
                .success(
                    InstallResultPayload(
                        installed: true, model: modelName, alreadyInstalled: true)))
            return
        }
        sttLog(
            "Whisper | proceeding with download (validateModel said:",
            validationProblems.joined(separator: ", "), ")")

        // Pack-supplied URL wins (used for models we host ourselves
        // — community Indic fine-tunes, self-quantized variants).
        // Fall back to the HuggingFace base when nil.
        let urlCandidate: URL? = {
            if let custom = downloadUrl, !custom.isEmpty {
                return URL(string: custom)
            }
            return downloadURL(for: modelName)
        }()
        guard let url = urlCandidate else {
            let msg = "Invalid download URL for: \(modelName)"
            sttErr("Whisper |", msg)
            onProgress(
                InstallProgressPayload(
                    model: modelName, phase: "failed",
                    fraction: nil, completed: nil, total: nil,
                    error: msg, code: SttErrorCode.modelNotInstalled.rawValue))
            completion(.failure(SttFailure(code: .modelNotInstalled, description: msg)))
            return
        }
        sttLog("Whisper | downloading from:", url.absoluteString)

        let dest = modelFile(modelName)
        try? FileManager.default.createDirectory(
            at: dest.deletingLastPathComponent(),
            withIntermediateDirectories: true)

        // Drop any previously-loaded ctx BEFORE the download finishes.
        // Holding ~75 MB to ~1.5 GB resident while downloading another
        // model can OOM-kill on smaller devices. Capture for restore on
        // failure.
        let previouslyLoaded: String? = self.queue.sync { self.loadedModel }
        if let prev = previouslyLoaded, prev != modelName {
            sttLog(
                "Whisper | dropping previous kit before model download:",
                prev)
            self.queue.sync {
                self.ctx = nil
                self.loadedModel = nil
            }
        }

        onProgress(
            InstallProgressPayload(
                model: modelName, phase: "downloading",
                fraction: 0.0, completed: nil, total: nil, error: nil, code: nil))

        let restorePreviousKit: () async -> Void = { [weak self] in
            guard let self, let prev = previouslyLoaded, prev != modelName else { return }
            let prevPath = self.modelFile(prev).path
            sttLog(
                "Whisper | install failed; restoring previously-loaded model:",
                prev)
            if let headroomError = self.checkMemoryHeadroom(for: prev) {
                sttErr(
                    "Whisper | skip restore after install failure (INSUFFICIENT_MEMORY):",
                    headroomError)
                return
            }
            if let prevCtx = self.loadGuarded(modelName: prev, path: prevPath) {
                self.queue.sync {
                    self.ctx = prevCtx
                    self.loadedModel = prev
                }
                sttLog("Whisper | restored previously-loaded model:", prev)
            } else {
                sttErr(
                    "Whisper | failed to restore previously-loaded model:", prev)
            }
        }

        // URLSession download — delegate handles progress + move to
        // final dest on success.
        let delegate = WhisperDownloadDelegate(
            modelName: modelName, dest: dest, onProgress: onProgress
        ) { [weak self] result in
            guard let self else {
                completion(
                    .failure(SttFailure(code: .unknown, description: "Plugin released")))
                return
            }
            switch result {
            case .success(let downloadedURL):
                Task {
                    sttLog(
                        "Whisper | finalizing verified model install:",
                        modelName, downloadedURL.path)
                    onProgress(
                        InstallProgressPayload(
                            model: modelName, phase: "verifying",
                            fraction: 1.0, completed: nil, total: nil,
                            error: nil, code: nil))
                    let problems = self.validateModel(modelName)
                    if problems.isEmpty {
                        self.markFreshInstall(modelName)
                        self.writeInstallMarker(modelName)
                        sttLog(
                            "Whisper | install verified on disk:", modelName)
                        onProgress(
                            InstallProgressPayload(
                                model: modelName, phase: "verified",
                                fraction: 1.0, completed: nil, total: nil,
                                error: nil, code: nil))
                        completion(
                            .success(
                                InstallResultPayload(
                                    installed: true, model: modelName,
                                    alreadyInstalled: false)))
                    } else {
                        let msg =
                            "Model file downloaded but failed verification: \(problems.joined(separator: ", "))"
                        sttErr("Whisper |", msg)
                        try? FileManager.default.removeItem(at: dest)
                        self.removeInstallMarker(modelName)
                        await restorePreviousKit()
                        onProgress(
                            InstallProgressPayload(
                                model: modelName, phase: "failed",
                                fraction: nil, completed: nil, total: nil,
                                error: msg,
                                code: SttErrorCode.loadFailed.rawValue))
                        completion(
                            .failure(SttFailure(code: .loadFailed, description: msg)))
                    }
                }
            case .failure(let error):
                let kind = classifyLoadError(error)
                sttErr(
                    "Whisper | install failed (\(kind.rawValue)):",
                    error.localizedDescription)
                Task {
                    await restorePreviousKit()
                    onProgress(
                        InstallProgressPayload(
                            model: modelName, phase: "failed",
                            fraction: nil, completed: nil, total: nil,
                            error: error.localizedDescription,
                            code: kind.rawValue))
                    completion(
                        .failure(
                            SttFailure(code: kind, description: error.localizedDescription)))
                }
            }
        }
        let session = URLSession(
            configuration: .default, delegate: delegate, delegateQueue: nil)
        let task = session.downloadTask(with: url)
        task.resume()
    }

    // ---------------------------------------------------------------------
    // Prepare — local-only load.
    //
    // Strictly loads weights from disk into memory. NEVER downloads. If
    // the model isn't installed, returns ready=false with a clear
    // message; the caller is expected to surface an install flow.
    // ---------------------------------------------------------------------
    func prepare(model requested: String?, completion: @escaping (PreparePayload) -> Void) {
        let modelName = requested ?? Self.defaultModel
        sttLog("Whisper | prepare requested (local-only):", modelName)
        sttMemSnapshot("prepare-entry: \(modelName)")

        let prevTail = self.queue.sync { self.prepareChain }
        let inFlightModel = self.queue.sync { self.loadInFlightFor }
        if let inFlightModel {
            sttLog(
                "Whisper | prepare queueing behind in-flight load:",
                inFlightModel,
                "(requested:", modelName, ")")
        }

        let myTask = Task<Void, Never> { [weak self] in
            _ = await prevTail.value
            guard let self else {
                completion(
                    PreparePayload(
                        ready: false, model: modelName,
                        message: "Plugin released", code: "LOAD_FAILED"))
                return
            }

            // Already loaded?
            let alreadyLoaded = self.queue.sync {
                self.ctx != nil && self.loadedModel == modelName
            }
            if alreadyLoaded {
                sttLog("Whisper | already loaded:", modelName)
                if !self.installMarkerExists(modelName) {
                    self.writeInstallMarker(modelName)
                }
                completion(
                    PreparePayload(
                        ready: true, model: modelName,
                        message: nil, code: nil))
                return
            }

            // Drop a different already-loaded kit before allocating
            // the new one. This branch only fires on paths where the
            // pack calls prepare() directly without an explicit
            // stt.unload() first (rare — boot's saved-model path,
            // some recovery flows). The normal setup-overlay path
            // unloads in a SEPARATE JS call before prepare runs, so
            // by the time we're here loadedModel is already nil.
            let prev = self.queue.sync { self.loadedModel }
            let swappingModels = prev != nil && prev != modelName
            if let prev, swappingModels {
                sttLog(
                    "Whisper | unloading previous model before swap:",
                    prev)
                sttMemSnapshot("swap-before-unload: \(prev) → \(modelName)")
                autoreleasepool {
                    self.queue.sync {
                        self.ctx = nil
                        self.loadedModel = nil
                    }
                }
            }

            // ALWAYS run pressure-relief + settle before the headroom
            // check, regardless of whether THIS prepare() did the
            // unload or whether a previous explicit stt.unload() call
            // did. The May-17 crash investigation showed the explicit-
            // unload path was BYPASSING this entirely: the pack called
            // stt.unload() (which did its own pressure_relief but
            // didn't settle), then stt.prepare() with prev=nil so the
            // old swap-branch settle never ran, then the headroom
            // check passed against an `os_proc_available_memory()`
            // number that lied about the C heap's freelist hoard. The
            // load then jetsam-killed mid-allocation.
            //
            // Note: malloc_zone_pressure_relief is best-effort — ggml
            // uses aligned_alloc which may live in a zone the pressure
            // call doesn't touch. The settle delay alone is the more
            // reliable lever; the kernel reclaims pages on its own
            // schedule even when malloc doesn't return them eagerly.
            _ = malloc_zone_pressure_relief(nil, 0)
            sttMemSnapshot("prepare-after-pressure-relief: \(modelName)")
            try? await Task.sleep(nanoseconds: 150_000_000)
            sttMemSnapshot("prepare-after-settle: \(modelName)")
            await self.waitForFreshInstallSettleIfNeeded(modelName)
            sttMemSnapshot("prepare-after-fresh-install-barrier: \(modelName)")

            // File present?
            let problems = self.validateModel(modelName)
            if !problems.isEmpty {
                let msg = "Model not installed: \(problems.joined(separator: ", "))"
                sttErr(
                    "Whisper | load failed (MODEL_NOT_INSTALLED):", msg,
                    "name=\(modelName)")
                completion(
                    PreparePayload(
                        ready: false, model: modelName,
                        message: msg,
                        code: SttErrorCode.modelNotInstalled.rawValue))
                return
            }

            // Memory-headroom gate. See `checkMemoryHeadroom` for the
            // math; tldr — we require BOTH a generous available-memory
            // margin (2.0× the model size, up from 1.3× in 0.4.0 after
            // the May-17 jetsam-during-load crash) AND that current
            // resident is not bloated relative to the new model
            // (which would indicate the freelist is hoarding the
            // previous model's weights and the next allocation will
            // double-count against the jetsam ceiling).
            if let headroomError = self.checkMemoryHeadroom(for: modelName) {
                sttErr(
                    "Whisper | load refused (INSUFFICIENT_MEMORY):",
                    headroomError)
                completion(
                    PreparePayload(
                        ready: false, model: modelName,
                        message: headroomError,
                        code: SttErrorCode.insufficientMemory.rawValue))
                return
            }

            self.queue.sync { self.loadInFlightFor = modelName }
            defer { self.queue.sync { self.loadInFlightFor = nil } }

            sttLog("Whisper | loading model from disk:", modelName)
            let path = self.modelFile(modelName).path
            guard let loaded = self.loadGuarded(modelName: modelName, path: path) else {
                let msg = "Failed to load \(modelName) (whisper_init returned nil)"
                sttErr("Whisper | load failed (LOAD_FAILED):", msg)
                completion(
                    PreparePayload(
                        ready: false, model: modelName,
                        message: msg,
                        code: SttErrorCode.loadFailed.rawValue))
                return
            }

            self.queue.sync {
                self.ctx = loaded
                self.loadedModel = modelName
            }
            if !self.installMarkerExists(modelName) {
                self.writeInstallMarker(modelName)
            }
            sttLog("Whisper | loaded ok:", modelName)
            sttMemSnapshot("prepare-loaded: \(modelName)")
            completion(
                PreparePayload(
                    ready: true, model: modelName,
                    message: nil, code: nil))
        }

        self.queue.sync { self.prepareChain = myTask }
    }

    // ---------------------------------------------------------------------
    // listInstalled — single round-trip view of disk truth across all
    // requested variants. Used by the pack to render the setup overlay.
    // ---------------------------------------------------------------------
    func listInstalled(models: [String]) -> ListInstalledPayload {
        let loaded = queue.sync { self.loadedModel }
        let entries: [InstalledModelPayload] = models.map { name in
            let problems = self.validateModel(name)
            let valid = problems.isEmpty
            let size = valid ? self.fileSizeBytes(self.modelFile(name)) : 0
            return InstalledModelPayload(
                model: name, valid: valid, problems: problems,
                sizeBytes: size, isLoaded: loaded == name)
        }
        return ListInstalledPayload(models: entries)
    }

    // ---------------------------------------------------------------------
    // unload — drop the in-memory whisper.cpp context. Next prepare()
    // is a load, not a download.
    // ---------------------------------------------------------------------
    func unload() {
        autoreleasepool {
            queue.sync {
                if self.loadedModel != nil {
                    sttLog(
                        "Whisper | unload — dropping in-memory kit:",
                        self.loadedModel ?? "?")
                }
                self.ctx = nil
                self.loadedModel = nil
            }
        }
        // Hint malloc to give the freed weight pages back to the OS.
        // Without this, the heap holds them on its freelist and
        // `os_proc_available_memory()` keeps under-reporting headroom
        // until the next big alloc triggers reclamation.
        _ = malloc_zone_pressure_relief(nil, 0)
        sttMemSnapshot("after-unload")
    }

    /// Headroom multiplier over the on-disk model size for the
    /// available-memory check. Bumped 1.3 → 2.0 in 0.4.1 after the
    /// May-17 crash showed that 1.3× wasn't enough: ggml's init
    /// transiently double-buffers the weights (raw file read + tensor
    /// copy) and iOS's `os_proc_available_memory()` reports
    /// optimistically relative to the actual jetsam ceiling. 2.0×
    /// covers the init peak with a margin; tighter than this risks
    /// passing the gate then dying mid-load.
    private static let memoryHeadroomMultiplier: Double = 2.0

    /// Read the current resident set size of this process in bytes.
    /// Same `mach_task_basic_info` syscall that `sttMemSnapshot`
    /// uses; factored out so the headroom check can read it cheaply.
    /// Returns 0 if the syscall fails (rare).
    private func currentResidentBytes() -> Int64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(
            MemoryLayout<mach_task_basic_info>.size
                / MemoryLayout<integer_t>.size)
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) { ptr in
            ptr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(
                    mach_task_self_,
                    task_flavor_t(MACH_TASK_BASIC_INFO),
                    $0,
                    &count)
            }
        }
        return kerr == KERN_SUCCESS ? Int64(info.resident_size) : 0
    }

    /// Check whether the OS has enough room to safely allocate this
    /// model's weights + working memory. Returns nil if we're good,
    /// or a human-readable explanation string if we're not.
    ///
    /// The May-17 crash showed why a simple `available_memory >
    /// modelSize × 1.3` check isn't enough: after an explicit
    /// `stt.unload()`, the C heap was hoarding 1.55 GB of the
    /// previous model on its freelist. `os_proc_available_memory()`
    /// reported 3339 MB free — true from the kernel's POV — and our
    /// gate passed (3339 > 1579 × 1.3 = 2053). But when ggml then
    /// allocated 1.58 GB for the new model, peak resident climbed to
    /// 1880 + ~3200 = ~5040 MB against a budget of ~5220 MB. iOS
    /// jetsam fired during the load.
    ///
    /// The fix is a composite "projected peak vs total budget" check:
    ///
    ///     projectedPeak = residentNow + modelSize × 2.0
    ///     totalBudget   = residentNow + availableNow
    ///     refuse if projectedPeak > totalBudget × 0.85
    ///
    /// The 2.0× covers ggml's init double-buffering (raw file read
    /// + tensor copy can briefly co-exist) plus per-context working
    /// memory (mel filters, KV cache, decoder buffers ≈ 25-30% of
    /// weights). The 0.85 ceiling leaves a 15% margin for system
    /// overhead and the fact that `os_proc_available_memory()`
    /// reports optimistically relative to the actual jetsam line.
    ///
    /// This formula correctly handles:
    ///   - Fresh-boot first-load (low resident) → passes for
    ///     models up to ~42% of the total budget.
    ///   - Large→Large swap with freelist hoarding (high resident,
    ///     similar new model) → refuses, which is the May-17 case.
    ///   - Large→Small swap (high resident, small new model) →
    ///     passes, because new × 2 stays small.
    ///   - Genuinely-tight devices → refuses earlier than a flat
    ///     multiplier would.
    private func checkMemoryHeadroom(for modelName: String) -> String? {
        let path = self.modelFile(modelName)
        let modelBytes = self.fileSizeBytes(path)
        guard modelBytes > 0 else {
            // No file (or unreadable). Don't gate on memory — let the
            // existing MODEL_NOT_INSTALLED path handle the missing-file
            // case.
            return nil
        }
        let availableBytes = Int64(os_proc_available_memory())
        guard availableBytes > 0 else {
            // The API can return 0 on simulator or weird states. Don't
            // refuse based on a measurement we don't trust.
            sttLog(
                "Whisper | os_proc_available_memory returned 0 — skipping headroom gate")
            return nil
        }
        let residentBytes = self.currentResidentBytes()
        // Composite check inputs.
        let projectedPeak = residentBytes
            + Int64(Double(modelBytes) * Self.memoryHeadroomMultiplier)
        let totalBudget = residentBytes + availableBytes
        let peakLimit = Int64(Double(totalBudget) * 0.85)

        // Also keep a flat available-memory floor for safety:
        // even if the composite math says we're fine, refuse if
        // available alone is below 1.5× the model size. Catches
        // weird states where resident is suspiciously low (e.g.,
        // API failure returning 0) and we can't trust the composite
        // formula.
        let availableFloor = Int64(Double(modelBytes) * 1.5)

        let modelMB = modelBytes / 1_048_576
        let availMB = availableBytes / 1_048_576
        let residentMB = residentBytes / 1_048_576
        let peakMB = projectedPeak / 1_048_576
        let limitMB = peakLimit / 1_048_576
        let budgetMB = totalBudget / 1_048_576
        sttLog(
            "Whisper | headroom check for \(modelName):",
            "modelMB=\(modelMB) residentMB=\(residentMB)",
            "availableMB=\(availMB) budgetMB=\(budgetMB)",
            "projectedPeakMB=\(peakMB) peakLimitMB=\(limitMB)")

        if availableBytes < availableFloor {
            let needMB = availableFloor / 1_048_576
            return
                "Need ~\(needMB) MB free to load \(modelName) safely, but only \(availMB) MB is available right now. "
                + "Close other apps and restart Corpán, then try the switch again."
        }

        if projectedPeak > peakLimit {
            // Distinguish the "freelist hoarding" case from the
            // "genuinely tight device" case so the user sees an
            // accurate action. Hoarding = high resident relative to
            // available; tight device = low budget overall.
            if residentBytes > availableBytes / 2 {
                return
                    "The previous model's memory hasn't been released to the OS yet "
                    + "(\(residentMB) MB resident with \(availMB) MB free; peak would hit \(peakMB) MB of a \(limitMB) MB safe ceiling). "
                    + "Restart Corpán to clear the allocator state, then switch."
            }
            return
                "Not enough memory budget to load this model safely "
                + "(peak ~\(peakMB) MB > \(limitMB) MB safe ceiling). "
                + "Close other apps and restart Corpán."
        }

        return nil
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
        whisperParams: WhisperParamsArg? = nil,
        scoringParams: ScoringParamsArg? = nil,
        completion: @escaping (Result<StartSessionPayload, Error>) -> Void
    ) {
        sttLog(
            "Whisper | startSession id:", sessionId, "lang:", language,
            "expected:", expectedText.prefix(60),
            "overrides:", whisperParams != nil ? "yes" : "(none)",
            "scoring:", scoringParams != nil ? "yes" : "(none)")

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
                // Lazy engine init on each session. We used to keep
                // the engine warm across stopSession to dodge a ~1 s
                // AVAudioEngine startup cost on back-to-back tries,
                // but that left iOS's mic indicator on and held the
                // session in `.playAndRecord + .duckOthers` (softer
                // TTS) during scoring and result viewing. Releasing
                // between sessions is the right user-facing tradeoff;
                // every startSession after a stop now pays the engine
                // setup cost. If first-word clipping becomes a
                // recurring complaint, fix it with a background
                // pre-warm tied to phrase-load / pass-the-device
                // events on the pack side — keep the always-warm
                // engine out of the native plugin.
                if self.audioEngine == nil {
                    do {
                        try self.configureSession()
                        try self.startAudioEngine()
                    } catch {
                        sttErr(
                            "Whisper | audio engine start failed:",
                            error.localizedDescription)
                        completion(.failure(error))
                        return
                    }
                }

                self.activeSessionId = sessionId
                self.activeLanguage = language
                self.activeExpected = expectedText
                self.activeWhisperParams = whisperParams
                self.activeScoringParams = scoringParams
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

        let snapshot: (
            captured: [Float], language: String, expected: String,
            params: WhisperParamsArg?,
            scoring: ScoringParamsArg?,
            startedAt: Date?, activeId: String?
        ) = queue.sync {
            let s = (
                captured: self.capturedSamples,
                language: self.activeLanguage,
                expected: self.activeExpected,
                params: self.activeWhisperParams,
                scoring: self.activeScoringParams,
                startedAt: self.sessionStartedAt,
                activeId: self.activeSessionId
            )
            // Tear down the audio engine + deactivate the session
            // immediately after grabbing the sample snapshot. Inference
            // doesn't need the mic, and keeping `.playAndRecord +
            // .duckOthers` active causes two real UX bugs while
            // scoring + viewing results:
            //   1. iOS shows the yellow mic-in-use indicator the whole
            //      time, even though we're not capturing anymore.
            //   2. TTS / pack audio plays at the lower `.playAndRecord`
            //      volume until the session deactivates.
            // We previously kept the engine warm to dodge a ~1 s
            // startup cost on back-to-back recordings — but the user-
            // facing correctness of "indicator off + full TTS volume
            // between mic tries" beats the latency win. If first-word
            // clipping starts coming back, address it with a "preparing
            // mic…" UI hint or a background re-warm on phrase load,
            // NOT by re-introducing the always-warm engine.
            self.isRecording = false
            self.activeSessionId = nil
            self.capturedSamples.removeAll(keepingCapacity: false)
            self.teardownAudio()
            return s
        }
        let captured = snapshot.captured
        let language = snapshot.language
        let expected = snapshot.expected
        let overrides = snapshot.params
        let scoringOverrides = snapshot.scoring
        let startedAt = snapshot.startedAt
        let activeId = snapshot.activeId

        if activeId == nil {
            sttErr("Whisper | stopSession called with no active session")
        }

        guard let ctx = self.queue.sync(execute: { self.ctx }) else {
            sttErr("Whisper | stopSession but model not loaded; calling prepare first")
            completion(
                .failure(
                    NSError(
                        domain: "STT", code: 2,
                        userInfo: [NSLocalizedDescriptionKey: "Whisper not prepared"])))
            return
        }

        let durationMs = startedAt.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
        sttLog(
            "Whisper | transcribing samples:", captured.count, "duration_ms:", durationMs)
        sttMemSnapshot("transcribe-entry: \(self.loadedModel ?? "?")")

        Task {
            let baseLang = String(language.split(separator: "-").first ?? Substring(language))
                .lowercased()

            // Validate language code against Whisper's 99-language list
            // — passing an unsupported code makes Whisper silently fall
            // back to English and we'd score against gibberish.
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

            // Prepend ~300 ms of silence (4800 zero samples at 16 kHz)
            // before passing to whisper.cpp. The user often starts
            // speaking the moment the mic engages, with zero leading
            // silence in `captured`. Whisper's mel spectrogram needs
            // ~50-100 ms of preceding context to anchor the first
            // token's acoustic features — without it, the first word
            // gets clipped, mistranscribed, or attributed a low-
            // confidence prefix token. Prepending silence is cheaper
            // than waiting on the UI side (no perceived delay) and
            // bumps first-word accuracy significantly across all
            // languages. 300 ms is a comfortable margin; whisper.cpp
            // throughput is unaffected.
            let leadingSilence = [Float](repeating: 0, count: 4800)
            let padded = leadingSilence + captured
            let runResult = await ctx.transcribe(
                samples: padded, language: baseLang, overrides: overrides)
            guard let runResult else {
                sttErr(
                    "Whisper | transcribe failed (whisper_full returned non-zero)")
                completion(
                    .failure(
                        NSError(
                            domain: "STT", code: 40,
                            userInfo: [
                                NSLocalizedDescriptionKey:
                                    sttRejectMessage(.audioFailed, "whisper_full failed")
                            ])))
                return
            }

            let merged = self.mergeResults(runResult)
            let scoring = self.computeScores(
                merged: merged, expected: expected,
                language: baseLang, freeText: merged.text,
                scoringOverrides: scoringOverrides)

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
                freeText: merged.text,  // Phase 1: single decode, free == constrained
                words: merged.words
            )

            let normHeard = self.normalize(merged.text, lang: baseLang)
            let normExp = self.normalize(expected, lang: baseLang)
            sttMemSnapshot("transcribe-done: \(self.loadedModel ?? "?")")
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
                "| acoustic:", String(format: "%.2f", scoring.acoustic),
                "| likelihood:", String(format: "%.2f", scoring.likelihood),
                "| overall:", String(format: "%.2f", scoring.overall))

            completion(.success(payload))
        }
    }

    // ---------------------------------------------------------------------
    // Cancel
    // ---------------------------------------------------------------------
    func cancelSession(sessionId: String) {
        sttLog("Whisper | cancelSession id:", sessionId)
        queue.sync {
            // Same teardown pattern as stopSession — release the
            // engine + session so the mic indicator goes away and
            // TTS regains full volume.
            self.isRecording = false
            self.activeSessionId = nil
            self.activeWhisperParams = nil
            self.activeScoringParams = nil
            self.capturedSamples.removeAll(keepingCapacity: false)
            self.teardownAudio()
        }
    }

    // ---------------------------------------------------------------------
    // Release audio
    //
    // Tear down AVAudioEngine + AVAudioSession entirely. Called when the
    // pack is closing — without this, the engine + tap + the
    // `.playAndRecord` audio session stay active across pack mounts,
    // which (a) keeps the iOS mic indicator orange in the status bar
    // and (b) keeps `.duckOthers` engaged so the rest of the app's
    // audio plays softer until the next app kill.
    //
    // Distinct from `cancelSession`, which deliberately keeps the
    // engine warm so back-to-back recordings inside one pack session
    // don't pay the ~1 s AVAudioEngine start cost.
    // ---------------------------------------------------------------------
    func releaseAudio() {
        sttLog("Whisper | releaseAudio (tearing down AVAudioEngine + session)")
        queue.sync {
            self.isRecording = false
            self.activeSessionId = nil
            self.activeWhisperParams = nil
            self.activeScoringParams = nil
            self.capturedSamples.removeAll(keepingCapacity: false)
            self.teardownAudio()
        }
    }

    // ---------------------------------------------------------------------
    // Audio session / engine plumbing — unchanged from the WhisperKit era.
    // whisper.cpp expects exactly the same input format (16 kHz f32 mono).
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
            // Engine runs continuously between sessions to dodge the
            // ~1 s startup latency that was clipping the first word
            // of every phrase. Only accumulate samples while a
            // session is active; otherwise the tap silently discards
            // frames.
            guard self.isRecording else { return }
            self.capturedSamples.append(contentsOf: chunk)

            // Per-buffer RMS for the pack-side silence detector. Cost
            // is ~5 µs for ~1365 floats. Fires at ~85 ms cadence on
            // typical iOS hardware (4096-frame tap @ 48 kHz native).
            if let emit = self.audioLevelEmitter {
                var sum: Float = 0
                for s in chunk { sum += s * s }
                let rms = sqrt(sum / Float(chunk.count))
                let t: Int
                if let started = self.sessionStartedAt {
                    t = Int(Date().timeIntervalSince(started) * 1000)
                } else {
                    t = 0
                }
                emit(rms, t)
            }
        }
    }

    // ---------------------------------------------------------------------
    // Result merging + scoring
    //
    // For Phase 1 we run a SINGLE decode pass (no dual constrained+free
    // path), so several fields that WhisperKit surfaced as first-class
    // (noSpeechProb, compressionRatio, temperature) get sane defaults
    // here — the existing scoring math reads them but the safe values
    // mean none of its hard gates fire false-positive.
    // ---------------------------------------------------------------------
    private struct MergedResult {
        let text: String
        let avgLogprob: Float
        let words: [WordTimingPayload]
        let noSpeechProb: Float
        let compressionRatio: Float
        let temperature: Float
        let minTokenLogprob: Float
        let tokenLogprobStdev: Float
    }

    private func mergeResults(_ result: WhisperCppContext.TranscribeOutput) -> MergedResult {
        var perTokenLogprobs: [Float] = []
        var logprobSum: Float = 0
        var logprobCount: Int = 0
        var maxNoSpeech: Float = 0
        var words: [WordTimingPayload] = []

        for segment in result.segments {
            logprobSum += segment.avgLogprob
            logprobCount += 1
            perTokenLogprobs.append(contentsOf: segment.perTokenLogprobs)
            maxNoSpeech = max(maxNoSpeech, segment.noSpeechProb)
            for w in segment.words {
                words.append(
                    WordTimingPayload(
                        word: w.word,
                        startMs: w.startMs,
                        endMs: w.endMs,
                        probability: w.probability))
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
            text: result.text,
            avgLogprob: avg,
            // Per-word entries assembled in WhisperCppContext.transcribe
            // by grouping BPE tokens at leading-space boundaries. Drives
            // computeScores' per-word acoustic ramp.
            words: words,
            // Real noSpeechProb from whisper.cpp's per-segment value.
            noSpeechProb: maxNoSpeech,
            // whisper.cpp doesn't expose compressionRatio/temperature on
            // its public Swift surface. Sane defaults so the existing
            // hard gates don't misfire:
            //   compressionRatio < 2.4 → gibberish cap doesn't fire
            //   temperature == 0 → no decoder-fallback penalty
            compressionRatio: 1.0,
            temperature: 0,
            minTokenLogprob: minTokenLogprob,
            tokenLogprobStdev: tokenLogprobStdev
        )
    }

    private struct Scores {
        let transcript: Float
        let likelihood: Float
        let acoustic: Float
        let overall: Float
        let earlyExitMessage: String?
        let freeVsConstrainedSimilarity: Float
    }

    /// Per-language number-word → digit map. Whisper transcribes spoken
    /// numbers as digits ("90" not "novanta") regardless of how the
    /// speaker said them, which made same-meaning utterances mismatch
    /// on text comparison. Mapping the EXPECTED side's number-words to
    /// digits before comparing closes the gap.
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

        let kept = lower.unicodeScalars.filter { !strip.contains($0) }
        let collapsed = String(String.UnicodeScalarView(kept))
            .replacingOccurrences(
                of: "\\s+", with: " ", options: .regularExpression)
        let trimmed = collapsed.trimmingCharacters(in: .whitespacesAndNewlines)

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

    /// True if a transcribed word is pure-digit OR is a known number
    /// word in the language's number-word dict. Such words have
    /// unreliable per-word probabilities under the constrained decode
    /// — Whisper might emit either form (digit or spelled), and
    /// `prefixTokens` forces whichever the expected text uses, so the
    /// per-word probability reflects "did the audio match this
    /// specific surface form?" rather than "did the user say the
    /// right number?"
    ///
    /// Used to filter `wordProbs` before computing the acoustic
    /// score. Transcript scoring still catches numerals via the
    /// existing `diez` ↔ `10` normalization — this only opts the
    /// acoustic layer out of the digit/word ambiguity.
    ///
    /// Implementation: reuse `normalize()`, which already maps
    /// number-words to digits per language. If the result is pure
    /// digits, the word was either a digit already or a number word
    /// that normalized to one — either way, uncertain.
    private func isUncertainNumeralWord(_ word: String, lang: String?) -> Bool {
        if word.isEmpty { return false }
        let normalized = normalize(word, lang: lang).replacingOccurrences(
            of: " ", with: "")
        if normalized.isEmpty { return false }
        return normalized.unicodeScalars.allSatisfy {
            CharacterSet.decimalDigits.contains($0)
        }
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
                    prev[j] + 1,
                    curr[j - 1] + 1,
                    prev[j - 1] + cost
                )
            }
            (prev, curr) = (curr, prev)
        }
        let dist = Float(prev[m])
        let maxLen = Float(max(n, m))
        return max(0, 1 - dist / maxLen)
    }

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

    private static let lowResourceLangs: Set<String> = [
        "te", "ta", "bn", "ml", "mr", "gu", "pa", "ur", "fa",
        "kn", "si", "ne", "or", "as",
    ]

    private struct AcousticRamp {
        let avgZero: Float
        let avgOne: Float
        let minZero: Float
        let minOne: Float
        let textFloor: Float
    }

    private static let highResRamp = AcousticRamp(
        avgZero: 0.40, avgOne: 0.95,
        minZero: 0.20, minOne: 0.78,
        // textFloor bumped 0.10 → 0.50 in 0.4.0+. Rationale: under
        // whisper.cpp the per-token confidence range is intrinsically
        // lower than WhisperKit's CoreML decoder produced, so a
        // perfectly transcribed phrase often lands at acoustic ~0.4
        // even on confident speech. With the old 0.10 floor that
        // gave overall = 1.0 * (0.10 + 0.9 * 0.40) = 0.46 on a
        // word-perfect attempt — the user's "I said it 100%" reads
        // as a 46% to them, which is wrong. The new 0.50 floor gives
        // overall = 1.0 * (0.50 + 0.50 * acoustic) — perfect transcript
        // alone earns 50%, and the acoustic ramp adds the rest. The
        // user's intent (transcript match = pronunciation right) is
        // honored without losing the per-word confidence signal.
        textFloor: 0.50
    )
    private static let lowResRamp = AcousticRamp(
        avgZero: 0.15, avgOne: 0.70,
        minZero: 0.05, minOne: 0.45,
        textFloor: 0.50
    )
    /// Tiny / Base have noticeably lower per-token confidence than
    /// Small+. Even perfectly-pronounced words land in the 0.4-0.7
    /// range. Use a softer ramp so the score reflects the user's
    /// pronunciation rather than the model's intrinsic uncertainty.
    private static let smallModelRamp = AcousticRamp(
        avgZero: 0.10, avgOne: 0.55,
        minZero: 0.05, minOne: 0.40,
        textFloor: 0.50
    )

    /// Pick an acoustic ramp from (model size, language) — smaller
    /// models and low-resource languages both warrant softer ramps
    /// because per-token probability magnitude is intrinsically lower
    /// in those settings, NOT because the user pronounced anything
    /// badly. Tiny + base override the language-based pick because
    /// their confidence floor is below even a low-res large.
    private func pickAcousticRamp(modelName: String?, baseLang: String) -> AcousticRamp {
        if let name = modelName?.lowercased() {
            if name.contains("ggml-tiny") || name.contains("ggml-base") {
                return Self.smallModelRamp
            }
        }
        return Self.lowResourceLangs.contains(baseLang)
            ? Self.lowResRamp
            : Self.highResRamp
    }

    /// Overlay pack-supplied scoring overrides on top of the native
    /// ramp picked by `pickAcousticRamp(modelName, baseLang)`. Each
    /// non-nil field in `overrides` replaces the corresponding slot;
    /// nil fields leave the native default. Used to dial scoring per
    /// (language, model) from the pack without a native rebuild.
    private func applyScoringOverlay(
        _ base: AcousticRamp, _ overrides: ScoringParamsArg?
    ) -> AcousticRamp {
        guard let o = overrides else { return base }
        return AcousticRamp(
            avgZero: o.avgZero ?? base.avgZero,
            avgOne: o.avgOne ?? base.avgOne,
            minZero: o.minZero ?? base.minZero,
            minOne: o.minOne ?? base.minOne,
            textFloor: o.textFloor ?? base.textFloor
        )
    }

    private func computeScores(
        merged: MergedResult, expected: String, language: String,
        freeText: String, scoringOverrides: ScoringParamsArg? = nil
    ) -> Scores {
        let baseLangNormHint = String(
            language.split(separator: "-").first ?? Substring(language)
        ).lowercased()
        let normTranscript = normalize(merged.text, lang: baseLangNormHint)
        let normExpected = normalize(expected, lang: baseLangNormHint)

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

        let combinedSim: (String, String) -> Float = { a, b in
            let charSim = self.levenshteinSimilarity(a, b)
            let aHasSpaces = a.contains(" ")
            let bHasSpaces = b.contains(" ")
            if !aHasSpaces && !bHasSpaces { return charSim }
            let wordSim = self.wordLevenshteinSimilarity(a, b)
            return min(charSim, wordSim)
        }
        let transcriptScoreConstrained: Float =
            normExpected.isEmpty ? 0 : combinedSim(normTranscript, normExpected)
        // Phase 1: single decode pass, so freeText == constrained text
        // and freeVsConstrained collapses to 1.0. Dual decode returns
        // in Phase 2.
        let transcriptScore = transcriptScoreConstrained

        // Filter pure-digit / number-word entries out of the
        // acoustic-score input. Their per-word probabilities are
        // unreliable under the constrained decode (digit-vs-spelled
        // ambiguity — see `isUncertainNumeralWord`). Transcript
        // scoring still catches them via normalize's diez ↔ 10
        // mapping.
        let probs = merged.words
            .filter { !self.isUncertainNumeralWord($0.word, lang: baseLangNormHint) }
            .map { $0.probability }
        let avgWordProb: Float =
            probs.isEmpty ? 0 : probs.reduce(0, +) / Float(probs.count)
        let minWordProb: Float = probs.min() ?? 0

        let baseLang = baseLangNormHint
        let nativeRamp = self.pickAcousticRamp(
            modelName: self.queue.sync(execute: { self.loadedModel }),
            baseLang: baseLang)
        let ramp = self.applyScoringOverlay(nativeRamp, scoringOverrides)
        if scoringOverrides != nil {
            sttLog(
                "Whisper | scoring overlay applied — avgZero",
                String(format: "%.2f", ramp.avgZero),
                "avgOne", String(format: "%.2f", ramp.avgOne),
                "minZero", String(format: "%.2f", ramp.minZero),
                "minOne", String(format: "%.2f", ramp.minOne),
                "textFloor", String(format: "%.2f", ramp.textFloor))
        }

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
            acousticScore = 0.6 * avgAcoustic + 0.4 * minAcoustic
        }

        if merged.tokenLogprobStdev > 0.8 {
            acousticScore *= 0.5
        }

        if merged.temperature > 0 {
            acousticScore *= 0.8
        }

        let likelihoodScore = max(0, min(1, 1 + merged.avgLogprob))

        var overall: Float
        if normExpected.isEmpty {
            overall = acousticScore
        } else {
            overall = transcriptScore * (ramp.textFloor + (1 - ramp.textFloor) * acousticScore)
        }
        let isLowRes = Self.lowResourceLangs.contains(baseLang)
        let nativeCompressionThreshold: Float = isLowRes ? 3.5 : 2.4
        let compressionThreshold: Float =
            scoringOverrides?.compressionThreshold ?? nativeCompressionThreshold
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
            freeVsConstrainedSimilarity: 1.0)  // single-pass: free == constrained
    }
}

// -----------------------------------------------------------------------------
// Constants — Whisper's 99-language list. Used in stopSession to refuse
// transcription for codes outside Whisper's supported set.
// -----------------------------------------------------------------------------
enum Constants {
    static let languageCodes: Set<String> = [
        "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo", "br", "bs",
        "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "eu", "fa", "fi",
        "fo", "fr", "gl", "gu", "ha", "haw", "he", "hi", "hr", "ht", "hu", "hy",
        "id", "is", "it", "ja", "jw", "ka", "kk", "km", "kn", "ko", "la", "lb",
        "ln", "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt",
        "my", "ne", "nl", "nn", "no", "oc", "pa", "pl", "ps", "pt", "ro", "ru",
        "sa", "sd", "si", "sk", "sl", "sn", "so", "sq", "sr", "su", "sv", "sw",
        "ta", "te", "tg", "th", "tk", "tl", "tr", "tt", "uk", "ur", "uz", "vi",
        "yi", "yo", "zh",
    ]
}

// -----------------------------------------------------------------------------
// Tauri Plugin surface — @objc methods that Tauri's Rust calls into.
// Method names + arg shapes are stable contracts; pack JS depends on them.
// -----------------------------------------------------------------------------

final class STTPlugin: Plugin {
    private static let manager = WhisperManager.shared
    private static var firstAudioLevelLogged = false

    override init() {
        super.init()
        // Wire the audio-level emitter once. The manager is a singleton
        // that outlives any single plugin instance, but Tauri creates
        // one STTPlugin per WebView load — overwriting the closure on
        // each construction is fine (and keeps the captured `self`
        // pointing at the current plugin instance).
        Self.manager.audioLevelEmitter = { [weak self] rms, t in
            guard let self else { return }
            // Use the Encodable overload, same pattern as
            // install_progress. The JSObject overload looked tidier
            // but routes through `Channel.send(JsonObject)` which
            // expects `[String: Any?]`, not `[String: JSValue]` —
            // the implicit bridge may silently drop the payload.
            let payload = AudioLevelPayload(rms: rms, t: t)
            do {
                try self.trigger("audio_level", data: payload)
            } catch {
                // Non-fatal — the next emit lands in ~85 ms.
                sttErr("Whisper | trigger audio_level failed:",
                    error.localizedDescription)
            }
            // One-shot debug log so we can confirm the native trigger
            // is firing without flooding os_log at 11 Hz. Reset each
            // time the plugin re-initializes.
            if !Self.firstAudioLevelLogged {
                Self.firstAudioLevelLogged = true
                sttLog("Whisper | first audio_level emit",
                    "rms:", String(format: "%.4f", rms),
                    "t:", t)
            }
        }
    }

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
            expectedText: args.expectedText,
            whisperParams: args.whisperParams,
            scoringParams: args.scoringParams
        ) { result in
            switch result {
            case .success(let payload):
                invoke.resolve(payload)
            case .failure(let error):
                let msg = error.localizedDescription
                let code: SttErrorCode = msg.lowercased().contains("microphone")
                    ? .micPermissionDenied : .audioFailed
                invoke.reject(sttRejectMessage(code, msg))
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
                let msg = error.localizedDescription
                let head = String(msg.split(separator: ":", maxSplits: 1).first ?? "")
                if SttErrorCode(rawValue: head) != nil {
                    invoke.reject(msg)
                } else {
                    invoke.reject(sttRejectMessage(.audioFailed, msg))
                }
            }
        }
    }

    @objc public func cancelSession(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SessionIdArgs.self)
        Self.manager.cancelSession(sessionId: args.sessionId)
        invoke.resolve()
    }

    @objc public func releaseAudio(_ invoke: Invoke) {
        Self.manager.releaseAudio()
        invoke.resolve()
    }

    @objc public func isAvailable(_ invoke: Invoke) {
        invoke.resolve(Self.manager.isAvailable())
    }

    @objc public func getStatus(_ invoke: Invoke) {
        // Return a Dictionary, NOT the Encodable StatusPayload struct.
        // Tauri's iOS Invoke.resolve was observed not honoring newly-
        // added Optional fields on Encodable structs. JSONSerialization
        // via Dictionary handles every field straightforwardly.
        let s = Self.manager.status()
        let availMB: Int?
        if #available(iOS 13.0, *) {
            availMB = Int(os_proc_available_memory() / 1_048_576)
        } else {
            availMB = nil
        }
        let physMB: Int = Int(ProcessInfo.processInfo.physicalMemory / 1_048_576)
        var dict: [String: Any] = [
            "available": s.available,
            "prepared": s.prepared,
            "recording": s.recording,
            "physicalMemoryMB": physMB,
            "_diag": "dict-v1-whispercpp",
        ]
        if let model = s.model { dict["model"] = model }
        if let message = s.message { dict["message"] = message }
        if let availMB { dict["availableMemoryMB"] = availMB }
        if let prior = s.priorInitCrash {
            dict["priorInitCrash"] = prior
            sttErr("Whisper | delivering prior STT init-crash breadcrumb to analytics")
        }
        invoke.resolve(dict)
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
            downloadUrl: args.downloadUrl,
            progress: { [weak self] payload in
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
                case .failure(let f):
                    invoke.reject(sttRejectMessage(f.code, f.description))
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

    @objc public func listInstalled(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ListInstalledArgs.self)
        let names = args.models ?? []
        invoke.resolve(Self.manager.listInstalled(models: names))
    }

    @objc public func unload(_ invoke: Invoke) {
        Self.manager.unload()
        invoke.resolve(["unloaded": true])
    }
}

@_cdecl("init_plugin_stt")
func init_plugin_stt() -> Plugin {
    sttLog("STT init_plugin_stt() — whisper.cpp runtime")
    return STTPlugin()
}
