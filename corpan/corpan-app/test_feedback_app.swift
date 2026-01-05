import AppKit

// Try to find and open Feedback Assistant on macOS
let feedbackPaths = [
    "/System/Library/CoreServices/Applications/Feedback Assistant.app",
    "/Applications/Feedback Assistant.app",
]

print("Checking for Feedback Assistant:")
for path in feedbackPaths {
    let url = URL(fileURLWithPath: path)
    if FileManager.default.fileExists(atPath: path) {
        print("✓ Found at: \(path)")
        // Try to open it
        if NSWorkspace.shared.open(url) {
            print("  → Successfully opened")
        } else {
            print("  → Failed to open")
        }
    } else {
        print("✗ Not found at: \(path)")
    }
}

// Try URL scheme (may not work without entitlements)
if let url = URL(string: "applefeedback://") {
    print("\nTrying applefeedback:// URL scheme:")
    if NSWorkspace.shared.open(url) {
        print("✓ URL scheme worked")
    } else {
        print("✗ URL scheme failed")
    }
}
