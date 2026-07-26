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
