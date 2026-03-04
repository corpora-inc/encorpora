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
    private weak var webView: WKWebView?
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

    // Lock screen artwork (loaded once from app icon)
    private var artwork: MPMediaItemArtwork?

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

    // MARK: - Now Playing / Remote Commands

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.isEnabled = true
        playTarget = center.playCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.currentlyPlaying = true
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [String: Any]()
            info[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            self.triggerWebViewEvent("audio-keepalive:play")
            self.dispatchCommandToJS("play")
            return .success
        }

        center.pauseCommand.isEnabled = true
        pauseTarget = center.pauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.currentlyPlaying = false
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [String: Any]()
            info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            self.triggerWebViewEvent("audio-keepalive:pause")
            self.dispatchCommandToJS("pause")
            return .success
        }

        center.skipForwardCommand.isEnabled = true
        center.skipForwardCommand.preferredIntervals = [30]
        skipForwardTarget = center.skipForwardCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:skipForward")
            return .success
        }

        center.skipBackwardCommand.isEnabled = true
        center.skipBackwardCommand.preferredIntervals = [30]
        skipBackTarget = center.skipBackwardCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:skipBack")
            return .success
        }

        center.previousTrackCommand.isEnabled = true
        prevTrackTarget = center.previousTrackCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:prevChapter")
            return .success
        }

        center.nextTrackCommand.isEnabled = true
        nextTrackTarget = center.nextTrackCommand.addTarget { [weak self] _ in
            self?.triggerWebViewEvent("audio-keepalive:nextChapter")
            return .success
        }

        center.changePlaybackPositionCommand.isEnabled = true
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

    private func dispatchCommandToJS(_ command: String) {
        guard let webView else { return }
        let script = "window.__stargateCmd && window.__stargateCmd('\(command)')"
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { _, error in
                if let error {
                    print("[AUDIO_KEEPALIVE] dispatchCommandToJS(\(command)) failed: \(error.localizedDescription)")
                }
            }
        }
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
        if let artwork = artwork {
            info[MPMediaItemPropertyArtwork] = artwork
        }
        // Always set duration and position — iOS needs these for seek bar + time display
        // Floor duration to 1.0s minimum — iOS greys out skip buttons when duration is 0
        info[MPMediaItemPropertyPlaybackDuration] = max((durationMs ?? 0.0) / 1000.0, 1.0)
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = (positionMs ?? 0.0) / 1000.0

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    // MARK: - App Icon Loader

    private func loadAppIcon() -> UIImage? {
        if let img = UIImage(named: "AppIcon60x60") { return img }
        if let img = UIImage(named: "AppIcon") { return img }
        // Fallback: load via Info.plist CFBundleIcons
        if let icons = Bundle.main.infoDictionary?["CFBundleIcons"] as? [String: Any],
           let primary = icons["CFBundlePrimaryIcon"] as? [String: Any],
           let files = primary["CFBundleIconFiles"] as? [String],
           let name = files.last,
           let img = UIImage(named: name) { return img }
        return nil
    }

    // MARK: - Plugin Commands

    @objc func startAudioKeepalive(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(StartKeepAliveArgs.self)
        print("[AUDIO_KEEPALIVE] startAudioKeepalive: entry, isActive=\(isActive)")

        if isActive {
            // Already running — just update metadata
            print("[AUDIO_KEEPALIVE] startAudioKeepalive: already active, updating metadata only")
            bookTitle = args.bookTitle
            currentlyPlaying = true
            updateNowPlayingInfo(title: args.title, artist: args.artist,
                                positionMs: args.positionMs, durationMs: args.durationMs)
            invoke.resolve()
            return
        }

        bookTitle = args.bookTitle
        currentlyPlaying = true

        // Load artwork once from app icon
        if artwork == nil, let img = loadAppIcon() {
            artwork = MPMediaItemArtwork(boundsSize: img.size) { _ in img }
        }

        print("[AUDIO_KEEPALIVE] startAudioKeepalive: before configureAudioSession")
        configureAudioSession()
        print("[AUDIO_KEEPALIVE] startAudioKeepalive: before startSilentLoop")
        startSilentLoop()
        print("[AUDIO_KEEPALIVE] startAudioKeepalive: before setupRemoteCommands")
        setupRemoteCommands()

        updateNowPlayingInfo(
            title: args.title,
            artist: args.artist,
            positionMs: args.positionMs,
            durationMs: args.durationMs
        )

        isActive = true
        print("[AUDIO_KEEPALIVE] startAudioKeepalive: done, resolving")
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
