//! `harvest`: the CLI evaluation and the bake verifier call. It runs exactly
//! the library code the app runs in-process. See CONTRACT "Core CLI".

use harvest_core::embed::Embedder;
use harvest_core::{
    AskOptions, Engine, Error, HashingEmbedder, Pack, Role, SearchOptions, Segment, TrustedKey,
};
use serde_json::json;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Instant;

const USAGE: &str = "usage:
  harvest verify  <pack-dir> [--pubkey KEY] [--json]
  harvest search  <pack-dir> \"<query>\" [--k 10] [--equip ID] [--in rules|tree [--exams FILE]] [--embedder auto|none|hashing|<file.gguf>|<url> [--embedder-gguf FILE|--embedder-sha256 HEX]] [--pubkey KEY] [--json]
  harvest ask     <pack-dir> \"<question>\" [--role operator] [--equip ID] [--llm off|http://host:port/v1]
                  [--llm-model NAME] [--embedder auto|none|hashing|<file.gguf>|<url> [--embedder-gguf FILE|--embedder-sha256 HEX]] [--audit <records-db> [--records-key FILE]]
                  [--support-threshold X (coverage-only gate)] [--dense-gate COVERAGE:MIN_DENSE|off] [--pubkey KEY] [--json]
  harvest audit   <records-db> [--records-key FILE] [--json]
  harvest outbox  <records-db> [--to <dir>] [--records-key FILE] [--json]   # queue status; --to flushes it into a folder
  harvest install <root> <pack-or-delta-dir> [--pubkey KEY] [--json]   # full or delta, verified, atomic
  harvest delta   <base-dir> <target-dir> <out-dir> [--pubkey KEY] [--json]
                  # signs with $HARVEST_SIGNING_KEY (base64 ed25519 seed) when set, else writes it unsigned
  harvest show    <pack-dir> info|sections|topics|skills|lessons|terms|diagrams|questions|procedures|answers|exams|prereqs|starters|tree
                  [--id ID] [--role operator] [--exams FILE] [--pubkey KEY]   # verified content as JSON (what the app reads)
  harvest converse <pack-dir> <script.json|-> [--exams FILE] [--llm off|URL [--llm-model NAME]] [--embedder …] [--pubkey KEY]
                  # scripted Instructor conversations (CONTRACT \"Instructor turns\"), one JSON line each
  harvest fixture <dir> [--version V]     # writes the test-only fixture pack

KEY: base64 or hex ed25519 public key, or a file holding one; repeatable or
comma-separated. Defaults to $HARVEST_PUBKEY.";

struct Args {
    positional: Vec<String>,
    flags: Vec<(String, Option<String>)>,
}

impl Args {
    fn parse(raw: Vec<String>) -> Result<Self, String> {
        let mut positional = Vec::new();
        let mut flags = Vec::new();
        let mut it = raw.into_iter();
        while let Some(a) = it.next() {
            if let Some(name) = a.strip_prefix("--") {
                if name == "json" || name == "help" {
                    flags.push((name.to_string(), None));
                } else if let Some((k, v)) = name.split_once('=') {
                    flags.push((k.to_string(), Some(v.to_string())));
                } else {
                    let v = it.next().ok_or(format!("--{name} needs a value"))?;
                    flags.push((name.to_string(), Some(v)));
                }
            } else {
                positional.push(a);
            }
        }
        Ok(Self { positional, flags })
    }
    fn has(&self, name: &str) -> bool {
        self.flags.iter().any(|(k, _)| k == name)
    }
    fn get(&self, name: &str) -> Option<&str> {
        self.flags
            .iter()
            .rev()
            .find(|(k, _)| k == name)
            .and_then(|(_, v)| v.as_deref())
    }
    fn all(&self, name: &str) -> Vec<&str> {
        self.flags
            .iter()
            .filter(|(k, _)| k == name)
            .filter_map(|(_, v)| v.as_deref())
            .collect()
    }
    fn reject_unknown(&self, known: &[&str]) -> Result<(), String> {
        for (k, _) in &self.flags {
            if !known.contains(&k.as_str()) {
                return Err(format!("unknown option --{k}"));
            }
        }
        Ok(())
    }
}

fn main() -> ExitCode {
    let raw: Vec<String> = std::env::args().skip(1).collect();
    let Some(cmd) = raw.first().cloned() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    let args = match Args::parse(raw[1..].to_vec()) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("harvest: {e}\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    let json_out = args.has("json");
    let result = match cmd.as_str() {
        "verify" => verify(&args),
        "install" => install(&args),
        "delta" => delta(&args),
        "search" => search(&args),
        "ask" => ask(&args),
        "audit" => audit(&args),
        "outbox" => outbox(&args),
        "fixture" => fixture(&args),
        "show" => show(&args),
        "converse" => converse(&args),
        "help" | "--help" | "-h" => {
            println!("{USAGE}");
            return ExitCode::SUCCESS;
        }
        other => Err(CliError::Usage(format!("unknown command {other:?}"))),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(CliError::Usage(m)) => {
            eprintln!("harvest: {m}\n{USAGE}");
            ExitCode::from(2)
        }
        Err(CliError::Exit(code)) => ExitCode::from(code),
        Err(CliError::Engine(e)) => {
            if json_out {
                println!("{}", json!({"ok": false, "error": e.to_string()}));
            }
            eprintln!("harvest: {e}");
            ExitCode::from(1)
        }
    }
}

enum CliError {
    Usage(String),
    Engine(Error),
    /// Already reported on stdout/stderr; exit with this code.
    Exit(u8),
}

impl From<Error> for CliError {
    fn from(e: Error) -> Self {
        Self::Engine(e)
    }
}

impl From<String> for CliError {
    fn from(e: String) -> Self {
        Self::Usage(e)
    }
}

fn keys(args: &Args) -> Result<Vec<TrustedKey>, CliError> {
    let mut specs: Vec<String> = args.all("pubkey").iter().map(|s| s.to_string()).collect();
    if specs.is_empty()
        && let Ok(env) = std::env::var("HARVEST_PUBKEY")
    {
        specs.push(env);
    }
    let mut out = Vec::new();
    for spec in specs.iter().flat_map(|s| s.split(',')) {
        let spec = spec.trim();
        if spec.is_empty() {
            continue;
        }
        let text = if Path::new(spec).is_file() {
            std::fs::read_to_string(spec).map_err(Error::from)?
        } else {
            spec.to_string()
        };
        out.push(TrustedKey::parse(&text)?);
    }
    if out.is_empty() {
        return Err(CliError::Engine(Error::Signature(
            "no trusted public key: pass --pubkey or set HARVEST_PUBKEY".into(),
        )));
    }
    Ok(out)
}

fn pack_dir(args: &Args) -> Result<PathBuf, CliError> {
    let p = PathBuf::from(
        args.positional
            .first()
            .ok_or_else(|| CliError::Usage("missing <pack-dir>".into()))?,
    );
    // Accept the .sqlite or manifest path too.
    Ok(if p.is_file() {
        p.parent().map(Path::to_path_buf).unwrap_or(p)
    } else {
        p
    })
}

fn embedder(args: &Args, pack: &Pack) -> Result<Option<Arc<dyn Embedder>>, CliError> {
    match args.get("embedder").unwrap_or("auto") {
        "none" => Ok(None),
        "hashing" | "auto" => {
            let dim = pack.meta("embed_dim").and_then(|d| d.parse::<usize>().ok());
            let id = pack.meta("embedder_id").unwrap_or("");
            match dim {
                Some(dim) if id == format!("hashing-v1-{dim}") => {
                    Ok(Some(Arc::new(HashingEmbedder::new(dim))))
                }
                _ if args.get("embedder") == Some("hashing") => Err(CliError::Engine(
                    Error::Embed(format!("pack embedder is {id:?}, not hashing-v1")),
                )),
                _ => Ok(None),
            }
        }
        path if path.ends_with(".gguf") => gguf_embedder(path, pack),
        url if url.starts_with("http://") || url.starts_with("https://") => {
            // The id must name the weights the server loaded: hash the file
            // when it is here, or take its declared SHA-256.
            let sha = match (args.get("embedder-gguf"), args.get("embedder-sha256")) {
                (Some(_), Some(_)) => {
                    return Err(CliError::Usage(
                        "give --embedder-gguf or --embedder-sha256, not both".into(),
                    ));
                }
                (Some(path), None) => harvest_core::packs::sha256_file(Path::new(path))?,
                (None, Some(sha)) => sha.to_string(),
                (None, None) => {
                    return Err(CliError::Usage(
                        "--embedder <url> needs --embedder-gguf FILE or --embedder-sha256 HEX (the GGUF the server loaded)".into(),
                    ));
                }
            };
            let e = harvest_core::embed::ServerEmbedder::for_pack(
                url,
                pack,
                &sha,
                std::time::Duration::from_secs(60),
            )?;
            Ok(Some(Arc::new(e)))
        }
        other => Err(CliError::Usage(format!("unknown embedder {other:?}"))),
    }
}

#[cfg(feature = "llama")]
fn gguf_embedder(path: &str, pack: &Pack) -> Result<Option<Arc<dyn Embedder>>, CliError> {
    let e = harvest_core::llama::LlamaEmbedder::for_pack(Path::new(path), pack)?;
    Ok(Some(Arc::new(e)))
}

#[cfg(not(feature = "llama"))]
fn gguf_embedder(_: &str, _: &Pack) -> Result<Option<Arc<dyn Embedder>>, CliError> {
    Err(CliError::Usage(
        "a .gguf embedder needs a build with `--features llama`".into(),
    ))
}

fn verify(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&["pubkey", "json"])?;
    let dir = pack_dir(args)?;
    let started = Instant::now();
    let pack = Pack::open(&dir, &keys(args)?)?;
    let counts = pack.row_counts()?;
    let elapsed = started.elapsed().as_millis() as u64;
    if args.has("json") {
        println!(
            "{}",
            json!({
                "ok": true,
                "pack_id": pack.pack_id(),
                "version": pack.version(),
                "schema_version": pack.manifest().schema_version,
                "files": pack.manifest().files,
                "embedder_id": pack.meta("embedder_id"),
                "row_counts": counts,
                "elapsed_ms": elapsed,
            })
        );
    } else {
        println!(
            "ok {} {} (schema {}, {} files, {} ms)",
            pack.pack_id(),
            pack.version(),
            pack.manifest().schema_version,
            pack.manifest().files.len(),
            elapsed
        );
        for (t, n) in counts {
            println!("  {t}: {n}");
        }
    }
    Ok(())
}

fn query_arg(args: &Args) -> Result<String, CliError> {
    args.positional
        .get(1)
        .cloned()
        .ok_or_else(|| CliError::Usage("missing query".into()))
}

fn search(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&[
        "pubkey",
        "json",
        "k",
        "equip",
        "embedder",
        "embedder-gguf",
        "embedder-sha256",
        "in",
        "exams",
    ])?;
    let dir = pack_dir(args)?;
    let query = query_arg(args)?;
    let pack = Arc::new(Pack::open(&dir, &keys(args)?)?);
    let mut engine = Engine::new(pack.clone());
    if let Some(e) = embedder(args, &pack)? {
        engine = engine.with_embedder(e);
    }
    let k = match args.get("k") {
        Some(k) => k
            .parse()
            .map_err(|_| CliError::Usage("--k must be a number".into()))?,
        None => 10,
    };
    let started = Instant::now();
    let opts = SearchOptions {
        k,
        equip: args.get("equip").map(str::to_string),
        ..SearchOptions::default()
    };
    match args.get("in").unwrap_or("rules") {
        "rules" => {}
        "tree" => {
            let tree = harvest_core::course::CourseTree::from_pack(&pack, exams_arg(args)?)?;
            let hits = tree.search(&engine.retriever(), &query, k)?;
            let elapsed = started.elapsed().as_millis() as u64;
            if args.has("json") {
                println!(
                    "{}",
                    json!({"query": query, "derived": tree.derived, "hits": hits, "elapsed_ms": elapsed})
                );
            } else {
                for (i, h) in hits.iter().enumerate() {
                    println!(
                        "{:>2}. {:.4} lex {:.2} dense {:.2}  {} [{}] {}",
                        i + 1,
                        h.score,
                        h.lexical,
                        h.dense,
                        h.node_id,
                        h.level,
                        h.title
                    );
                }
            }
            return Ok(());
        }
        other => {
            return Err(CliError::Usage(format!(
                "--in {other}: expected rules or tree"
            )));
        }
    }
    let result = engine.retriever().search(&query, &opts)?;
    let elapsed = started.elapsed().as_millis() as u64;
    if args.has("json") {
        let mut v = serde_json::to_value(&result).map_err(Error::from)?;
        v["pack_version"] = json!(pack.version());
        v["elapsed_ms"] = json!(elapsed);
        println!("{v}");
    } else {
        for (i, h) in result.hits.iter().enumerate() {
            let cite = match &h.section_id {
                Some(s) => pack.section(s)?.map(|s| s.citation).unwrap_or_default(),
                None => String::new(),
            };
            println!(
                "{:>2}. {:.4} lex {:.3} dense {:.3}  {} {}  {}",
                i + 1,
                h.score,
                h.lexical,
                h.dense,
                cite,
                h.chunk_id,
                truncate(&h.text, 100)
            );
        }
    }
    Ok(())
}

fn ask(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&[
        "pubkey",
        "json",
        "role",
        "equip",
        "llm",
        "llm-model",
        "llm-timeout",
        "embedder",
        "embedder-gguf",
        "embedder-sha256",
        "audit",
        "records-key",
        "support-threshold",
        "dense-gate",
    ])?;
    let dir = pack_dir(args)?;
    let question = query_arg(args)?;
    let pack = Arc::new(Pack::open(&dir, &keys(args)?)?);
    let mut engine = Engine::new(pack.clone());
    if let Some(e) = embedder(args, &pack)? {
        engine = engine.with_embedder(e);
    }
    match args.get("llm").unwrap_or("off") {
        "off" => {}
        url if url.starts_with("http://") || url.starts_with("https://") => {
            let secs: u64 = match args.get("llm-timeout") {
                Some(t) => t
                    .parse()
                    .map_err(|_| CliError::Usage("--llm-timeout must be seconds".into()))?,
                None => 120,
            };
            // An unreachable model is not a failed question: answer with the
            // model off and say why.
            match harvest_core::llm::OpenAiCompatible::new(
                url,
                args.get("llm-model"),
                std::time::Duration::from_secs(secs),
            ) {
                Ok(llm) => engine = engine.with_llm(Arc::new(llm)),
                Err(e) => eprintln!("harvest: model off: {e}"),
            }
        }
        other => {
            return Err(CliError::Usage(format!(
                "--llm {other}: expected off or an http(s)://…/v1 endpoint"
            )));
        }
    }
    let mut opts = AskOptions {
        role: Role::parse(args.get("role").unwrap_or("operator"))?,
        equip: args.get("equip").map(str::to_string),
        ..AskOptions::for_pack(&pack)
    };
    if let Some(t) = args.get("support-threshold") {
        opts.support_threshold = t
            .parse()
            .map_err(|_| CliError::Usage("--support-threshold must be a number".into()))?;
    }
    match args.get("dense-gate") {
        None => {}
        Some("off") => opts.dense_gate = None,
        Some(spec) => {
            let parsed = spec
                .split_once(':')
                .and_then(|(c, d)| Some((c.parse::<f64>().ok()?, d.parse::<f64>().ok()?)));
            let Some((support_threshold, min_dense)) = parsed else {
                return Err(CliError::Usage(
                    "--dense-gate is COVERAGE:MIN_DENSE (e.g. 0.2:0.77) or off".into(),
                ));
            };
            opts.dense_gate = Some(harvest_core::answer::DenseGate {
                support_threshold,
                min_dense,
            });
        }
    }
    let (resp, trace) = engine.ask_traced(&question, &opts)?;
    if let Some(e) = &trace.model_error {
        eprintln!("harvest: model path not used: {e}");
    }
    if let Some(db) = args.get("audit") {
        // The device record store: audit row always; a decline is also a
        // miss queued for the next bake.
        let records = harvest_core::records::Records::open_with_key(
            Path::new(db),
            records_key(args)?.as_ref(),
        )?;
        records.record_answer(&pack, &question, &resp, &trace)?;
    }
    if args.has("json") {
        println!("{}", serde_json::to_string(&resp).map_err(Error::from)?);
        return Ok(());
    }
    println!(
        "[{}]",
        serde_json::to_value(resp.mode)
            .map_err(Error::from)?
            .as_str()
            .unwrap_or("")
    );
    for seg in &resp.body {
        match seg {
            Segment::Text { text } => println!("{text}"),
            Segment::Quote { section_id, text } => println!(
                "  \u{201C}{text}\u{201D} [{}]",
                citation(&pack, section_id)?
            ),
            Segment::Cite { section_id } => println!("  [{}]", citation(&pack, section_id)?),
            Segment::Diagram { diagram_id } => println!("  (diagram {diagram_id})"),
            Segment::Check { question, answer } => println!("  Check: {question} ({answer})"),
        }
    }
    if !resp.nearest.is_empty() {
        let near: Vec<String> = resp
            .nearest
            .iter()
            .map(|s| citation(&pack, s))
            .collect::<Result<_, _>>()?;
        println!("nearest: {}", near.join(", "));
    }
    println!("({} ms, pack {})", resp.elapsed_ms, resp.pack_version);
    Ok(())
}

fn audit(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&["json", "records-key"])?;
    let db = args
        .positional
        .first()
        .ok_or_else(|| CliError::Usage("missing <records-db>".into()))?;
    if !Path::new(db).is_file() {
        return Err(CliError::Engine(Error::Invalid(format!(
            "{db}: no such file"
        ))));
    }
    let conn =
        rusqlite::Connection::open_with_flags(db, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(Error::from)?;
    let key = records_key(args)?.map(|k| harvest_core::crypt::RecordKey::from_bytes(&k));
    // Without a key the links still verify (entries count as sealed).
    if key.is_some() {
        harvest_core::records::check_key(&conn, key.as_ref())?;
    }
    let report = harvest_core::audit::verify_chain_with(&conn, key.as_ref())?;
    if args.has("json") {
        println!("{}", serde_json::to_string(&report).map_err(Error::from)?);
    } else {
        println!(
            "{} {} entries{}",
            if report.ok { "ok" } else { "BROKEN" },
            report.entries,
            report
                .first_bad
                .map(|s| format!(", first bad entry {s}"))
                .unwrap_or_default()
        );
        for (mode, n) in &report.modes {
            println!("  {mode}: {n}");
        }
        if let Some(r) = report.bake_hit_rate {
            println!("  bake hit rate: {:.1}%", r * 100.0);
        }
    }
    if report.ok {
        Ok(())
    } else {
        eprintln!(
            "harvest: audit chain broken at entry {}",
            report.first_bad.unwrap_or(0)
        );
        Err(CliError::Exit(1))
    }
}

fn outbox(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&["json", "to", "records-key"])?;
    let db = args
        .positional
        .first()
        .ok_or_else(|| CliError::Usage("missing <records-db>".into()))?;
    if !Path::new(db).is_file() {
        return Err(CliError::Engine(Error::Invalid(format!(
            "{db}: no such file"
        ))));
    }
    let records =
        harvest_core::records::Records::open_with_key(Path::new(db), records_key(args)?.as_ref())?;
    let flushed = match args.get("to") {
        Some(dir) => {
            Some(records.flush(&harvest_core::sync::DirTransport::new(Path::new(dir)), 100)?)
        }
        None => None,
    };
    let status = records.outbox_status()?;
    if args.has("json") {
        println!(
            "{}",
            json!({"ok": flushed.as_ref().is_none_or(|f| f.error.is_none()), "flush": flushed, "status": status})
        );
    } else {
        if let Some(f) = &flushed {
            println!(
                "sent {} acked {} rejected {}",
                f.sent, f.acked, f.rejected_receipts
            );
        }
        println!(
            "pending {} acked {} failing {}",
            status.pending, status.acked, status.failing
        );
        for (kind, n) in &status.pending_by_kind {
            println!("  {kind}: {n}");
        }
    }
    match flushed.and_then(|f| f.error) {
        Some(e) => {
            eprintln!("harvest: outbox flush failed: {e}");
            Err(CliError::Exit(1))
        }
        None => Ok(()),
    }
}

/// `--records-key FILE`: the records key as 64 hex characters (or 32 raw
/// bytes). The app reads it from the platform keystore instead.
fn records_key(args: &Args) -> Result<Option<[u8; 32]>, CliError> {
    let Some(path) = args.get("records-key") else {
        return Ok(None);
    };
    let raw =
        std::fs::read(path).map_err(|e| CliError::Usage(format!("--records-key {path}: {e}")))?;
    let text = String::from_utf8_lossy(&raw);
    let hex = text.trim();
    let mut key = [0u8; 32];
    if hex.len() == 64 && hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        for (i, k) in key.iter_mut().enumerate() {
            *k = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).expect("checked hex");
        }
    } else if raw.len() == 32 {
        key.copy_from_slice(&raw);
    } else {
        return Err(CliError::Usage(
            "--records-key: the file must hold 64 hex characters or 32 bytes".into(),
        ));
    }
    Ok(Some(key))
}

fn install(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&["pubkey", "json"])?;
    let [root, src] = args.positional.as_slice() else {
        return Err(CliError::Usage(
            "usage: harvest install <root> <pack-or-delta-dir>".into(),
        ));
    };
    let keys = keys(args)?;
    let src = Path::new(src);
    let manifest = harvest_core::packs::read_manifest(src, &keys)?;
    let done = if manifest.is_delta() {
        harvest_core::delta::install_delta(Path::new(root), src, &keys)?
    } else {
        harvest_core::packs::install_dir(Path::new(root), src, &keys)?
    };
    if args.has("json") {
        println!(
            "{}",
            json!({"ok": true, "pack_id": done.pack_id, "version": done.version,
                   "previous": done.previous, "changed": done.changed, "delta": manifest.is_delta()})
        );
    } else {
        println!(
            "{} {} {}",
            done.pack_id,
            done.version,
            if done.changed {
                "installed"
            } else {
                "already current"
            }
        );
    }
    Ok(())
}

fn delta(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&["pubkey", "json"])?;
    let [base, target, out] = args.positional.as_slice() else {
        return Err(CliError::Usage(
            "usage: harvest delta <base-dir> <target-dir> <out-dir>".into(),
        ));
    };
    let signer = match std::env::var("HARVEST_SIGNING_KEY") {
        Err(std::env::VarError::NotPresent) => None,
        Err(std::env::VarError::NotUnicode(_)) => {
            return Err(CliError::Usage("HARVEST_SIGNING_KEY is not base64".into()));
        }
        Ok(b64) => {
            use base64::Engine as _;
            let raw = base64::engine::general_purpose::STANDARD
                .decode(b64.trim())
                .map_err(|_| CliError::Usage("HARVEST_SIGNING_KEY is not base64".into()))?;
            let seed: [u8; 32] = raw.try_into().map_err(|_| {
                CliError::Usage("HARVEST_SIGNING_KEY must be a 32-byte ed25519 seed".into())
            })?;
            Some(ed25519_dalek::SigningKey::from_bytes(&seed))
        }
    };
    let m = harvest_core::delta::make_delta(
        Path::new(base),
        Path::new(target),
        Path::new(out),
        &keys(args)?,
        signer.as_ref(),
    )?;
    let bytes: u64 = m.files.iter().map(|f| f.bytes).sum();
    if args.has("json") {
        println!(
            "{}",
            json!({"ok": true, "pack_id": m.pack_id, "base_version": m.base_version,
                   "version": m.version, "bytes": bytes, "signed": signer.is_some()})
        );
    } else {
        println!(
            "{} {} -> {}: {bytes} bytes{}",
            m.pack_id,
            m.base_version.as_deref().unwrap_or(""),
            m.version,
            if signer.is_some() {
                ", signed"
            } else {
                ", unsigned (sign manifest.json)"
            }
        );
    }
    Ok(())
}

fn citation(pack: &Pack, section_id: &str) -> Result<String, CliError> {
    Ok(pack
        .section(section_id)?
        .map(|s| s.citation)
        .unwrap_or_else(|| section_id.to_string()))
}

fn show(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&["pubkey", "json", "id", "role", "exams"])?;
    let dir = pack_dir(args)?;
    let what = args
        .positional
        .get(1)
        .ok_or_else(|| CliError::Usage("missing what to show".into()))?;
    let pack = Pack::open(&dir, &keys(args)?)?;
    let role = Role::parse(args.get("role").unwrap_or("operator"))?;
    let id = args.get("id");
    let need_id = || id.ok_or_else(|| CliError::Usage(format!("{what} needs --id")));
    let to = |v: Result<serde_json::Value, serde_json::Error>| {
        v.map_err(|e| CliError::Engine(Error::from(e)))
    };
    let out = match (what.as_str(), id) {
        ("info", _) => to(serde_json::to_value(pack.info()?))?,
        ("sections", None) => to(serde_json::to_value(pack.sections()?))?,
        ("sections", Some(i)) => to(serde_json::to_value(pack.section(i)?))?,
        ("children", _) => to(serde_json::to_value(pack.children(need_id()?)?))?,
        ("topics", _) => to(serde_json::to_value(pack.topics()?))?,
        ("skills", _) => to(serde_json::to_value(pack.skills()?))?,
        ("lessons", None) => to(serde_json::to_value(pack.lessons()?))?,
        ("lessons", Some(i)) => to(serde_json::to_value(pack.lesson(i)?))?,
        ("terms", _) => to(serde_json::to_value(pack.terms()?))?,
        ("diagrams", None) => to(serde_json::to_value(pack.diagrams()?))?,
        ("diagrams", Some(i)) => to(serde_json::to_value(pack.diagram(i)?))?,
        ("questions", None) => to(serde_json::to_value(pack.questions()?))?,
        ("questions", Some(i)) => to(serde_json::to_value(pack.question(i)?))?,
        ("procedures", None) => to(serde_json::to_value(pack.procedures()?))?,
        ("procedures", Some(i)) => to(serde_json::to_value(
            pack.procedures()?
                .into_iter()
                .find(|p| p.procedure.proc_id == i),
        ))?,
        ("answers", None) => to(serde_json::to_value(pack.answers()?))?,
        ("answers", Some(i)) => to(serde_json::to_value(
            pack.answer_for(i, role)?
                .map(|(a, check)| json!({"answer": a, "check": check})),
        ))?,
        ("exams", _) => pack.exams()?,
        ("tree", _) => {
            let tree = harvest_core::course::CourseTree::from_pack(&pack, exams_arg(args)?)?;
            match id {
                None => json!({"derived": tree.derived, "nodes": tree.nodes}),
                Some(i) => {
                    let node = tree
                        .node(i)
                        .ok_or_else(|| CliError::Usage(format!("no tree node {i:?}")))?;
                    let brief = |n: &harvest_core::course::CourseNode| json!({"node_id": n.node_id, "level": n.level, "title": n.title});
                    json!({
                        "derived": tree.derived,
                        "node": node,
                        "path": tree.path(i).into_iter().map(brief).collect::<Vec<_>>(),
                        "children": tree.children(i).into_iter().map(brief).collect::<Vec<_>>(),
                    })
                }
            }
        }
        ("prereqs", _) => to(serde_json::to_value(pack.prereqs()?))?,
        ("starters", _) => to(serde_json::to_value(pack.starters(role)?))?,
        (other, _) => return Err(CliError::Usage(format!("cannot show {other:?}"))),
    };
    println!("{}", serde_json::to_string(&out).map_err(Error::from)?);
    Ok(())
}

/// Run scripted conversations: `[{id, learner?, welcome?, turns: [{say} | {tap: k} | {input}]}]`.
/// `tap: k` takes the previous turn's k-th follow-up. Prints one line per conversation.
fn converse(args: &Args) -> Result<(), CliError> {
    use harvest_core::instructor::{Input, Instructor, Learner, Message, TurnRequest};
    args.reject_unknown(&[
        "pubkey",
        "json",
        "exams",
        "llm",
        "llm-model",
        "llm-timeout",
        "embedder",
        "embedder-gguf",
        "embedder-sha256",
    ])?;
    let dir = pack_dir(args)?;
    let script_path = args
        .positional
        .get(1)
        .ok_or_else(|| CliError::Usage("missing <script.json>".into()))?;
    let text = if script_path == "-" {
        let mut s = String::new();
        std::io::Read::read_to_string(&mut std::io::stdin(), &mut s)
            .map_err(|e| CliError::Usage(format!("stdin: {e}")))?;
        s
    } else {
        std::fs::read_to_string(script_path)
            .map_err(|e| CliError::Usage(format!("{script_path}: {e}")))?
    };
    let scripts: Vec<serde_json::Value> =
        serde_json::from_str(&text).map_err(|e| CliError::Usage(format!("{script_path}: {e}")))?;
    let pack = Arc::new(Pack::open(&dir, &keys(args)?)?);
    let mut engine = Engine::new(pack.clone());
    if let Some(e) = embedder(args, &pack)? {
        engine = engine.with_embedder(e);
    }
    let llm: Option<Arc<dyn harvest_core::Llm>> = match args.get("llm").unwrap_or("off") {
        "off" => None,
        url if url.starts_with("http://") || url.starts_with("https://") => {
            let secs: u64 = args
                .get("llm-timeout")
                .map(|t| t.parse())
                .transpose()
                .map_err(|_| CliError::Usage("--llm-timeout must be seconds".into()))?
                .unwrap_or(180);
            Some(Arc::new(harvest_core::llm::OpenAiCompatible::new(
                url,
                args.get("llm-model"),
                std::time::Duration::from_secs(secs),
            )?))
        }
        other => {
            return Err(CliError::Usage(format!(
                "--llm {other}: expected off or an http(s)://…/v1 endpoint"
            )));
        }
    };
    let tree = harvest_core::course::CourseTree::from_pack(&pack, exams_arg(args)?)?;
    let inst = Instructor::new(Arc::new(engine), llm, tree);
    for sc in scripts {
        let learner: Learner = serde_json::from_value(sc["learner"].clone()).unwrap_or_default();
        let mut history: Vec<Message> = Vec::new();
        let mut at: Option<String> = None;
        let mut out = Vec::new();
        let mut last: Option<harvest_core::instructor::Turn> = None;
        if sc["welcome"].as_bool().unwrap_or(true) {
            let t = inst.welcome(&learner)?;
            history.push(Message {
                who: "instructor".into(),
                text: t.plain(),
            });
            at = t.at.clone();
            out.push(json!({"said": null, "turn": t}));
            last = Some(t);
        }
        for step in sc["turns"].as_array().into_iter().flatten() {
            let (ask, input, said) = if let Some(s) = step["say"].as_str() {
                (Some(s.to_string()), None, s.to_string())
            } else if let Some(k) = step["tap"].as_u64() {
                match last.as_ref().and_then(|t| t.follow_ups.get(k as usize)) {
                    Some(f) if f.input.is_some() || f.ask.is_some() => {
                        (f.ask.clone(), f.input.clone(), f.label.clone())
                    }
                    _ => {
                        out.push(json!({"tap": k, "error": "no such follow-up"}));
                        continue;
                    }
                }
            } else {
                let i: Input = serde_json::from_value(step["input"].clone())
                    .map_err(|e| CliError::Usage(format!("turn {step}: {e}")))?;
                (None, Some(i), step["input"].to_string())
            };
            let req = TurnRequest {
                history: history.clone(),
                learner: learner.clone(),
                at: at.clone(),
                ask,
                input,
            };
            let t = inst.turn(&req)?;
            history.push(Message {
                who: "learner".into(),
                text: said.clone(),
            });
            history.push(Message {
                who: "instructor".into(),
                text: t.plain(),
            });
            if t.at.is_some() {
                at = t.at.clone();
            }
            out.push(json!({"said": said, "turn": t}));
            last = Some(t);
        }
        println!(
            "{}",
            json!({"id": sc["id"], "learner": sc["learner"], "turns": out})
        );
    }
    Ok(())
}

/// `--exams FILE`: exam blueprints (a JSON array) that override the pack's.
fn exams_arg(args: &Args) -> Result<Option<serde_json::Value>, CliError> {
    let Some(path) = args.get("exams") else {
        return Ok(None);
    };
    let text = std::fs::read_to_string(path)
        .map_err(|e| CliError::Usage(format!("--exams {path}: {e}")))?;
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| CliError::Usage(format!("--exams {path}: {e}")))?;
    if !v.is_array() {
        return Err(CliError::Usage(format!("--exams {path}: not a JSON array")));
    }
    Ok(Some(v))
}

fn fixture(args: &Args) -> Result<(), CliError> {
    args.reject_unknown(&["version", "json"])?;
    let dir = PathBuf::from(
        args.positional
            .first()
            .ok_or_else(|| CliError::Usage("missing <dir>".into()))?,
    );
    let version = args.get("version").unwrap_or("2026.1.1-1");
    harvest_core::fixture::build(&dir, version)?;
    let key = harvest_core::fixture::public_key_base64();
    if args.has("json") {
        println!("{}", json!({"dir": dir, "version": version, "pubkey": key}));
    } else {
        println!("fixture pack {version} at {}", dir.display());
        println!("test-only public key: {key}");
    }
    Ok(())
}

fn truncate(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_string()
    } else {
        format!("{}…", s.chars().take(n).collect::<String>())
    }
}
