import AVFoundation
import MediaPlayer
import Tauri
import UIKit
import WebKit

/// Native audio keepalive plugin for iOS.
///
/// Starts a near-silent AVAudioEngine loop to keep the AVAudioSession active,
/// preventing iOS from suspending the app (and WKWebView) in the background.
/// Also provides MPNowPlayingInfoCenter integration for lock screen controls.
class AudioKeepAlivePlugin: Plugin {
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var isActive = false

    // Remote command targets (stored for removal)
    private var playTarget: Any?
    private var pauseTarget: Any?
    private var skipForwardTarget: Any?
    private var skipBackTarget: Any?

    override init() {
        super.init()
    }

    // MARK: - Audio Session

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true, options: [])

            // Listen for interruptions (phone calls, Siri, etc.)
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleInterruption(_:)),
                name: AVAudioSession.interruptionNotification,
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
        case .ended:
            print("[AUDIO_KEEPALIVE] Interruption ended, resuming keepalive")
            // Re-activate session and restart engine
            do {
                try AVAudioSession.sharedInstance().setActive(true, options: [])
                try audioEngine?.start()
                playerNode?.play()
            } catch {
                print("[AUDIO_KEEPALIVE] Resume after interruption failed: \(error)")
            }
        @unknown default:
            break
        }
    }

    // MARK: - Near-Silent Audio Loop

    private func startSilentLoop() {
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
            try engine.start()
            player.play()

            self.audioEngine = engine
            self.playerNode = player
            print("[AUDIO_KEEPALIVE] Silent loop started")
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

    // MARK: - Now Playing / Remote Commands

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        playTarget = center.playCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:play")
            return .success
        }

        pauseTarget = center.pauseCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:pause")
            return .success
        }

        skipForwardTarget = center.skipForwardCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:skipForward")
            return .success
        }
        center.skipForwardCommand.preferredIntervals = [30]

        skipBackTarget = center.skipBackwardCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:skipBack")
            return .success
        }
        center.skipBackwardCommand.preferredIntervals = [30]
    }

    private func teardownRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        if let t = playTarget { center.playCommand.removeTarget(t) }
        if let t = pauseTarget { center.pauseCommand.removeTarget(t) }
        if let t = skipForwardTarget { center.skipForwardCommand.removeTarget(t) }
        if let t = skipBackTarget { center.skipBackwardCommand.removeTarget(t) }
        playTarget = nil
        pauseTarget = nil
        skipForwardTarget = nil
        skipBackTarget = nil
    }

    private func triggerWebViewEvent(_ eventName: String) {
        // Dispatch JavaScript event to the WebView so the pack can respond
        trigger(eventName, data: [:])
    }

    private func updateNowPlayingInfo(title: String?, artist: String?, positionMs: Double?, durationMs: Double?) {
        var info: [String: Any] = [
            MPNowPlayingInfoPropertyPlaybackRate: 1.0,
        ]

        if let title = title {
            info[MPMediaItemPropertyTitle] = title
        }
        if let artist = artist {
            info[MPMediaItemPropertyArtist] = artist
        }
        if let durationMs = durationMs {
            info[MPMediaItemPropertyPlaybackDuration] = durationMs / 1000.0
        }
        if let positionMs = positionMs {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = positionMs / 1000.0
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    // MARK: - Plugin Commands

    @objc func startAudioKeepalive(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(StartKeepAliveArgs.self)

        configureAudioSession()
        startSilentLoop()
        setupRemoteCommands()

        updateNowPlayingInfo(
            title: args.title,
            artist: args.artist,
            positionMs: nil,
            durationMs: nil
        )

        isActive = true
        invoke.resolve()
    }

    @objc func stopAudioKeepalive(_ invoke: Invoke) throws {
        teardownRemoteCommands()
        stopSilentLoop()

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil

        // Deactivate session so other apps can resume audio
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        } catch {
            print("[AUDIO_KEEPALIVE] Session deactivation failed: \(error)")
        }

        NotificationCenter.default.removeObserver(self, name: AVAudioSession.interruptionNotification, object: nil)

        isActive = false
        invoke.resolve()
    }

    @objc func updateNowPlaying(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(NowPlayingArgs.self)

        updateNowPlayingInfo(
            title: args.title,
            artist: args.artist,
            positionMs: args.positionMs,
            durationMs: args.durationMs
        )

        invoke.resolve()
    }
}

// MARK: - Argument Types

struct StartKeepAliveArgs: Decodable {
    let title: String?
    let artist: String?
    let bookTitle: String?
}

struct NowPlayingArgs: Decodable {
    let title: String?
    let artist: String?
    let positionMs: Double?
    let durationMs: Double?
}

@_cdecl("init_plugin_audio_keepalive")
func initPlugin() -> Plugin {
    return AudioKeepAlivePlugin()
}
