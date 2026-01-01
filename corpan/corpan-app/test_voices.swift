import AVFoundation

// Try to get voices using language code directly
let paVoice = AVSpeechSynthesisVoice(language: "pa-IN")
let guVoice = AVSpeechSynthesisVoice(language: "gu-IN")

print("Punjabi voice from language code: \(paVoice?.identifier ?? "nil")")
print("Gujarati voice from language code: \(guVoice?.identifier ?? "nil")")

// List all voices to compare
let allVoices = AVSpeechSynthesisVoice.speechVoices()
print("\nTotal voices from speechVoices: \(allVoices.count)")

// Check if there are any pa-IN or gu-IN voices
let paVoices = allVoices.filter { $0.language.starts(with: "pa-") }
let guVoices = allVoices.filter { $0.language.starts(with: "gu-") }
print("pa- voices: \(paVoices.count)")
print("gu- voices: \(guVoices.count)")
