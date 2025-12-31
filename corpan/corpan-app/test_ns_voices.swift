import AppKit

// Try the older NSSpeechSynthesizer API
let voices = NSSpeechSynthesizer.availableVoices
print("Total voices from NSSpeechSynthesizer: \(voices.count)")

// Look for Punjabi and Gujarati
for voice in voices {
    let attrs = NSSpeechSynthesizer.attributes(forVoice: voice)
    let name = attrs[.name] as? String ?? ""
    let locale = attrs[.localeIdentifier] as? String ?? ""
    let id = voice.rawValue
    
    if locale.starts(with: "pa") || locale.starts(with: "gu") || 
       name.lowercased().contains("punjab") || name.lowercased().contains("gujarati") {
        print("\nFound: \(name)")
        print("  Locale: \(locale)")
        print("  ID: \(id)")
    }
}

// Also check for any Indian languages
print("\n\nAll Indian language voices:")
for voice in voices {
    let attrs = NSSpeechSynthesizer.attributes(forVoice: voice)
    let locale = attrs[.localeIdentifier] as? String ?? ""
    let name = attrs[.name] as? String ?? ""
    
    if locale.hasSuffix("_IN") || locale.hasSuffix("-IN") {
        print("  \(name) - \(locale)")
    }
}
