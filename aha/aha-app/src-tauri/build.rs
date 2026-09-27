fn main() {
    println!("cargo:rerun-if-env-changed=AHA_FREE2Z_CLIENT_ID");
    println!("cargo:rerun-if-changed=android/oauth-intent.xml");
    // Do not trust NDK detection alone: our NDK 28 diagnostic still produced
    // 4 KiB ELF LOAD segments without an explicit application link policy.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
        tauri_plugin::mobile::update_android_manifest(
            "AHA FREE2Z AUTH",
            "activity",
            include_str!("android/oauth-intent.xml").to_owned(),
        )
        .expect("AHA OAuth callback could not be registered");
    }
    tauri_build::build()
}
