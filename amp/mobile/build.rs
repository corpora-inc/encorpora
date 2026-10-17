fn main() {
    println!("cargo:rerun-if-env-changed=AMP_NATIVE_API_ORIGIN");
    println!("cargo:rerun-if-env-changed=AMP_NATIVE_OIDC_CONFIG");
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "native_status",
            "read_public_resource",
            "native_session",
            "native_sign_in",
            "native_sign_out",
            "native_learning_request",
        ]),
    ))
    .expect("Unable to build native command permissions");
}
