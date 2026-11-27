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
  harvest search  <pack-dir> \"<query>\" [--k 10] [--equip ID] [--embedder auto|none|hashing] [--pubkey KEY] [--json]
  harvest ask     <pack-dir> \"<question>\" [--role operator] [--equip ID] [--llm off|http://host:port/v1]
                  [--llm-model NAME] [--embedder auto|none|hashing|<file.gguf>] [--audit <records-db>] [--pubkey KEY] [--json]
  harvest audit   <records-db> [--json]
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
        "search" => search(&args),
        "ask" => ask(&args),
        "audit" => audit(&args),
        "fixture" => fixture(&args),
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
    args.reject_unknown(&["pubkey", "json", "k", "equip", "embedder"])?;
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
        "audit",
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
    let opts = AskOptions {
        role: Role::parse(args.get("role").unwrap_or("operator"))?,
        equip: args.get("equip").map(str::to_string),
        ..AskOptions::default()
    };
    let (resp, trace) = engine.ask_traced(&question, &opts)?;
    if let Some(e) = &trace.model_error {
        eprintln!("harvest: model path not used: {e}");
    }
    if let Some(db) = args.get("audit") {
        let conn = rusqlite::Connection::open(db).map_err(Error::from)?;
        let entry =
            harvest_core::audit::AuditEntry::from_answer(pack.pack_id(), &question, &resp, &trace);
        harvest_core::audit::append(&conn, &entry)?;
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
    args.reject_unknown(&["json"])?;
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
    let report = harvest_core::audit::verify_chain(&conn)?;
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

fn citation(pack: &Pack, section_id: &str) -> Result<String, CliError> {
    Ok(pack
        .section(section_id)?
        .map(|s| s.citation)
        .unwrap_or_else(|| section_id.to_string()))
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
