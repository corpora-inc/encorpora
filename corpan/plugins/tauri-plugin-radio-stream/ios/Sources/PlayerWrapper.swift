import AVFoundation
import MediaPlayer
import UIKit

/// PlayerWrapper — owns the AVPlayer, AVPlayerItem, KVO observations,
/// AVAudioSession configuration, and MPNowPlayingInfoCenter wiring for
/// streaming radio playback (HLS, ICY/Shoutcast, MP3, AAC, AAC+, FLAC).
///
/// The wrapper is intentionally decoupled from Tauri: it exposes a
/// `PlayerWrapperDelegate` that the Plugin layer translates into
/// JS-facing events. This keeps platform glue testable in isolation
/// and lets us reuse the wrapper from non-Tauri contexts if needed.

protocol PlayerWrapperDelegate: AnyObject {
    func playerStateChanged(kind: String, message: String?)
    func playerIcyMetadata(_ payload: [String: Any])
    func playerRemoteCommand(_ command: String)
    func playerInterruption(began: Bool, shouldResume: Bool?)
}

final class PlayerWrapper: NSObject {
    weak var delegate: PlayerWrapperDelegate?

    // KVO tokens are strong-referenced so the observations stay alive
    // for the lifetime of the wrapper. Releasing them implicitly
    // invalidates the KVO registration (no manual removeObserver).
    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?
    private var timedMetadataObservation: NSKeyValueObservation?
    private var statusObservation: NSKeyValueObservation?
    private var rateObservation: NSKeyValueObservation?
    private var bufferObservation: NSKeyValueObservation?
    private var timeControlObservation: NSKeyValueObservation?

    private var currentMeta: PlayMeta?
    private var currentUrl: URL?
    private var lastEmittedKind: String = "idle"
    private var hasStartedPlaying: Bool = false
    private var remoteCommandsRegistered: Bool = false

    struct PlayMeta {
        let stationName: String
        let country: String
        let language: String
        let faviconUrl: String?
    }

    override init() {
        super.init()
        configureAudioSession()
        registerInterruptionHandlers()
        registerRemoteCommandCenter()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Public API

    func play(url: URL, meta: PlayMeta) {
        // AVPlayer must be created on the main queue — its KVO and
        // playback state are not thread-safe to mutate elsewhere.
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            print("[RADIO_STREAM] play url=\(url.absoluteString) station=\(meta.stationName)")

            self.tearDownCurrentPlayer()

            self.currentMeta = meta
            self.currentUrl = url
            self.hasStartedPlaying = false
            // Force the next emit through, even if we just stopped the same
            // station and lastEmittedKind is still "loading"/"idle".
            self.lastEmittedKind = ""
            self.emitState("loading")

            let item = AVPlayerItem(url: url)
            let p = AVPlayer(playerItem: item)
            p.automaticallyWaitsToMinimizeStalling = true
            p.allowsExternalPlayback = false

            self.playerItem = item
            self.player = p

            self.installObservations(player: p, item: item)
            self.updateNowPlayingInfo(isPlaying: true)
            self.loadArtworkAsync()

            p.play()
        }
    }

    func pause() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            print("[RADIO_STREAM] pause")
            // Keep the AVPlayer alive so iOS keeps the now-playing widget
            // attached to our app (it needs an active audio source). The
            // buffer goes stale during the pause but resume() rebuilds the
            // item from currentUrl, so playback restarts cleanly anyway.
            self.player?.pause()
            self.emitState("paused")
            self.updateNowPlayingInfo(isPlaying: false)
        }
    }

    func resume() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            print("[RADIO_STREAM] resume")
            // Re-activate the audio session in case it was deactivated by
            // an interruption that we never received an .ended for.
            try? AVAudioSession.sharedInstance().setActive(true, options: [])
            // Live HTTP streams (Shoutcast/Icecast/HLS) cannot be resumed
            // from a paused AVPlayer — the buffer drains and `.play()` is a
            // silent no-op. The only reliable resume is to rebuild the
            // AVPlayerItem with the saved URL, which forces a fresh fetch
            // at the live edge.
            if let url = self.currentUrl, let meta = self.currentMeta {
                self.tearDownCurrentPlayer()
                self.hasStartedPlaying = false
                self.lastEmittedKind = ""
                self.emitState("loading")
                let item = AVPlayerItem(url: url)
                let p = AVPlayer(playerItem: item)
                p.automaticallyWaitsToMinimizeStalling = true
                p.allowsExternalPlayback = false
                self.playerItem = item
                self.player = p
                self.installObservations(player: p, item: item)
                self.updateNowPlayingInfo(isPlaying: true)
                _ = meta // currentMeta still drives now-playing info
                p.play()
            } else {
                // No saved URL/meta — fall back to a plain play() on the
                // existing player (e.g. resume after an audio interruption
                // without a prior pause).
                self.player?.play()
                self.updateNowPlayingInfo(isPlaying: true)
            }
        }
    }

    func stop() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            print("[RADIO_STREAM] stop")
            self.tearDownCurrentPlayer()
            self.currentMeta = nil
            self.currentUrl = nil
            self.hasStartedPlaying = false
            self.emitState("idle")
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        }
    }

    func setVolume(_ v: Float) {
        let clamped = max(0, min(1, v))
        DispatchQueue.main.async { [weak self] in
            self?.player?.volume = clamped
        }
    }

    // MARK: - Audio Session

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            // routeSharingPolicy: .longForm declares us as a music/radio app
            // (continuous content). Without it iOS detaches the now-playing
            // widget on pause and shows "Not Playing", making play-from-widget
            // unreachable. With it the widget stays attached to *our* app
            // through a pause-resume cycle.
            try session.setCategory(
                .playback,
                mode: .default,
                policy: .longForm,
                options: []
            )
            try session.setActive(true, options: [])
            print("[RADIO_STREAM] audio session configured (.playback, .longForm)")
        } catch {
            print("[RADIO_STREAM] audio session setup failed: \(error.localizedDescription)")
        }
    }

    private func registerInterruptionHandlers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance()
        )
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let typeRaw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeRaw)
        else { return }

        switch type {
        case .began:
            print("[RADIO_STREAM] interruption began")
            player?.pause()
            delegate?.playerInterruption(began: true, shouldResume: nil)
        case .ended:
            try? AVAudioSession.sharedInstance().setActive(true, options: [])
            let shouldResume: Bool
            if let optionsRaw = info[AVAudioSessionInterruptionOptionKey] as? UInt {
                shouldResume = AVAudioSession.InterruptionOptions(rawValue: optionsRaw).contains(.shouldResume)
            } else {
                shouldResume = false
            }
            print("[RADIO_STREAM] interruption ended shouldResume=\(shouldResume)")
            delegate?.playerInterruption(began: false, shouldResume: shouldResume)
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
            print("[RADIO_STREAM] route change: old device unavailable (headphones-noisy)")
            player?.pause()
            updateNowPlayingInfo(isPlaying: false)
            delegate?.playerRemoteCommand("headphones-noisy")
        }
    }

    // MARK: - Remote Command Center

    private func registerRemoteCommandCenter() {
        guard !remoteCommandsRegistered else { return }
        let cc = MPRemoteCommandCenter.shared()

        cc.playCommand.isEnabled = true
        cc.pauseCommand.isEnabled = true
        cc.stopCommand.isEnabled = true
        cc.togglePlayPauseCommand.isEnabled = true
        // Live streams cannot seek; disable scrubbing and skip controls.
        cc.skipForwardCommand.isEnabled = false
        cc.skipBackwardCommand.isEnabled = false
        cc.nextTrackCommand.isEnabled = false
        cc.previousTrackCommand.isEnabled = false
        cc.changePlaybackPositionCommand.isEnabled = false

        cc.playCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.resume()
            self.delegate?.playerRemoteCommand("play")
            return .success
        }
        cc.pauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.pause()
            self.delegate?.playerRemoteCommand("pause")
            return .success
        }
        cc.stopCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.stop()
            self.delegate?.playerRemoteCommand("stop")
            return .success
        }
        cc.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self = self, let p = self.player else { return .commandFailed }
            if p.timeControlStatus == .playing {
                self.pause()
                self.delegate?.playerRemoteCommand("pause")
            } else {
                self.resume()
                self.delegate?.playerRemoteCommand("play")
            }
            return .success
        }

        remoteCommandsRegistered = true
    }

    // MARK: - KVO

    private func installObservations(player: AVPlayer, item: AVPlayerItem) {
        // Shoutcast/ICY metadata — Apple surfaces StreamTitle as an
        // AVMetadataItem with commonKey `.commonKeyTitle`. Other items
        // may carry the stream URL (.commonKeyAssetIdentifier) or genre.
        timedMetadataObservation = item.observe(\.timedMetadata, options: [.new]) { [weak self] item, _ in
            guard let self = self, let metas = item.timedMetadata else { return }
            self.handleTimedMetadata(metas)
        }

        statusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            guard let self = self else { return }
            switch item.status {
            case .failed:
                let msg = item.error?.localizedDescription ?? "playback failed"
                print("[RADIO_STREAM] item.status=.failed error=\(msg)")
                self.emitState("error", message: msg)
            case .readyToPlay:
                print("[RADIO_STREAM] item.status=.readyToPlay")
            default:
                break
            }
        }

        timeControlObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] p, _ in
            guard let self = self else { return }
            switch p.timeControlStatus {
            case .waitingToPlayAtSpecifiedRate:
                // First wait → loading; subsequent waits mid-playback → buffering.
                self.emitState(self.hasStartedPlaying ? "buffering" : "loading")
            case .playing:
                self.hasStartedPlaying = true
                self.emitState("playing")
                self.updateNowPlayingInfo(isPlaying: true)
            case .paused:
                // Only emit "paused" if we ever actually played; otherwise
                // we'd shadow an in-flight error state.
                if self.hasStartedPlaying {
                    self.emitState("paused")
                    self.updateNowPlayingInfo(isPlaying: false)
                }
            @unknown default:
                break
            }
        }

        rateObservation = player.observe(\.rate, options: [.new]) { _, _ in
            // We rely on timeControlStatus for state; rate is logged only.
        }

        bufferObservation = item.observe(\.isPlaybackBufferEmpty, options: [.new]) { [weak self] item, _ in
            guard let self = self else { return }
            if item.isPlaybackBufferEmpty && self.hasStartedPlaying {
                self.emitState("buffering")
            }
        }
    }

    private func handleTimedMetadata(_ items: [AVMetadataItem]) {
        var payload: [String: Any] = [:]
        for m in items {
            let value = (m.stringValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty else { continue }
            if let common = m.commonKey {
                switch common {
                case .commonKeyTitle:
                    payload["streamTitle"] = value
                case .commonKeyType:
                    payload["genre"] = value
                default:
                    break
                }
            }
            // Some streams expose key as the raw "StreamTitle" identifier
            // when commonKey is nil. Fallback path.
            if let key = m.key as? String {
                let lower = key.lowercased()
                if lower.contains("streamtitle"), payload["streamTitle"] == nil {
                    payload["streamTitle"] = value
                } else if lower.contains("streamurl"), payload["streamUrl"] == nil {
                    payload["streamUrl"] = value
                } else if lower.contains("name"), payload["name"] == nil {
                    payload["name"] = value
                } else if lower.contains("genre"), payload["genre"] == nil {
                    payload["genre"] = value
                } else if lower.contains("bitrate"), payload["bitrate"] == nil {
                    payload["bitrate"] = Int(value) ?? value
                }
            }
        }
        guard !payload.isEmpty else { return }
        print("[RADIO_STREAM] icy metadata: \(payload)")
        delegate?.playerIcyMetadata(payload)
        updateNowPlayingInfo(isPlaying: player?.timeControlStatus == .playing, streamTitle: payload["streamTitle"] as? String)
    }

    // MARK: - Now Playing

    private func updateNowPlayingInfo(isPlaying: Bool, streamTitle: String? = nil) {
        guard let meta = currentMeta else { return }
        // Build a fresh dictionary every time — mutating in place is unreliable.
        var info: [String: Any] = [:]
        let title = streamTitle ?? meta.stationName
        info[MPMediaItemPropertyTitle] = title
        info[MPMediaItemPropertyArtist] = meta.stationName
        if !meta.country.isEmpty {
            info[MPMediaItemPropertyAlbumTitle] = meta.country
        }
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
        // Intentionally NOT setting MPNowPlayingInfoPropertyIsLiveStream:
        // when iOS sees IsLiveStream=true with PlaybackRate=0 it interprets
        // the stream as *ended* and detaches the lock-screen widget,
        // showing "Not Playing" with no way to resume from the widget.
        // Without the flag, paused-with-rate-0 stays a normal pause and
        // the play/pause button remains reachable on the widget.

        // Preserve any artwork already loaded.
        if let existing = MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPMediaItemPropertyArtwork] {
            info[MPMediaItemPropertyArtwork] = existing
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func loadArtworkAsync() {
        guard let meta = currentMeta,
              let urlString = meta.faviconUrl,
              let url = URL(string: urlString) else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
            if let error = error {
                print("[RADIO_STREAM] artwork download failed: \(error.localizedDescription)")
                return
            }
            guard let data = data, let image = UIImage(data: data) else {
                print("[RADIO_STREAM] artwork: invalid image data")
                return
            }
            DispatchQueue.main.async {
                guard let self = self else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                info[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            }
        }.resume()
    }

    // MARK: - Helpers

    private func emitState(_ kind: String, message: String? = nil) {
        // De-dup identical state emissions (except errors, which always pass).
        if kind == lastEmittedKind && kind != "error" { return }
        lastEmittedKind = kind
        delegate?.playerStateChanged(kind: kind, message: message)
    }

    private func tearDownCurrentPlayer() {
        timedMetadataObservation = nil
        statusObservation = nil
        rateObservation = nil
        bufferObservation = nil
        timeControlObservation = nil
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        player = nil
        playerItem = nil
    }
}
