fn main() {
    // `bundle.resources` in tauri.conf.json names `packs` — the built pack
    // bundles that `packs/build.mjs` stages here, so that `npm run tauri dev`
    // starts with every game already installed and no network round trip.
    //
    // That directory is build output: gitignored, absent from a fresh
    // checkout, and produced by a Node pipeline. `tauri_build::build()` copies
    // every declared resource into the target directory UNCONDITIONALLY — on
    // `cargo clippy` and `cargo check` as much as on `cargo build`, since all
    // three run build scripts — and a resource path that does not exist is a
    // hard error ("resource path `packs` doesn't exist"), not a warning.
    //
    // Without this line the crate therefore cannot be compiled or even linted
    // until somebody has run `npm run packs` first, which is what made the
    // Rust gate in CI fail: the `native` job installs a Rust toolchain and no
    // Node one, so it hit a build-script error with zero clippy findings.
    //
    // Creating the directory empty decouples the two. Cargo alone always
    // compiles; the real bundles still arrive exactly as before, because
    // `beforeDevCommand` and `beforeBuildCommand` both run `npm run packs`
    // ahead of cargo, and that script exits non-zero if it finds no pack to
    // stage. So an empty `packs/` can never reach a bundle.
    std::fs::create_dir_all("packs")
        .expect("failed to create the src-tauri/packs bundle-resource directory");

    tauri_build::build()
}
