import XCTest
import Tauri
import AVFoundation
@testable import tauri_plugin_tts

final class ExamplePluginTests: XCTestCase {
    func testExample() throws {
        let plugin = ExamplePlugin()
        let expectation = XCTestExpectation(description: "Speech started")

        // Add a test delegate method to Speak class
        if let speaker = Mirror(reflecting: plugin).children.first(where: { $0.label == "speaker" })?.value as? Speak {
            let mirror = Mirror(reflecting: speaker)
            if let synthesizer = mirror.children.first(where: { $0.label == "voiceSynth" })?.value as? AVSpeechSynthesizer {
                // Add test callback
                let originalDelegate = synthesizer.delegate
                synthesizer.delegate = TestDelegate(expectation: expectation, originalDelegate: originalDelegate)
            }
        }

        let testData = """
        {"text": "I recommend taking advantage of the beautiful day outside by going for a walk in the park. It's a great way to relax and enjoy some fresh air!"}
        """

        let mockInvoke = Invoke(
            command: "speak",
            callback: 1,
            error: 2,
            sendResponse: { (callbackId, response) in
                XCTAssertEqual(callbackId, 1)
                XCTAssertNil(response)
            },
            sendChannelData: { (_, _) in },
            data: testData
        )

        try plugin.speak(mockInvoke)
        wait(for: [expectation], timeout: 10)
    }
}

class TestDelegate: NSObject, AVSpeechSynthesizerDelegate {
    let expectation: XCTestExpectation
    let originalDelegate: AVSpeechSynthesizerDelegate?

    init(expectation: XCTestExpectation, originalDelegate: AVSpeechSynthesizerDelegate?) {
        self.expectation = expectation
        self.originalDelegate = originalDelegate
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        originalDelegate?.speechSynthesizer?(synthesizer, didStart: utterance)
        expectation.fulfill()
    }

    // Forward other delegate methods to maintain original functionality
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        originalDelegate?.speechSynthesizer?(synthesizer, didFinish: utterance)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        originalDelegate?.speechSynthesizer?(synthesizer, didCancel: utterance)
    }
}
