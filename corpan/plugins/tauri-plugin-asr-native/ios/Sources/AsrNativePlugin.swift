import AVFoundation
import Foundation
import Speech
import Tauri
import os.log

// -----------------------------------------------------------------------------
// tauri-plugin-asr-native — iOS (Apple native STT), Phase-1 SCAFFOLD STUB.
//
// What this is: a contract-conformant skeleton that wires the asr-native
// command surface to Apple's Speech framework. The command shapes
// (capabilities / isAvailable / ensure / startSession / stopSession /
// cancelSession) and the event channel are in place and match
// corpan-asr-contract. The REAL recognition path
// (SpeechAnalyzer/SpeechTranscriber on iOS 26 with an SFSpeechRecognizer
// fallback on ≤25, streaming partials + a VU level meter) is marked TODO and
// returns `isAvailable=false` until implemented + a device build is run
// (OWNER-OWNED — see ASR_SUBTEAM_SPECS.md Worker B). Until then the host
// router treats native as "covers nothing" and falls through to a downloadable
// provider or the keyboard — NO crash, NO fake transcripts.
//
// HARD CONSTRAINTS this stub already documents for the real impl:
//  • OUT-OF-PROCESS → no process-global init lock needed.
//  • COEXIST with tauri-plugin-radio-stream's `.longForm` AVAudioSession —
//    DO NOT reset/strip it; verify a radio stream survives a dictation session.
//  • INTERRUPTED (call / Control-Center) → emit SessionErrorEvent code
//    "INTERRUPTED" + clean-cancel, NEVER crash.
//  • Permission denial → emit code "MIC_DENIED"; the JS MicInput launchpad
//    drives openSettingsURLString (iOS Settings deep-links are impossible).
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

// MARK: - Plugin

class AsrNativePlugin: Plugin {

    /// Which of our codes Apple covers, mapped to a recognizer locale. The
    /// real impl populates `languages` from
    /// `SFSpeechRecognizer.supportedLocales()` ∩ our set (and on iOS 26 the
    /// SpeechTranscriber locale list). The stub reports an EMPTY set so the
    /// router falls through cleanly.
    @objc public func capabilities(_ invoke: Invoke) {
        let cap = AsrCapability(
            providerId: "native",
            languages: [],  // TODO(real impl): probe supported locales ∩ our codes
            onDevice: true,
            modelSizeMB: 0,
            residentMemoryMB: 0,    // out-of-process: ~0 added app memory
            streaming: true,
            latencyClass: "instant",
            needsDownload: false,
            autoregressive: true)
        invoke.resolve(cap)
    }

    @objc public func isAvailable(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(IsAvailableArgs.self)
            // TODO(real impl): map args.lang → locale; check
            // SFSpeechRecognizer(locale:)?.isAvailable +
            // supportsOnDeviceRecognition (iOS 26: SpeechTranscriber). For now,
            // report unavailable so the host uses a downloadable provider /
            // keyboard. NOT an error — this is the keyboard-floor contract.
            log("isAvailable(\(args.lang)) → stub:false")
            invoke.resolve(IsAvailableResult(ok: false, needsDownload: false))
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func ensure(_ invoke: Invoke) {
        do {
            _ = try invoke.parseArgs(EnsureArgs.self)
            // TODO(real impl): trigger the OS asset/model fetch for the locale
            // (some locales need an on-device download). Stub: nothing to do.
            invoke.resolve(EnsureResult(ready: false, downloading: false, code: "UNSUPPORTED_LANG"))
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func startSession(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(TranscribeArgs.self)
            // TODO(real impl):
            //  1. request SFSpeechRecognizer + AVAudioSession record permission;
            //     denial → trigger("asr://error", {sessionId, code:"MIC_DENIED"}).
            //  2. configure the audio session WITHOUT disturbing radio-stream's
            //     `.longForm` (do not setCategory to something exclusive).
            //  3. start a recognition request (requiresOnDeviceRecognition=true);
            //     stream partials via trigger("asr://partial", PartialEvent) and
            //     RMS via trigger("asr://level", LevelEvent).
            //  4. on AVAudioSession.interruptionNotification →
            //     trigger("asr://error", code:"INTERRUPTED") + cancel cleanly.
            log("startSession(\(args.sessionId), \(args.lang)) → stub: unavailable")
            invoke.reject("native STT not implemented (stub); router should not call this when isAvailable=false")
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func stopSession(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(SessionRef.self)
            // TODO(real impl): finalize the recognition + resolve the transcript.
            invoke.resolve(TranscriptOut(sessionId: args.sessionId, text: "", confidence: 0, language: ""))
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func cancelSession(_ invoke: Invoke) {
        // TODO(real impl): tear down the recognition task + audio tap; leave the
        // shared `.longForm` session intact.
        invoke.resolve()
    }
}

@_cdecl("init_plugin_asr_native")
func initPlugin() -> Plugin {
    return AsrNativePlugin()
}
