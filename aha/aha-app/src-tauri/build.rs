fn main() {
    // Do not trust NDK detection alone: our NDK 28 diagnostic still produced
    // 4 KiB ELF LOAD segments without an explicit application link policy.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
    }
    tauri_build::build()
}
