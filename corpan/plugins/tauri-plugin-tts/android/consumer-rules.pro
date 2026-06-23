# Keep TTS plugin classes loaded via reflection by Tauri's PluginManager
-keep class space.httpjames.tauri_plugin_tts.ExamplePlugin { *; }
-keep class space.httpjames.tauri_plugin_tts.SpeakArgs { *; }
-keep class space.httpjames.tauri_plugin_tts.EngineStoreArgs { *; }
-keep class space.httpjames.tauri_plugin_tts.SpeakConcurrentArgs { *; }
