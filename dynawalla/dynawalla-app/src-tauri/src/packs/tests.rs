//! The path and archive rules, exercised against a real filesystem.
//!
//! Every one of these is a hole that a string check would leave open. They run
//! under `cargo test` in seconds and none of them needs a WebView, which is the
//! point: the parts of the pack runtime that can be tested without a device are
//! exactly the parts that are dangerous.

use super::*;
use std::io::Write;

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("dynawalla-packs-test-{name}-{}", now_millis()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("scratch");
    dir
}

#[test]
fn pack_ids_are_directory_names_and_are_treated_as_such() {
    for id in ["abacus", "abacus.tower", "abacus-tower", "a1.b2-c3"] {
        assert!(valid_pack_id(id), "{id} should be valid");
    }
    for id in [
        "",
        ".",
        "..",
        "../etc",
        "Abacus",
        "abacus/tower",
        "abacus tower",
        "abacus.",
        "-abacus",
        "9lives",
        "abacus..tower",
        "abacus\\tower",
        "abacus\0",
    ] {
        assert!(!valid_pack_id(id), "{id:?} should be refused");
    }
    assert!(!valid_pack_id(&"a".repeat(65)));
}

#[test]
fn an_asset_path_cannot_leave_the_pack_directory() {
    let root = scratch("resolve");
    let pack = root.join("abacus");
    fs::create_dir_all(pack.join("dist")).unwrap();
    fs::write(pack.join("dist/app.js"), b"ok").unwrap();
    fs::write(root.join("secret.txt"), b"no").unwrap();

    assert!(resolve_asset(&pack, "dist/app.js").is_some());
    for bad in [
        "../secret.txt",
        "dist/../../secret.txt",
        "./dist/app.js",
        "",
        "dist",
        "dist\\app.js",
        "/dist/app.js",
        "dist/app.js\0",
    ] {
        assert!(resolve_asset(&pack, bad).is_none(), "{bad:?} resolved");
    }
    let _ = fs::remove_dir_all(&root);
}

#[cfg(unix)]
#[test]
fn a_symlink_out_of_the_pack_is_refused_although_its_path_looks_innocent() {
    // The case the `..`-in-the-string check cannot see, and the reason
    // `resolve_asset` canonicalises. `escape.txt` contains no traversal at all.
    let root = scratch("symlink");
    let pack = root.join("abacus");
    fs::create_dir_all(&pack).unwrap();
    fs::write(root.join("secret.txt"), b"no").unwrap();
    std::os::unix::fs::symlink(root.join("secret.txt"), pack.join("escape.txt")).unwrap();

    assert!(!pack.join("escape.txt").to_string_lossy().contains(".."));
    assert!(
        resolve_asset(&pack, "escape.txt").is_none(),
        "symlink escaped"
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn zip_entry_names_that_escape_are_rejected_before_anything_is_created() {
    for name in [
        "../evil.js",
        "a/../../evil.js",
        "/etc/passwd",
        "..\\evil.js",
        "C:\\Windows\\evil.js",
        "",
        "\0",
        "..",
    ] {
        assert!(safe_entry_path(name).is_none(), "{name:?} was accepted");
    }
    assert_eq!(
        safe_entry_path("index.html"),
        Some(PathBuf::from("index.html"))
    );
    assert_eq!(
        safe_entry_path("dist/app.js"),
        Some(PathBuf::from("dist/app.js"))
    );
    assert_eq!(
        safe_entry_path("./dist/app.js"),
        Some(PathBuf::from("dist/app.js"))
    );
}

fn zip_of(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut buffer = std::io::Cursor::new(Vec::new());
    {
        let mut writer = zip::ZipWriter::new(&mut buffer);
        let options: zip::write::FileOptions<'_, ()> =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        for (name, body) in entries {
            writer.start_file(*name, options).unwrap();
            writer.write_all(body).unwrap();
        }
        writer.finish().unwrap();
    }
    buffer.into_inner()
}

#[test]
fn a_normal_archive_extracts() {
    let dir = scratch("extract");
    let archive = zip_of(&[
        ("manifest.json", br#"{"id":"abacus","version":"1.0.0"}"#),
        ("dist/app.js", b"console.log(1)"),
    ]);
    extract(&archive, &dir).expect("extract");
    assert_eq!(
        fs::read_to_string(dir.join("dist/app.js")).unwrap(),
        "console.log(1)"
    );
    let installed = read_installed(&dir).expect("manifest");
    assert_eq!(installed.id, "abacus");
    assert_eq!(installed.version, "1.0.0");
    assert!(installed.bytes > 0);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn a_zip_slip_archive_is_refused_and_writes_nothing_outside() {
    let root = scratch("slip");
    let dir = root.join("into");
    fs::create_dir_all(&dir).unwrap();
    let archive = zip_of(&[("../owned.js", b"pwn")]);

    let problem = extract(&archive, &dir).expect_err("zip slip extracted");
    assert!(problem.contains("escapes"), "{problem}");
    assert!(
        !root.join("owned.js").exists(),
        "a file was written outside the destination"
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn an_archive_that_expands_past_the_ceiling_is_refused() {
    // A zip bomb in miniature: 64 KB of zeroes compresses to a few hundred
    // bytes, and the ceiling is applied to what comes OUT, so the compressed
    // size the archive advertises is not consulted and cannot lie.
    let dir = scratch("bomb");
    let archive = zip_of(&[("big.bin", &vec![0u8; 64 * 1024])]);
    assert!(
        archive.len() < 4096,
        "the fixture is not actually compressed"
    );

    let problem = extract_within(&archive, &dir, MAX_FILES, 4096).expect_err("the bomb extracted");
    assert!(problem.contains("installed-size limit"), "{problem}");

    // And the same archive is fine under the real ceiling.
    extract(&archive, &dir).expect("64 KB is not a bomb at 512 MB");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn an_archive_with_too_many_entries_is_refused_before_any_of_them_is_read() {
    let dir = scratch("many");
    let bodies: Vec<(String, Vec<u8>)> = (0..5)
        .map(|i| (format!("f{i}.txt"), b"x".to_vec()))
        .collect();
    let borrowed: Vec<(&str, &[u8])> = bodies
        .iter()
        .map(|(n, b)| (n.as_str(), b.as_slice()))
        .collect();
    let archive = zip_of(&borrowed);

    let problem = extract_within(&archive, &dir, 4, MAX_INSTALLED_BYTES).expect_err("accepted");
    assert!(problem.contains("more than 4 entries"), "{problem}");
    assert!(
        !dir.join("f0.txt").exists(),
        "an entry was written before the count was checked"
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn an_empty_archive_is_not_a_pack() {
    let dir = scratch("empty");
    let problem = extract(&zip_of(&[]), &dir).expect_err("empty archive accepted");
    assert!(problem.contains("empty"), "{problem}");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn an_archive_without_a_manifest_has_no_identity() {
    let dir = scratch("noman");
    extract(&zip_of(&[("index.html", b"<!doctype html>")]), &dir).unwrap();
    assert!(read_installed(&dir).is_none());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn the_pack_policy_admits_no_remote_origin_and_never_says_self() {
    let policy = pack_csp();
    assert!(policy.starts_with("default-src 'none'"));
    for directive in [
        "script-src",
        "style-src",
        "img-src",
        "media-src",
        "font-src",
        "connect-src",
        "worker-src",
    ] {
        assert!(policy.contains(directive), "missing {directive}");
    }
    // `'self'` is an opaque origin inside the sandbox: it would match nothing.
    assert!(
        !policy.contains("'self'"),
        "'self' is meaningless in an opaque-origin frame"
    );
    // No network. This is the property, stated as an assertion.
    assert!(!policy.contains("https://"));
    assert!(!policy.contains("http://") || policy.contains("http://dynawalla-pack.localhost"));
    for remote in [
        "*",
        "data: script-src",
        "'unsafe-eval'",
        "'unsafe-inline' ; script",
    ] {
        assert!(!policy.contains(remote), "policy admits {remote}");
    }
    assert!(
        policy.contains("frame-src 'none'"),
        "a pack may not frame anything"
    );
    assert!(policy.contains("form-action 'none'"));
    assert!(policy.contains("base-uri 'none'"));
}

#[test]
fn scripts_are_external_only_and_wasm_is_allowed() {
    let policy = pack_csp();
    let script = policy
        .split(';')
        .map(str::trim)
        .find(|d| d.starts_with("script-src"))
        .expect("script-src");
    assert!(
        !script.contains("'unsafe-inline'"),
        "inline script in a pack"
    );
    assert!(
        script.contains("'wasm-unsafe-eval'"),
        "3D packs need WebAssembly"
    );
}

#[test]
fn content_types_are_declared_rather_than_sniffed() {
    assert_eq!(
        content_type_for(Path::new("a/index.html")),
        "text/html; charset=utf-8"
    );
    assert_eq!(
        content_type_for(Path::new("a/app.JS")),
        "text/javascript; charset=utf-8"
    );
    assert_eq!(
        content_type_for(Path::new("a/model.glb")),
        "model/gltf-binary"
    );
    assert_eq!(content_type_for(Path::new("a/x.wasm")), "application/wasm");
    assert_eq!(
        content_type_for(Path::new("a/unknown")),
        "application/octet-stream"
    );
}

#[test]
fn an_entry_url_names_the_pack_scheme_and_refuses_a_traversal() {
    let url = packs_entry_url("abacus".into(), "index.html".into()).unwrap();
    assert!(url.contains("abacus/index.html"), "{url}");
    assert!(url.contains(PACK_SCHEME), "{url}");
    assert!(packs_entry_url("../etc".into(), "index.html".into()).is_err());
    assert!(packs_entry_url("abacus".into(), "../../etc/passwd".into()).is_err());
    assert!(packs_entry_url("abacus".into(), "".into()).is_err());
}

#[test]
fn the_download_origin_is_pinned_to_one_https_prefix() {
    assert!(PACK_ORIGIN.starts_with("https://"));
    assert!(
        PACK_ORIGIN.ends_with('/'),
        "a prefix without a trailing slash matches a sibling host"
    );
}

// ─── Bundled packs ───────────────────────────────────────────────────────────

fn manifest_json(id: &str, version: &str, digest: Option<&str>) -> String {
    match digest {
        Some(digest) => format!(
            r#"{{"schema":1,"id":"{id}","version":"{version}","download":{{"bytes":10,"sha256":"{digest}"}}}}"#
        ),
        None => format!(r#"{{"schema":1,"id":"{id}","version":"{version}"}}"#),
    }
}

#[test]
fn a_content_fix_that_keeps_the_version_still_reaches_the_device() {
    // The defect this replaced: `0.1.0` on both sides, different bytes, and the
    // corrected pack never left the binary because the two versions matched.
    let installed = manifest_json("abacus", "0.1.0", Some(&"a".repeat(64)));
    let fixed = manifest_json("abacus", "0.1.0", Some(&"b".repeat(64)));
    assert!(
        bundled_pack_differs("abacus", Some(&installed), &fixed),
        "a same-version content fix was skipped"
    );
}

#[test]
fn a_pack_that_has_not_changed_is_left_where_it_is() {
    let digest = "c".repeat(64);
    let installed = manifest_json("abacus", "0.1.0", Some(&digest));
    let bundled = manifest_json("abacus", "0.9.9", Some(&digest));
    assert!(
        !bundled_pack_differs("abacus", Some(&installed), &bundled),
        "identical content was rewritten on a cold start"
    );
    // And the digest is compared case-insensitively, because hex is.
    let shouting = manifest_json("abacus", "0.1.0", Some(&digest.to_ascii_uppercase()));
    assert!(!bundled_pack_differs(
        "abacus",
        Some(&shouting),
        &manifest_json("abacus", "0.1.0", Some(&digest))
    ));
}

#[test]
fn nothing_installed_means_install() {
    let bundled = manifest_json("abacus", "0.1.0", Some(&"d".repeat(64)));
    assert!(bundled_pack_differs("abacus", None, &bundled));
    assert!(bundled_pack_differs("abacus", Some("not json"), &bundled));
    assert!(bundled_pack_differs("abacus", Some(&bundled), "not json"));
}

#[test]
fn a_manifest_with_no_digest_falls_back_to_the_version() {
    let old = manifest_json("abacus", "0.1.0", None);
    let new = manifest_json("abacus", "0.2.0", None);
    assert!(bundled_pack_differs("abacus", Some(&old), &new));
    assert!(!bundled_pack_differs("abacus", Some(&old), &old));
    // One side missing it is enough to lose the digest comparison.
    let digested = manifest_json("abacus", "0.1.0", Some(&"e".repeat(64)));
    assert!(!bundled_pack_differs("abacus", Some(&old), &digested));
}

/// A plausible `/proc/self/maps` for this app on Android, installed from an app
/// bundle. The library is in the ABI split; the assets are in `base.apk` beside
/// it; and the system WebView — another application's APK entirely — is mapped
/// into the process too, as it always is.
const ANDROID_MAPS: &str = concat!(
    "6f2a000000-6f2a1f4000 r--p 00000000 fd:03 1234 /apex/com.android.runtime/lib64/bionic/libc.so\n",
    "7000000000-7000010000 rw-p 00000000 00:00 0 [anon:.bss]\n",
    "7100000000-71ff000000 r--p 00000000 fd:03 4242 /data/app/~~Web==/com.google.android.trichromelibrary_1-a==/base.apk\n",
    "7a00000000-7a00123000 r--p 00000000 fd:03 5678 /data/app/~~AbC==/inc.corpora.dynawalla-XyZ==/split_config.arm64_v8a.apk\n",
    "7b00000000-7b00123000 r-xp 00100000 fd:03 5678 /data/app/~~AbC==/inc.corpora.dynawalla-XyZ==/split_config.arm64_v8a.apk\n",
);

/// An address inside the executable segment of the split above.
const OWN_CODE: usize = 0x007b_0000_0100;

#[test]
fn the_apk_beside_a_split_is_preferred_over_the_split_itself() {
    // A Play install of an app bundle: the native library is mapped out of the
    // ABI split, and every asset — the packs among them — is in `base.apk`
    // beside it. Reading the split would find nothing.
    let candidates = apk_candidates(ANDROID_MAPS, OWN_CODE);
    assert_eq!(
        candidates.first().map(|p| p.to_string_lossy().to_string()),
        Some("/data/app/~~AbC==/inc.corpora.dynawalla-XyZ==/base.apk".to_string()),
        "{candidates:?}"
    );
    assert!(
        candidates.contains(&PathBuf::from(
            "/data/app/~~AbC==/inc.corpora.dynawalla-XyZ==/split_config.arm64_v8a.apk"
        )),
        "the split itself is still worth trying: {candidates:?}"
    );
    // Each candidate appears once however many segments were mapped.
    let mut unique = candidates.clone();
    unique.dedup();
    assert_eq!(unique.len(), candidates.len(), "{candidates:?}");
}

#[test]
fn another_applications_apk_is_never_opened_first() {
    // The system WebView's APK is mapped into every Android app process and is
    // hundreds of megabytes. Opening it before our own would read a central
    // directory to match, before the first window, on every single launch.
    let candidates = apk_candidates(ANDROID_MAPS, OWN_CODE);
    let webview = candidates
        .iter()
        .position(|c| c.to_string_lossy().contains("trichromelibrary"))
        .expect("the WebView is still a candidate of last resort");
    assert!(webview > 0, "{candidates:?}");
    assert!(
        candidates[..webview]
            .iter()
            .all(|c| c.to_string_lossy().contains("inc.corpora.dynawalla")),
        "{candidates:?}"
    );
}

#[test]
fn an_extracted_library_and_a_library_inside_the_apk_both_name_the_install() {
    let extracted = apk_candidates(
        "7a00000000-7a00123000 r-xp 00000000 fd:03 1 \
         /data/app/~~q==/inc.corpora.dynawalla-w==/lib/arm64/libdynawalla_lib.so\n",
        0x007a_0000_0100,
    );
    assert_eq!(
        extracted,
        vec![PathBuf::from(
            "/data/app/~~q==/inc.corpora.dynawalla-w==/base.apk"
        )]
    );

    // `extractNativeLibs=false`: the library is mapped from inside the archive,
    // and everything after the `!` is a path within it.
    let inside = apk_candidates(
        "7a00000000-7a00123000 r-xp 00000000 fd:03 1 \
         /data/app/~~q==/inc.corpora.dynawalla-w==/base.apk!/lib/arm64-v8a/libdynawalla_lib.so\n",
        0x007a_0000_0100,
    );
    assert_eq!(
        inside,
        vec![PathBuf::from(
            "/data/app/~~q==/inc.corpora.dynawalla-w==/base.apk"
        )]
    );
}

#[test]
fn an_ordinary_desktop_maps_file_proposes_no_apk() {
    // The Android path is compiled on every target, so it has to be inert on
    // the ones that are full of shared objects and have no APK anywhere.
    let maps = concat!(
        "5600000000-5600100000 r-xp 00000000 08:01 1 /usr/bin/dynawalla\n",
        "7f0000000000-7f0000100000 r-xp 00000000 08:01 2 /usr/lib/x86_64-linux-gnu/libssl.so.3\n",
        "7f1000000000-7f1000100000 r-xp 00000000 08:01 3 /home/kid/build/target/debug/deps/libfoo.so\n",
        "7ffd00000000-7ffd00021000 rw-p 00000000 00:00 0 [stack]\n",
    );
    assert!(
        apk_candidates(maps, 0x7f00_0000_0100).is_empty(),
        "{:?}",
        apk_candidates(maps, 0x7f00_0000_0100)
    );
}

#[test]
fn the_real_address_of_this_code_selects_the_mapping_that_holds_it() {
    // `own_code_address` is a genuine code address here, not a fixture, so this
    // exercises the one link that a hand-written maps file cannot: that the
    // number the cast produces is the kind of number the parser compares
    // against. Only the mapping is fabricated, and it is fabricated AROUND the
    // real address.
    let own = own_code_address();
    assert!(own > 0);
    let maps = format!(
        "{:x}-{:x} r--p 00000000 fd:03 1 /data/app/~~w==/other.app-x==/base.apk\n\
         {:x}-{:x} r-xp 00000000 fd:03 2 /data/app/~~y==/inc.corpora.dynawalla-z==/split_config.arm64_v8a.apk\n",
        own.saturating_sub(0x4000),
        own.saturating_sub(0x2000),
        own.saturating_sub(0x1000),
        own + 0x1000,
    );
    assert_eq!(
        apk_candidates(&maps, own).first(),
        Some(&PathBuf::from(
            "/data/app/~~y==/inc.corpora.dynawalla-z==/base.apk"
        )),
        "the mapping holding this very function did not win"
    );
}

#[test]
fn our_own_code_is_inside_a_mapping_this_parser_can_find() {
    // And on the one platform where `/proc/self/maps` exists at all, the real
    // file really does contain the real address. Skipped elsewhere rather than
    // faked: a macOS run has nothing to say about this.
    let Ok(maps) = fs::read_to_string(PROC_SELF_MAPS) else {
        return;
    };
    let own = own_code_address();
    assert!(
        maps.lines()
            .filter_map(|line| mapped_range(line.split_whitespace().next().unwrap_or("")))
            .any(|(low, high)| own >= low && own < high),
        "no mapping contains {own:#x}"
    );
}

#[test]
fn packs_are_installed_out_of_an_apk_because_android_has_no_resource_directory() {
    // The blocker, end to end without a device: `resource_dir()` on Android is
    // the string `asset://localhost/`, so the packs are read out of the APK,
    // which is a ZIP with the packs under `assets/packs/`.
    let root = scratch("apk");
    let manifest = manifest_json("dynawalla.fuse", "0.1.0", Some(&"f".repeat(64)));
    let archive = zip_of(&[
        ("AndroidManifest.xml", b"binary xml"),
        ("classes.dex", b"dex"),
        ("assets/tauri.conf.json", b"{}"),
        (
            "assets/packs/dynawalla.fuse/manifest.json",
            manifest.as_bytes(),
        ),
        ("assets/packs/dynawalla.fuse/pack.html", b"<!doctype html>"),
        ("assets/packs/dynawalla.fuse/dist/app.js", b"console.log(1)"),
        // Not a pack id, so not a directory this host will ever serve.
        ("assets/packs/NotAPack/x.js", b"no"),
        ("lib/arm64-v8a/libdynawalla_lib.so", b"elf"),
    ]);

    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(archive)).expect("apk");
    sync_from_zip(&mut zip, &root);

    let installed = root.join("dynawalla.fuse");
    assert_eq!(
        fs::read_to_string(installed.join("dist/app.js")).unwrap(),
        "console.log(1)"
    );
    assert_eq!(
        fs::read_to_string(installed.join("pack.html")).unwrap(),
        "<!doctype html>"
    );
    let identity = read_installed(&installed).expect("manifest");
    assert_eq!(identity.id, "dynawalla.fuse");
    assert_eq!(identity.version, "0.1.0");
    assert!(
        !root.join("NotAPack").exists(),
        "an invalid id was installed"
    );
    assert!(!root.join("tauri.conf.json").exists());
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn an_apk_entry_that_escapes_its_pack_installs_nothing_at_all() {
    let root = scratch("apkslip");
    fs::create_dir_all(&root).unwrap();
    let manifest = manifest_json("abacus", "0.1.0", Some(&"0".repeat(64)));
    let archive = zip_of(&[
        ("assets/packs/abacus/manifest.json", manifest.as_bytes()),
        ("assets/packs/abacus/../../owned.js", b"pwn"),
    ]);

    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(archive)).expect("apk");
    sync_from_zip(&mut zip, &root);

    assert!(!root.join("owned.js").exists(), "a file escaped the pack");
    assert!(
        !root.join("abacus").exists(),
        "a half-installed pack was left behind"
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn an_apk_without_bundled_packs_installs_nothing() {
    let root = scratch("apkempty");
    let archive = zip_of(&[("classes.dex", b"dex"), ("assets/tauri.conf.json", b"{}")]);
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(archive)).expect("apk");
    sync_from_zip(&mut zip, &root);
    assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
    let _ = fs::remove_dir_all(&root);
}
