use harvest_core::delta::{self, TARGET_MANIFEST};
use harvest_core::fixture;
use harvest_core::packs::{self, TrustedKey};
use harvest_core::{Error, Pack};
use std::path::{Path, PathBuf};

fn keys() -> Vec<TrustedKey> {
    vec![fixture::trusted_key()]
}

/// v1, and v2 with one section rewritten and one row added.
fn two_versions(tmp: &Path) -> (PathBuf, PathBuf) {
    let v1 = tmp.join("v1");
    fixture::build(&v1, "2026.1.1-1").unwrap();
    let v2 = tmp.join("v2");
    fixture::build_with(&v2, "2026.1.2-1", |c| {
        c.execute(
            "UPDATE section SET heading = 'Clearance from energized power lines' WHERE section_id = 'ex.2'",
            [],
        )?;
        c.execute(
            "INSERT INTO term VALUES ('t-new', 'tagline', 'A rope to steady a load.', 'ex.2', NULL, 'en', 'prov-fixture')",
            [],
        )?;
        Ok(())
    })
    .unwrap();
    (v1, v2)
}

#[test]
fn a_delta_turns_the_installed_version_into_the_next_byte_for_byte() {
    let tmp = tempfile::tempdir().unwrap();
    let (v1, v2) = two_versions(tmp.path());
    let root = tmp.path().join("installed");
    packs::install_dir(&root, &v1, &keys()).unwrap();

    let d = tmp.path().join("delta");
    let m = delta::make_delta(&v1, &v2, &d, &keys(), Some(&fixture::signing_key())).unwrap();
    assert_eq!(m.base_version.as_deref(), Some("2026.1.1-1"));
    let full: u64 = std::fs::metadata(v2.join(fixture::DB_FILE)).unwrap().len();
    let small: u64 = m.files.iter().map(|f| f.bytes).sum();
    assert!(small < full / 4, "delta {small} bytes vs full {full}");

    let done = delta::install_delta(&root, &d, &keys()).unwrap();
    assert!(done.changed);
    assert_eq!(done.version, "2026.1.2-1");
    assert_eq!(done.previous.as_deref(), Some("2026.1.1-1"));
    assert_eq!(
        packs::sha256_file(&done.dir.join(fixture::DB_FILE)).unwrap(),
        packs::sha256_file(&v2.join(fixture::DB_FILE)).unwrap()
    );
    let pack = Pack::open(&done.dir, &keys()).unwrap();
    assert_eq!(
        pack.section("ex.2").unwrap().unwrap().heading.as_deref(),
        Some("Clearance from energized power lines")
    );
    // Applying it again changes nothing.
    assert!(!delta::install_delta(&root, &d, &keys()).unwrap().changed);
}

#[test]
fn a_delta_needs_its_base() {
    let tmp = tempfile::tempdir().unwrap();
    let (v1, v2) = two_versions(tmp.path());
    let d = tmp.path().join("delta");
    delta::make_delta(&v1, &v2, &d, &keys(), Some(&fixture::signing_key())).unwrap();
    // Nothing installed.
    let empty = tmp.path().join("empty");
    let err = delta::install_delta(&empty, &d, &keys())
        .unwrap_err()
        .to_string();
    assert!(err.contains("install the full pack"), "{err}");
    // A different base installed.
    let other = tmp.path().join("v0");
    fixture::build(&other, "2026.1.0-1").unwrap();
    let root = tmp.path().join("installed");
    packs::install_dir(&root, &other, &keys()).unwrap();
    let err = delta::install_delta(&root, &d, &keys())
        .unwrap_err()
        .to_string();
    assert!(err.contains("needs base 2026.1.1-1"), "{err}");
    // The same base version, but a different build of it.
    let rebaked = tmp.path().join("v1b");
    fixture::build_with(&rebaked, "2026.1.1-1", |c| {
        c.execute(
            "UPDATE section SET heading = 'Rebaked' WHERE section_id = 'ex.2'",
            [],
        )?;
        Ok(())
    })
    .unwrap();
    let root2 = tmp.path().join("installed2");
    packs::install_dir(&root2, &rebaked, &keys()).unwrap();
    let err = delta::install_delta(&root2, &d, &keys())
        .unwrap_err()
        .to_string();
    assert!(
        err.contains("different") && err.contains("full pack"),
        "{err}"
    );
    // Still on the old version.
    assert_eq!(
        packs::current_version(&root, fixture::PACK_ID)
            .unwrap()
            .as_deref(),
        Some("2026.1.0-1")
    );
}

#[test]
fn tampered_unsigned_or_mismatched_deltas_are_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let (v1, v2) = two_versions(tmp.path());
    let root = tmp.path().join("installed");
    packs::install_dir(&root, &v1, &keys()).unwrap();

    // Unsigned: refused until the bake signs it.
    let unsigned = tmp.path().join("unsigned");
    delta::make_delta(&v1, &v2, &unsigned, &keys(), None).unwrap();
    assert!(matches!(
        delta::install_delta(&root, &unsigned, &keys()),
        Err(Error::Signature(_))
    ));

    // A changed patch fails its hash.
    let d = tmp.path().join("delta");
    delta::make_delta(&v1, &v2, &d, &keys(), Some(&fixture::signing_key())).unwrap();
    let patch = d.join(format!("{}.bsdiff", fixture::DB_FILE));
    let mut bytes = std::fs::read(&patch).unwrap();
    let last = bytes.len() - 1;
    bytes[last] ^= 0xff;
    std::fs::write(&patch, bytes).unwrap();
    assert!(matches!(
        delta::install_delta(&root, &d, &keys()),
        Err(Error::Integrity(_))
    ));

    // A target manifest from another version, re-listed and re-signed.
    let d2 = tmp.path().join("delta2");
    delta::make_delta(&v1, &v2, &d2, &keys(), Some(&fixture::signing_key())).unwrap();
    std::fs::copy(v1.join(packs::MANIFEST), d2.join(TARGET_MANIFEST)).unwrap();
    let mut m: serde_json::Value =
        serde_json::from_slice(&std::fs::read(d2.join(packs::MANIFEST)).unwrap()).unwrap();
    for f in m["files"].as_array_mut().unwrap() {
        if f["path"] == TARGET_MANIFEST {
            let p = d2.join(TARGET_MANIFEST);
            f["sha256"] = packs::sha256_file(&p).unwrap().into();
            f["bytes"] = std::fs::metadata(&p).unwrap().len().into();
        }
    }
    packs::sign_manifest(&mut m, &fixture::signing_key()).unwrap();
    std::fs::write(d2.join(packs::MANIFEST), serde_json::to_vec(&m).unwrap()).unwrap();
    let err = delta::install_delta(&root, &d2, &keys())
        .unwrap_err()
        .to_string();
    assert!(err.contains("target manifest"), "{err}");

    // Nothing changed through all of that.
    assert_eq!(
        packs::current_version(&root, fixture::PACK_ID)
            .unwrap()
            .as_deref(),
        Some("2026.1.1-1")
    );
    Pack::open(
        &packs::current(&root, fixture::PACK_ID).unwrap().unwrap(),
        &keys(),
    )
    .unwrap();
}

#[test]
fn make_delta_refuses_backwards_or_foreign_pairs() {
    let tmp = tempfile::tempdir().unwrap();
    let (v1, v2) = two_versions(tmp.path());
    let out = tmp.path().join("out");
    assert!(delta::make_delta(&v2, &v1, &out, &keys(), None).is_err());
    assert!(delta::make_delta(&v1, &v1, &out, &keys(), None).is_err());
}

#[test]
fn cli_makes_and_installs_a_delta() {
    let tmp = tempfile::tempdir().unwrap();
    let (v1, v2) = two_versions(tmp.path());
    let root = tmp.path().join("installed");
    let d = tmp.path().join("delta");
    let run = |args: &[&str], sign: bool| {
        let mut c = std::process::Command::new(env!("CARGO_BIN_EXE_harvest"));
        c.args(args)
            .env("HARVEST_PUBKEY", fixture::public_key_base64());
        if sign {
            use base64::Engine as _;
            c.env(
                "HARVEST_SIGNING_KEY",
                base64::engine::general_purpose::STANDARD.encode(fixture::signing_key().to_bytes()),
            );
        } else {
            c.env_remove("HARVEST_SIGNING_KEY");
        }
        let out = c.output().unwrap();
        (
            out.status.code().unwrap_or(-1),
            String::from_utf8_lossy(&out.stdout).into_owned(),
        )
    };
    let s = |p: &Path| p.to_str().unwrap().to_string();
    let (code, _) = run(&["install", &s(&root), &s(&v1), "--json"], false);
    assert_eq!(code, 0);
    let (code, out) = run(&["delta", &s(&v1), &s(&v2), &s(&d), "--json"], true);
    assert_eq!(code, 0, "{out}");
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&out).unwrap()["signed"],
        true
    );
    let (code, out) = run(&["install", &s(&root), &s(&d), "--json"], false);
    assert_eq!(code, 0, "{out}");
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(
        (v["version"].as_str(), v["delta"].as_bool()),
        (Some("2026.1.2-1"), Some(true))
    );
}
