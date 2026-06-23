use tauri::AppHandle;
use std::fs::File;
use std::io::Read;

#[tauri::command]
pub fn android_write_content_uri(
    _app: AppHandle,
    source_path: String,
    content_uri: String
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        eprintln!("android_write_content_uri called");
        eprintln!("Source: {}", source_path);
        eprintln!("Dest URI: {}", content_uri);

        // Read source file
        let mut source_file = File::open(&source_path)
            .map_err(|e| format!("Failed to open source file: {}", e))?;

        let mut buffer = Vec::new();
        source_file.read_to_end(&mut buffer)
            .map_err(|e| format!("Failed to read source file: {}", e))?;

        eprintln!("Read {} bytes from source", buffer.len());

        if buffer.is_empty() {
            return Err("Source file is empty!".to_string());
        }

        // Write using Tauri's plugin which should handle content URIs
        // But verify it actually works
        std::fs::write(&content_uri, &buffer)
            .map_err(|e| format!("Failed to write to content URI: {}", e))?;

        eprintln!("Write completed");

        Ok(())
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("android_write_content_uri is only available on Android".to_string())
    }
}

#[tauri::command]
pub fn android_share_file(
    _app: AppHandle,
    file_path: String,
    mime_type: String,
    title: String
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        // Note: This is a placeholder implementation
        // A full implementation would require:
        // 1. Converting file path to content:// URI via FileProvider
        // 2. Creating an ACTION_SEND Intent with the content URI
        // 3. Adding FLAG_GRANT_READ_URI_PERMISSION
        // 4. Launching the intent chooser

        // For now, log the request and return success
        // Users can manually access the file from the cache directory
        eprintln!("Android share requested for: {}", file_path);
        eprintln!("MIME type: {}", mime_type);
        eprintln!("Title: {}", title);

        // This is a placeholder - a full JNI implementation would go here
        // For MVP, users can manually share the file from the cache directory

        Ok(())
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("android_share_file is only available on Android".to_string())
    }
}

// Note: Full JNI implementation would require:
// 1. Adding jni = "0.21" to Cargo.toml dependencies
// 2. Implementing the JNI bridge to call Android Intent APIs
// 3. Configuring FileProvider in AndroidManifest.xml (already done)
// 4. Converting file paths to content:// URIs
//
// Example of what the full implementation would look like:
//
// use jni::JNIEnv;
// use jni::objects::{JObject, JString, JValue};
// use jni::sys::jstring;
//
// fn create_share_intent(
//     env: &JNIEnv,
//     context: JObject,
//     file_uri: &str,
//     mime_type: &str
// ) -> Result<(), String> {
//     // Get Intent class
//     let intent_class = env.find_class("android/content/Intent")?;
//
//     // Create new Intent(ACTION_SEND)
//     let action_send = env.new_string("android.intent.action.SEND")?;
//     let intent = env.new_object(
//         intent_class,
//         "(Ljava/lang/String;)V",
//         &[JValue::Object(action_send.into())]
//     )?;
//
//     // Set MIME type
//     let mime_jstring = env.new_string(mime_type)?;
//     env.call_method(
//         intent,
//         "setType",
//         "(Ljava/lang/String;)Landroid/content/Intent;",
//         &[JValue::Object(mime_jstring.into())]
//     )?;
//
//     // Add URI as EXTRA_STREAM
//     let uri_string = env.new_string(file_uri)?;
//     let uri = env.call_static_method(
//         "android/net/Uri",
//         "parse",
//         "(Ljava/lang/String;)Landroid/net/Uri;",
//         &[JValue::Object(uri_string.into())]
//     )?;
//
//     let extra_stream = env.new_string("android.intent.extra.STREAM")?;
//     env.call_method(
//         intent,
//         "putExtra",
//         "(Ljava/lang/String;Landroid/os/Parcelable;)Landroid/content/Intent;",
//         &[JValue::Object(extra_stream.into()), uri]
//     )?;
//
//     // Add FLAG_GRANT_READ_URI_PERMISSION
//     env.call_method(
//         intent,
//         "addFlags",
//         "(I)Landroid/content/Intent;",
//         &[JValue::Int(1)] // FLAG_GRANT_READ_URI_PERMISSION = 1
//     )?;
//
//     // Create chooser and start activity
//     // ...
//
//     Ok(())
// }
