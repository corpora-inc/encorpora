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
    private var prevTrackTarget: Any?
    private var nextTrackTarget: Any?

    private var seekTarget: Any?

    // Play/pause state for correct playbackRate in now-playing info
    private var currentlyPlaying = true

    // Stored book title for metadata
    private var bookTitle: String?

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
            currentlyPlaying = false
            var nowPlaying = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlaying
            triggerWebViewEvent("audio-keepalive:interruptionBegan")
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
            currentlyPlaying = false
            var nowPlaying = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlaying
            triggerWebViewEvent("audio-keepalive:pause")
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

        prevTrackTarget = center.previousTrackCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:prevChapter")
            return .success
        }

        nextTrackTarget = center.nextTrackCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:nextChapter")
            return .success
        }

        seekTarget = center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let posEvent = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.triggerWebViewEvent("audio-keepalive:seek", data: ["positionMs": posEvent.positionTime * 1000.0])
            return .success
        }
    }

    private func teardownRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        if let t = playTarget { center.playCommand.removeTarget(t) }
        if let t = pauseTarget { center.pauseCommand.removeTarget(t) }
        if let t = skipForwardTarget { center.skipForwardCommand.removeTarget(t) }
        if let t = skipBackTarget { center.skipBackwardCommand.removeTarget(t) }
        if let t = prevTrackTarget { center.previousTrackCommand.removeTarget(t) }
        if let t = nextTrackTarget { center.nextTrackCommand.removeTarget(t) }
        if let t = seekTarget { center.changePlaybackPositionCommand.removeTarget(t) }
        playTarget = nil
        pauseTarget = nil
        skipForwardTarget = nil
        skipBackTarget = nil
        prevTrackTarget = nil
        nextTrackTarget = nil
        seekTarget = nil
    }

    private func triggerWebViewEvent(_ eventName: String, data: JSObject = [:]) {
        trigger(eventName, data: data)
    }

    private func updateNowPlayingInfo(title: String?, artist: String?, positionMs: Double?, durationMs: Double?) {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [String: Any]()

        info[MPNowPlayingInfoPropertyPlaybackRate] = currentlyPlaying ? 1.0 : 0.0

        if let title = title {
            info[MPMediaItemPropertyTitle] = title
        }
        if let artist = artist {
            info[MPMediaItemPropertyArtist] = artist
        }
        if let bookTitle = bookTitle {
            info[MPMediaItemPropertyAlbumTitle] = bookTitle
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

        bookTitle = args.bookTitle
        currentlyPlaying = true

        configureAudioSession()
        startSilentLoop()
        setupRemoteCommands()

        updateNowPlayingInfo(
            title: args.title,
            artist: args.artist,
            positionMs: args.positionMs,
            durationMs: args.durationMs
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
        NotificationCenter.default.removeObserver(self, name: AVAudioSession.routeChangeNotification, object: nil)

        isActive = false
        invoke.resolve()
    }

    @objc func pauseAudioKeepalive(_ invoke: Invoke) throws {
        currentlyPlaying = false
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [String: Any]()
        info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        invoke.resolve()
    }

    @objc func resumeAudioKeepalive(_ invoke: Invoke) throws {
        currentlyPlaying = true
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [String: Any]()
        info[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        invoke.resolve()
    }

    @objc func updateNowPlaying(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(NowPlayingArgs.self)

        if let bt = args.bookTitle {
            bookTitle = bt
        }
        if let playing = args.isPlaying {
            currentlyPlaying = playing
        }

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
}

@_cdecl("init_plugin_audio_keepalive")
func initPlugin() -> Plugin {
    return AudioKeepAlivePlugin()
}
