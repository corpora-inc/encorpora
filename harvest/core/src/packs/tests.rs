use super::*;
use crate::fixture;

fn keys() -> Vec<TrustedKey> {
    vec![fixture::trusted_key()]
}

fn built(version: &str) -> (tempfile::TempDir, PathBuf) {
    let t = tempfile::tempdir().unwrap();
    let dir = t.path().join("src");
    fixture::build(&dir, version).unwrap();
    (t, dir)
}

fn staging_left(root: &Path) -> Vec<String> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(rd) = fs::read_dir(&d) else { continue };
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.starts_with(".staging-") {
                out.push(name);
            } else if e.file_type().unwrap().is_dir() {
                stack.push(e.path());
            }
        }
    }
    out
}

#[test]
fn signature_round_trip_and_tamper() {
    let (_t, dir) = built("2026.1.1-1");
    let m = verify_dir(&dir, &keys()).unwrap();
    assert_eq!(m.pack_id, "fixture");

    // Changing any signed field breaks the signature.
    let path = dir.join(MANIFEST);
    let mut raw: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    raw["version"] = json_str("2026.9.9-9");
    fs::write(&path, serde_json::to_vec(&raw).unwrap()).unwrap();
    assert!(matches!(
        verify_dir(&dir, &keys()),
        Err(Error::Signature(_))
    ));

    // Unsigned.
    raw.as_object_mut().unwrap().remove("signature");
    fs::write(&path, serde_json::to_vec(&raw).unwrap()).unwrap();
    assert!(matches!(
        verify_dir(&dir, &keys()),
        Err(Error::Signature(_))
    ));
}

fn json_str(s: &str) -> Value {
    Value::String(s.into())
}

#[test]
fn untrusted_key_and_no_key_are_refused() {
    let (_t, dir) = built("2026.1.1-1");
    let other = ed25519_dalek::SigningKey::from_bytes(&[7u8; 32]);
    let other_key = TrustedKey::from_bytes(other.verifying_key().as_bytes()).unwrap();
    assert!(matches!(
        verify_dir(&dir, &[other_key]),
        Err(Error::Signature(_))
    ));
    assert!(matches!(verify_dir(&dir, &[]), Err(Error::Signature(_))));

    // Same key id but a different key: still refused.
    let mut forged = other_key_with_id(&fixture::trusted_key().key_id);
    forged.key = other.verifying_key();
    assert!(matches!(
        verify_dir(&dir, &[forged]),
        Err(Error::Signature(_))
    ));
}

fn other_key_with_id(id: &str) -> TrustedKey {
    let mut k = fixture::trusted_key();
    k.key_id = id.to_string();
    k
}

#[test]
fn file_tamper_is_an_integrity_error() {
    let (_t, dir) = built("2026.1.1-1");
    let db = dir.join(fixture::DB_FILE);
    let mut bytes = fs::read(&db).unwrap();
    let n = bytes.len();
    bytes[n - 10] ^= 0xff;
    fs::write(&db, &bytes).unwrap();
    assert!(matches!(
        verify_dir(&dir, &keys()),
        Err(Error::Integrity(_))
    ));
    // Size change too.
    fs::OpenOptions::new()
        .append(true)
        .open(&db)
        .unwrap()
        .write_all(b"x")
        .unwrap();
    assert!(matches!(
        verify_dir(&dir, &keys()),
        Err(Error::Integrity(_))
    ));
}

#[test]
fn manifest_paths_must_stay_inside() {
    for bad in [
        "../x.sqlite",
        "/etc/x.sqlite",
        "a/../../x.sqlite",
        "c:\\x.sqlite",
        "a\\b.sqlite",
        "",
    ] {
        assert!(safe_relative(bad).is_err(), "{bad}");
    }
    assert_eq!(
        safe_relative("a/b.sqlite").unwrap(),
        PathBuf::from("a/b.sqlite")
    );
    assert!(safe_relative("./a").is_err());
}

#[test]
fn version_order() {
    use std::cmp::Ordering::*;
    assert_eq!(compare_versions("2026.11.27-1", "2026.11.27-2"), Less);
    assert_eq!(compare_versions("2026.11.28-1", "2026.11.27-9"), Greater);
    assert_eq!(compare_versions("2026.11.27-10", "2026.11.27-9"), Greater);
    assert_eq!(compare_versions("2026.1.1", "2026.1.1"), Equal);
    assert_eq!(compare_versions("2026.1.1", "2026.1.1-1"), Less);
}

#[test]
fn install_keeps_previous_prunes_older_and_refuses_downgrade() {
    let t = tempfile::tempdir().unwrap();
    let root = t.path().join("packs");
    let (_a, v1) = built("2026.1.1-1");
    let (_b, v2) = built("2026.1.2-1");
    let (_c, v3) = built("2026.1.3-1");

    let i1 = install_dir(&root, &v1, &keys()).unwrap();
    assert!(i1.changed && i1.previous.is_none());
    assert_eq!(
        current_version(&root, "fixture").unwrap().as_deref(),
        Some("2026.1.1-1")
    );

    let i2 = install_dir(&root, &v2, &keys()).unwrap();
    assert_eq!(i2.previous.as_deref(), Some("2026.1.1-1"));
    assert!(root.join("fixture/2026.1.1-1").is_dir(), "previous kept");

    // Reinstalling the current version is a no-op.
    let again = install_dir(&root, &v2, &keys()).unwrap();
    assert!(!again.changed);

    // Downgrade refused; current untouched.
    assert!(matches!(
        install_dir(&root, &v1, &keys()),
        Err(Error::Downgrade { .. })
    ));
    assert_eq!(
        current_version(&root, "fixture").unwrap().as_deref(),
        Some("2026.1.2-1")
    );

    install_dir(&root, &v3, &keys()).unwrap();
    assert!(
        !root.join("fixture/2026.1.1-1").exists(),
        "older than previous pruned"
    );
    assert!(root.join("fixture/2026.1.2-1").is_dir());
    assert!(staging_left(&root).is_empty());

    // The installed pack verifies and its stamp matches.
    let dir = current(&root, "fixture").unwrap().unwrap();
    let m = verify_dir(&dir, &keys()).unwrap();
    assert!(stamp_matches(&dir, &m).unwrap());
}

#[test]
fn a_corrupt_new_version_leaves_the_current_one_active() {
    let t = tempfile::tempdir().unwrap();
    let root = t.path().join("packs");
    let (_a, v1) = built("2026.1.1-1");
    let (_b, v2) = built("2026.1.2-1");
    install_dir(&root, &v1, &keys()).unwrap();
    let db = v2.join(fixture::DB_FILE);
    let mut bytes = fs::read(&db).unwrap();
    bytes[100] ^= 1;
    fs::write(&db, bytes).unwrap();
    assert!(matches!(
        install_dir(&root, &v2, &keys()),
        Err(Error::Integrity(_))
    ));
    assert_eq!(
        current_version(&root, "fixture").unwrap().as_deref(),
        Some("2026.1.1-1")
    );
    assert!(!root.join("fixture/2026.1.2-1").exists());
    assert!(staging_left(&root).is_empty());
    verify_dir(&current(&root, "fixture").unwrap().unwrap(), &keys()).unwrap();
}

fn zip_of(dir: &Path, extra: &[(&str, Vec<u8>)]) -> Vec<u8> {
    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let mut z = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for name in [MANIFEST, fixture::DB_FILE] {
            z.start_file(name, opts).unwrap();
            z.write_all(&fs::read(dir.join(name)).unwrap()).unwrap();
        }
        for (name, bytes) in extra {
            z.start_file(*name, opts).unwrap();
            z.write_all(bytes).unwrap();
        }
        z.finish().unwrap();
    }
    buf.into_inner()
}

#[test]
fn zip_install_and_hostile_archives() {
    let t = tempfile::tempdir().unwrap();
    let root = t.path().join("packs");
    let (_a, v1) = built("2026.1.1-1");
    let good = t.path().join("good.zip");
    fs::write(&good, zip_of(&v1, &[])).unwrap();
    let i = install_zip(&root, &good, &keys(), ArchiveLimits::default()).unwrap();
    assert_eq!(i.version, "2026.1.1-1");

    // zip-slip: an entry that climbs out of the staging directory.
    let (_b, v2) = built("2026.1.2-1");
    let slip = t.path().join("slip.zip");
    fs::write(&slip, zip_of(&v2, &[("../../escaped.txt", b"x".to_vec())])).unwrap();
    assert!(matches!(
        install_zip(&root, &slip, &keys(), ArchiveLimits::default()),
        Err(Error::Archive(_))
    ));
    assert!(!t.path().join("escaped.txt").exists());
    assert!(!root.join("escaped.txt").exists());

    // Absolute path entry.
    let abs = t.path().join("abs.zip");
    fs::write(
        &abs,
        zip_of(&v2, &[("/tmp/harvest-abs.txt", b"x".to_vec())]),
    )
    .unwrap();
    assert!(install_zip(&root, &abs, &keys(), ArchiveLimits::default()).is_err());

    // Bomb: highly compressible bytes over the written-bytes limit.
    let bomb = t.path().join("bomb.zip");
    fs::write(&bomb, zip_of(&v2, &[("zeros.bin", vec![0u8; 4 << 20])])).unwrap();
    let limits = ArchiveLimits {
        max_entries: 16,
        max_total_bytes: 2 << 20,
    };
    assert!(matches!(
        install_zip(&root, &bomb, &keys(), limits),
        Err(Error::Archive(_))
    ));

    // Too many entries.
    let many: Vec<(String, Vec<u8>)> = (0..20).map(|i| (format!("f{i}"), vec![1u8])).collect();
    let many_ref: Vec<(&str, Vec<u8>)> =
        many.iter().map(|(n, b)| (n.as_str(), b.clone())).collect();
    let crowd = t.path().join("crowd.zip");
    fs::write(&crowd, zip_of(&v2, &many_ref)).unwrap();
    assert!(matches!(
        install_zip(
            &root,
            &crowd,
            &keys(),
            ArchiveLimits {
                max_entries: 8,
                max_total_bytes: 1 << 30
            }
        ),
        Err(Error::Archive(_))
    ));

    assert_eq!(
        current_version(&root, "fixture").unwrap().as_deref(),
        Some("2026.1.1-1")
    );
    assert!(staging_left(&root).is_empty());
}

#[test]
fn hex_and_key_parsing() {
    let k = fixture::trusted_key();
    let b64 = fixture::public_key_base64();
    assert_eq!(TrustedKey::parse(&b64).unwrap().key_id, k.key_id);
    let hex = hex_encode(k.key.as_bytes());
    assert_eq!(TrustedKey::parse(&hex).unwrap().key_id, k.key_id);
    assert!(TrustedKey::parse("nope").is_err());
    assert_eq!(k.key_id.len(), 16);
}
