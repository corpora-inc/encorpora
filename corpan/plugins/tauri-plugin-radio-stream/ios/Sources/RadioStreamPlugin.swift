import Tauri
import UIKit
import WebKit

/// RadioStreamPlugin — Tauri 2 mobile plugin entry point for iOS
/// streaming radio playback. Thin glue layer: parses Invoke args,
/// delegates to PlayerWrapper, and forwards delegate callbacks to JS
/// via `trigger(event, data:)`.
///
/// JS contract (events):
///   - "state-changed": { kind, message? }
///   - "icy-metadata":  { streamTitle?, streamUrl?, name?, genre?, bitrate? }
///   - "remote-command": { command: "play"|"pause"|"stop"|"headphones-noisy" }
///   - "interruption":  { began, shouldResume? }

struct PlayArgs: Decodable {
    let url: String
    let stationName: String?
    let country: String?
    let language: String?
    let faviconUrl: String?
}

struct SetVolumeArgs: Decodable {
    let volume: Float
}

class RadioStreamPlugin: Plugin, PlayerWrapperDelegate {
    private weak var webView: WKWebView?
    private var wrapper: PlayerWrapper?

    override init() {
        super.init()
    }

    override func load(webview: WKWebView) {
        self.webView = webview
        super.load(webview: webview)
        print("[RADIO_STREAM] plugin loaded")
        let w = PlayerWrapper()
        w.delegate = self
        self.wrapper = w
    }

    // MARK: - Commands

    @objc func play(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(PlayArgs.self)
            guard let url = URL(string: args.url) else {
                invoke.reject("invalid url: \(args.url)")
                return
            }
            let meta = PlayerWrapper.PlayMeta(
                stationName: args.stationName ?? "Radio",
                country: args.country ?? "",
                language: args.language ?? "",
                faviconUrl: args.faviconUrl
            )
            wrapper?.play(url: url, meta: meta)
            invoke.resolve()
        } catch {
            invoke.reject("invalid args: \(error)")
        }
    }

    @objc func pause(_ invoke: Invoke) {
        wrapper?.pause()
        invoke.resolve()
    }

    @objc func resume(_ invoke: Invoke) {
        wrapper?.resume()
        invoke.resolve()
    }

    @objc func stop(_ invoke: Invoke) {
        wrapper?.stop()
        invoke.resolve()
    }

    @objc func setVolume(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(SetVolumeArgs.self)
            wrapper?.setVolume(args.volume)
            invoke.resolve()
        } catch {
            invoke.reject("invalid args: \(error)")
        }
    }

    // MARK: - PlayerWrapperDelegate

    func playerStateChanged(kind: String, message: String?) {
        var data = JSObject()
        data["kind"] = kind
        if let m = message {
            data["message"] = m
        }
        triggerWebViewEvent("state-changed", data: data)
    }

    func playerIcyMetadata(_ payload: [String: Any]) {
        var data = JSObject()
        if let v = payload["streamTitle"] as? String { data["streamTitle"] = v }
        if let v = payload["streamUrl"] as? String { data["streamUrl"] = v }
        if let v = payload["name"] as? String { data["name"] = v }
        if let v = payload["genre"] as? String { data["genre"] = v }
        if let v = payload["bitrate"] as? Int { data["bitrate"] = v }
        triggerWebViewEvent("icy-metadata", data: data)
    }

    func playerRemoteCommand(_ command: String) {
        var data = JSObject()
        data["command"] = command
        triggerWebViewEvent("remote-command", data: data)
    }

    func playerInterruption(began: Bool, shouldResume: Bool?) {
        var data = JSObject()
        data["began"] = began
        if let r = shouldResume {
            data["shouldResume"] = r
        }
        triggerWebViewEvent("interruption", data: data)
    }

    // MARK: - JS Bridge
    //
    // Dual-dispatch like the audio-keepalive plugin and the Android side:
    //   1. webView.evaluateJavaScript("window.__radioStreamEvent(event, payload)")
    //      — what reliably reaches JS
    //   2. trigger(event, data:) — Tauri's Channel/binder path; kept for when
    //      it works.
    //
    // The JS side installs a single `window.__radioStreamEvent` handler that
    // fans out to whichever subscribers `listenForRadioEvents` registered.

    private func triggerWebViewEvent(_ name: String, data: JSObject = [:]) {
        let payloadJson = jsObjectToJsonString(data)
        // Single-quote the event string for safe embedding.
        let safeName = name
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let script = "if (window.__radioStreamEvent) window.__radioStreamEvent('\(safeName)', \(payloadJson));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script) { _, error in
                if let error {
                    print("[RADIO_STREAM] evaluateJavaScript(\(name)) failed: \(error.localizedDescription)")
                }
            }
        }
        trigger(name, data: data)
    }

    private func jsObjectToJsonString(_ obj: JSObject) -> String {
        // JSObject is `[String: JSValue]`; bridge to `[String: Any]` so
        // JSONSerialization can introspect the conforming Foundation types
        // (NSString, NSNumber, NSNull, NSArray, NSDictionary).
        let asAny: [String: Any] = obj.mapValues { $0 as Any }
        guard JSONSerialization.isValidJSONObject(asAny),
              let data = try? JSONSerialization.data(withJSONObject: asAny, options: []),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }
}

@_cdecl("init_plugin_radio_stream")
func initPlugin() -> Plugin {
    return RadioStreamPlugin()
}
