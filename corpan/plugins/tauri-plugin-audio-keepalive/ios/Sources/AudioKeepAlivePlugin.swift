import AVFoundation
import Tauri
import UIKit
import WebKit

/// Native audio keepalive plugin for iOS.
///
/// Session-bootstrap + event relay only.
/// WebKit owns MPNowPlayingInfoCenter via navigator.mediaSession.
/// This plugin provides:
///   1. AVAudioSession .playback category (needed for background audio)
///   2. Interruption observer → fires events to JS
///   3. Route change observer → fires pause to JS on headphone disconnect
///   4. Near-silent audio loop (optional, currently disabled)
class AudioKeepAlivePlugin: Plugin {
    private weak var webView: WKWebView?
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var isActive = false
    private let useSilentLoop = false

    override init() {
        super.init()
    }

    override func load(webview: WKWebView) {
        self.webView = webview
        super.load(webview: webview)
    }

    // MARK: - Audio Session

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            print("[AUDIO_KEEPALIVE] configureAudioSession: before setCategory")
            try session.setCategory(.playback, mode: .default, options: [])
            print("[AUDIO_KEEPALIVE] configureAudioSession: after setCategory, before setActive")
            try session.setActive(true, options: [])
            print("[AUDIO_KEEPALIVE] configureAudioSession: after setActive — done")

            // Listen for interruptions (phone calls, Siri, etc.)
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleInterruption(_:)),
                name: AVAudioSession.interruptionNotification,
                object: session
            )

            // Listen for route changes (headphone disconnect, etc.)
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleRouteChange(_:)),
                name: AVAudioSession.routeChangeNotification,
                object: session
            )
        } catch {
            print("[AUDIO_KEEPALIVE] Audio session setup failed: \(error.localizedDescription)")
        }
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let typeRaw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeRaw)
        else { return }

        switch type {
        case .began:
            print("[AUDIO_KEEPALIVE] Interruption began (phone call, Siri, etc.)")
            triggerWebViewEvent("audio-keepalive:interruptionBegan")
        case .ended:
            print("[AUDIO_KEEPALIVE] Interruption ended")
            // Re-activate session and restart engine
            do {
                try AVAudioSession.sharedInstance().setActive(true, options: [])
                try audioEngine?.start()
                playerNode?.play()
            } catch {
                print("[AUDIO_KEEPALIVE] Resume after interruption failed: \(error)")
            }
            let canResume: Bool
            if let optionsRaw = info[AVAudioSessionInterruptionOptionKey] as? UInt {
                canResume = AVAudioSession.InterruptionOptions(rawValue: optionsRaw).contains(.shouldResume)
            } else {
                canResume = false
            }
            triggerWebViewEvent("audio-keepalive:interruptionEnded", data: ["shouldResume": canResume])
        @unknown default:
            break
        }
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        guard let info = notification.userInfo,
              let reasonRaw = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonRaw)
        else { return }
        if reason == .oldDeviceUnavailable {
            print("[AUDIO_KEEPALIVE] Route change: headphone disconnect — dispatching pause to JS")
            dispatchCommandToJS("pause")
            triggerWebViewEvent("audio-keepalive:pause")
        }
    }

    // MARK: - Near-Silent Audio Loop

    private func startSilentLoop() {
        // Stop existing engine before creating new one (prevents noise if called twice)
        if audioEngine != nil {
            stopSilentLoop()
        }

        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()

        engine.attach(player)

        // Use a simple format: mono, 16kHz
        guard let format = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1) else {
            print("[AUDIO_KEEPALIVE] Failed to create audio format")
            return
        }

        engine.connect(player, to: engine.mainMixerNode, format: format)

        // Create a short buffer of near-silence (not pure zero — iOS detects and ignores that)
        let frameCount: AVAudioFrameCount = 16000 // 1 second at 16kHz
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
            print("[AUDIO_KEEPALIVE] Failed to create audio buffer")
            return
        }
        buffer.frameLength = frameCount

        // Fill with very low amplitude noise (well below audible threshold)
        if let channelData = buffer.floatChannelData {
            for i in 0..<Int(frameCount) {
                // Amplitude ~0.001: inaudible but non-zero so iOS doesn't detect silence
                channelData[0][i] = Float.random(in: -0.001...0.001)
            }
        }

        // Schedule the buffer to loop indefinitely
        player.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)

        do {
            engine.prepare()
            print("[AUDIO_KEEPALIVE] startSilentLoop: before engine.start()")
            try engine.start()
            print("[AUDIO_KEEPALIVE] startSilentLoop: engine.start() ok, before player.play()")
            player.play()

            self.audioEngine = engine
            self.playerNode = player
            print("[AUDIO_KEEPALIVE] startSilentLoop: done — engine.isRunning=\(engine.isRunning)")
        } catch {
            print("[AUDIO_KEEPALIVE] Engine start failed: \(error.localizedDescription)")
        }
    }

    private func stopSilentLoop() {
        playerNode?.stop()
        audioEngine?.stop()
        audioEngine = nil
        playerNode = nil
        print("[AUDIO_KEEPALIVE] Silent loop stopped")
    }

    // MARK: - JS Bridge

    private func triggerWebViewEvent(_ eventName: String, data: JSObject = [:]) {
        trigger(eventName, data: data)
    }

    private func dispatchCommandToJS(_ command: String) {
        guard let webView else {
            print("[AUDIO_KEEPALIVE] dispatchCommandToJS(\(command)) skipped: no webView")
            return
        }
        let script = "if (window.__readerCmd) window.__readerCmd('\(command)');"
        print("[AUDIO_KEEPALIVE] dispatchCommandToJS(\(command)) evaluating")
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { _, error in
                if let error {
                    print("[AUDIO_KEEPALIVE] dispatchCommandToJS(\(command)) failed: \(error.localizedDescription)")
                } else {
                    print("[AUDIO_KEEPALIVE] dispatchCommandToJS(\(command)) ok")
                }
            }
        }
    }

    // MARK: - Plugin Commands

    @objc func startAudioKeepalive(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(StartKeepAliveArgs.self)
        print("[AUDIO_KEEPALIVE] startAudioKeepalive: entry, isActive=\(isActive)")

        if isActive {
            print("[AUDIO_KEEPALIVE] startAudioKeepalive: already active, no-op")
            invoke.resolve()
            return
        }

        print("[AUDIO_KEEPALIVE] startAudioKeepalive: before configureAudioSession")
        configureAudioSession()
        if useSilentLoop {
            print("[AUDIO_KEEPALIVE] startAudioKeepalive: before startSilentLoop")
            startSilentLoop()
        } else {
            print("[AUDIO_KEEPALIVE] startAudioKeepalive: silent loop disabled")
        }

        isActive = true
        print("[AUDIO_KEEPALIVE] startAudioKeepalive: done, resolving")
        invoke.resolve()
    }

    @objc func stopAudioKeepalive(_ invoke: Invoke) throws {
        stopSilentLoop()

        // Deactivate session so other apps can resume audio
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        } catch {
            print("[AUDIO_KEEPALIVE] Session deactivation failed: \(error)")
        }

        NotificationCenter.default.removeObserver(self, name: AVAudioSession.interruptionNotification, object: nil)
        NotificationCenter.default.removeObserver(self, name: AVAudioSession.routeChangeNotification, object: nil)

        isActive = false
        invoke.resolve()
    }

    @objc func pauseAudioKeepalive(_ invoke: Invoke) throws {
        print("[AUDIO_KEEPALIVE] pauseAudioKeepalive: no-op (WebKit owns NPIC)")
        invoke.resolve()
    }

    @objc func resumeAudioKeepalive(_ invoke: Invoke) throws {
        print("[AUDIO_KEEPALIVE] resumeAudioKeepalive: no-op (WebKit owns NPIC)")
        invoke.resolve()
    }

    @objc func updateNowPlaying(_ invoke: Invoke) throws {
        print("[AUDIO_KEEPALIVE] updateNowPlaying: no-op (WebKit owns NPIC)")
        invoke.resolve()
    }

    @objc func traceEvent(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(TraceEventArgs.self)
        if let details = args.details, !details.isEmpty {
            print("[AUDIO_KEEPALIVE][TRACE] seq=\(args.seq) t=\(String(format: "%.1f", args.elapsedMs))ms event=\(args.event) details=\(details)")
        } else {
            print("[AUDIO_KEEPALIVE][TRACE] seq=\(args.seq) t=\(String(format: "%.1f", args.elapsedMs))ms event=\(args.event)")
        }
        invoke.resolve()
    }
}

// MARK: - Argument Types

struct StartKeepAliveArgs: Decodable {
    let title: String?
    let artist: String?
    let bookTitle: String?
    let positionMs: Double?
    let durationMs: Double?
}

struct NowPlayingArgs: Decodable {
    let title: String?
    let artist: String?
    let positionMs: Double?
    let durationMs: Double?
    let bookTitle: String?
    let isPlaying: Bool?
    let nowPlayingToken: Int64?
}

struct TraceEventArgs: Decodable {
    let seq: UInt64
    let elapsedMs: Double
    let event: String
    let details: String?
}

@_cdecl("init_plugin_audio_keepalive")
func initPlugin() -> Plugin {
    return AudioKeepAlivePlugin()
}
