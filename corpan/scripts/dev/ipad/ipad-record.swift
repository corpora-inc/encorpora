// ipad-record.swift — headless screen+audio recorder for a USB-connected iPad.
//
// Why this exists: iOS screen capture is exposed as a CoreMediaIO *muxed*
// AVCaptureDevice that stays hidden until the DAL property
// kCMIOHardwarePropertyAllowScreenCaptureDevices is flipped. ffmpeg's
// avfoundation indev never sets it (so `ffmpeg -list_devices` doesn't show the
// iPad — only the iPhone Continuity Camera). We flip it here, find the iPad as
// a muxed device, and record its screen + audio to a .mov via AVCaptureSession.
//
// Records on launch; finalizes + exits cleanly on SIGINT/SIGTERM (studio.py
// signals stop). The muxed input carries the device's audio (app TTS/UI sounds)
// natively, so the output has a video + audio track.
//
//   swiftc -O ipad-record.swift -o ipad-record
//   ./ipad-record --out /tmp/t.mov [--udid <UDID>] [--name iPad] [--list]
//
// macOS Camera (and possibly Screen Recording) permission is required for the
// controlling terminal; the first run triggers the TCC prompt.

import AVFoundation
import CoreMediaIO
import Foundation

func eprint(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }

// Flip the DAL "allow screen capture devices" switch so USB iOS devices appear
// as AVCaptureDevices. Without this the iPad is invisible to AVFoundation.
func enableScreenCaptureDevices() {
    var addr = CMIOObjectPropertyAddress(
        mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
        mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
        mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain)
    )
    var allow: UInt32 = 1
    let size = UInt32(MemoryLayout<UInt32>.size)
    let status = CMIOObjectSetPropertyData(
        CMIOObjectID(kCMIOObjectSystemObject), &addr, 0, nil, size, &allow)
    if status != 0 { eprint("warn: CMIOObjectSetPropertyData status=\(status)") }
}

// Enumerate candidate capture devices (muxed = iOS screen-capture devices, plus
// external as a fallback on newer macOS). Includes legacy enumeration too.
func candidateDevices() -> [AVCaptureDevice] {
    var seen = Set<String>()
    var out: [AVCaptureDevice] = []
    func add(_ d: AVCaptureDevice) { if seen.insert(d.uniqueID).inserted { out.append(d) } }

    var types: [AVCaptureDevice.DeviceType] = []
    if #available(macOS 14.0, *) { types.append(.external) }
    for mt: AVMediaType in [.muxed, .video] {
        let s = AVCaptureDevice.DiscoverySession(
            deviceTypes: types, mediaType: mt, position: .unspecified)
        s.devices.forEach(add)
    }
    // Legacy path (deprecated but still surfaces muxed iOS devices reliably).
    AVCaptureDevice.devices(for: .muxed).forEach(add)
    return out
}

func pickDevice(udid: String?, name: String?) -> AVCaptureDevice? {
    let devs = candidateDevices()
    if let udid = udid, !udid.isEmpty {
        // iOS capture devices' uniqueID is (a prefix of) the UDID.
        if let d = devs.first(where: {
            $0.uniqueID == udid || udid.hasPrefix($0.uniqueID) || $0.uniqueID.hasPrefix(udid)
        }) { return d }
    }
    let wanted = (name ?? "iPad").lowercased()
    if let d = devs.first(where: { $0.localizedName.lowercased().contains(wanted) }) { return d }
    // Last resort: any muxed device that isn't an iPhone Continuity Camera.
    return devs.first(where: { !$0.localizedName.lowercased().contains("iphone") })
}

// ---- arg parsing ----
var outPath: String?
var udid = ProcessInfo.processInfo.environment["CORPAN_IPAD_UDID"]
var name: String?
var listOnly = false
var args = Array(CommandLine.arguments.dropFirst())
var i = 0
while i < args.count {
    switch args[i] {
    case "--out": i += 1; outPath = i < args.count ? args[i] : nil
    case "--udid": i += 1; udid = i < args.count ? args[i] : nil
    case "--name": i += 1; name = i < args.count ? args[i] : nil
    case "--list": listOnly = true
    default: eprint("warn: unknown arg \(args[i])")
    }
    i += 1
}

enableScreenCaptureDevices()
// Devices appear asynchronously after enabling DAL — give them a beat.
Thread.sleep(forTimeInterval: 1.2)

if listOnly {
    // DAL screen-capture devices can take several seconds to appear after the
    // property flip — poll for up to ~12s, printing the set each pass.
    var found = false
    for pass in 0..<12 {
        let devs = candidateDevices()
        eprint("--- pass \(pass) (\(devs.count) device(s)) ---")
        for d in devs {
            let kinds = (d.hasMediaType(.muxed) ? "muxed " : "") + (d.hasMediaType(.video) ? "video " : "")
            eprint("• \(d.localizedName)  [\(d.uniqueID)]  \(kinds)")
        }
        if devs.contains(where: { $0.localizedName.lowercased().contains("ipad") }) { found = true; break }
        Thread.sleep(forTimeInterval: 1.0)
    }
    exit(found ? 0 : 2)
}

guard let outPath = outPath else { eprint("error: --out <path.mov> required"); exit(2) }
guard let device = pickDevice(udid: udid, name: name) else {
    eprint("error: iPad capture device not found. Run with --list to see candidates.")
    eprint("  (iPad must be USB-connected + unlocked + trusted; grant Camera permission to this terminal.)")
    exit(3)
}
eprint("recording from: \(device.localizedName) [\(device.uniqueID)]")

let session = AVCaptureSession()
session.beginConfiguration()
do {
    let input = try AVCaptureDeviceInput(device: device)
    if session.canAddInput(input) { session.addInput(input) }
    else { eprint("error: cannot add device input"); exit(4) }
} catch {
    eprint("error: AVCaptureDeviceInput failed: \(error.localizedDescription)")
    exit(4)
}
let output = AVCaptureMovieFileOutput()
if session.canAddOutput(output) { session.addOutput(output) }
else { eprint("error: cannot add movie output"); exit(4) }
session.commitConfiguration()

let url = URL(fileURLWithPath: outPath)
try? FileManager.default.removeItem(at: url)

final class Recorder: NSObject, AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput,
                    didFinishRecordingTo outputFileURL: URL,
                    from connections: [AVCaptureConnection],
                    error: Error?) {
        if let error = error as NSError? {
            // AVErrorRecordingSuccessfullyFinished (-11806) is a normal stop.
            let code = error.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? false
            if !code && error.code != -11806 {
                eprint("recording error: \(error.localizedDescription) (\(error.code))")
            }
        }
        eprint("finalized: \(outputFileURL.path)")
        exit(0)
    }
}
let delegate = Recorder()

session.startRunning()
output.startRecording(to: url, recordingDelegate: delegate)
eprint("started → \(outPath)")

// Stop cleanly on signal: stopRecording() triggers the delegate which exits.
func installSignal(_ sig: Int32) {
    signal(sig, SIG_IGN)
    let src = DispatchSource.makeSignalSource(signal: sig, queue: .main)
    src.setEventHandler {
        eprint("stop signal — finalizing…")
        output.stopRecording()
        // Safety net if the delegate doesn't fire promptly.
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            session.stopRunning(); exit(0)
        }
    }
    src.resume()
    signalSources.append(src)
}
var signalSources: [DispatchSourceSignal] = []
installSignal(SIGINT)
installSignal(SIGTERM)

RunLoop.main.run()
