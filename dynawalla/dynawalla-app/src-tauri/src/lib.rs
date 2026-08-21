//! Dynawalla's native shell.
//!
//! It holds the pack runtime and nothing else. Packs are the product; the shell
//! is what installs one, serves one, and keeps it inside its own directory.
//!
//! The `dynawalla-pack` URI scheme is registered here. It is a public API from
//! the first release — the scheme name is baked into every published pack's
//! built JavaScript on every device the pack is installed on — so it is never
//! renamed. See `packs::PACK_SCHEME`.
//!
//! Every command registered below is invoked from exactly one module,
//! `src/packs/native.ts`, and `src/packs/native.test.ts` asserts that the two
//! lists are the same set in both directions. That test exists because of a
//! real failure in this repository's other app: its install manager invokes a
//! delete command the backend never registered, so uninstalled packs stay on
//! disk permanently and nothing anywhere reports a problem.
//!
//! These are application commands, not plugin commands, so Tauri's ACL does not
//! gate them and `capabilities/default.json` has nothing to say about them.
//! That is precisely why the registration test is not optional.

mod packs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // The one plugin. Registering it is half the wiring — without the
        // matching `haptics:allow-impact` grant in `capabilities/default.json`
        // the ACL denies the invoke at runtime and nothing at build time says
        // so. `src/packs/haptics.test.ts` asserts the two move together.
        .plugin(tauri_plugin_haptics::init())
        // Packs that ship with this build are installed before the first window
        // exists, so the front door is never empty on a first launch and a
        // `npm run tauri dev` session always has the freshly built ones.
        .setup(|app| {
            packs::sync_bundled(app.handle());
            Ok(())
        })
        .register_uri_scheme_protocol(packs::PACK_SCHEME, |ctx, request| {
            packs::serve(ctx.app_handle(), &request)
        })
        .invoke_handler(tauri::generate_handler![
            packs::packs_list,
            packs::packs_catalog,
            packs::packs_install,
            packs::packs_remove,
            packs::packs_entry_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running dynawalla");
}
