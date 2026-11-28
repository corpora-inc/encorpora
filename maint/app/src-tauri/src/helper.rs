//! Search by meaning, served by a managed local helper.
//!
//! The engine's embedder speaks to an embedding server; in-process loading
//! is not available on this platform yet. When `config.json` names a model
//! file and a `llama-server` binary, the app starts that binary as a child
//! process bound to 127.0.0.1 on a free port, waits for it, and stops it on
//! exit. This is the only socket the app ever listens on, and it is loopback.
//!
//! One small interface (`start`, `url`, `model_sha256`, `stop`) so in-process
//! loading can replace it later without touching the engine.

use crate::config::EmbedderConfig;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

pub struct EmbedHelper {
    child: Child,
    url: String,
    sha256: String,
    pidfile: PathBuf,
}

impl EmbedHelper {
    /// Start the server on a free loopback port and wait until it answers.
    /// `pidfile` records the child, so a helper left behind by an app that was
    /// killed (no exit event) is stopped at the next start.
    pub fn start(cfg: &EmbedderConfig, pidfile: &Path) -> Result<Self, String> {
        stop_stale(pidfile, &cfg.server);
        if !cfg.model.is_file() {
            return Err(format!("no model at {}", cfg.model.display()));
        }
        // The engine ties the pack's vectors to the exact model file by its hash.
        let sha256 = harvest_core::packs::sha256_file(&cfg.model).map_err(|e| e.to_string())?;
        let port = free_loopback_port()?;
        let mut child = Command::new(&cfg.server)
            .args(["-m"])
            .arg(&cfg.model)
            .args([
                "--embedding",
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
                "-c",
                "8192",
                "-b",
                "8192",
                "-ub",
                "8192",
                "-np",
                "1",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("{}: {e}", cfg.server.display()))?;
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            if healthy(port) {
                break;
            }
            if let Ok(Some(status)) = child.try_wait() {
                return Err(format!("the embedding server exited ({status})"));
            }
            if Instant::now() > deadline {
                let _ = child.kill();
                return Err("the embedding server did not start within 60 s".into());
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        let _ = std::fs::write(pidfile, child.id().to_string());
        Ok(Self {
            child,
            url: format!("http://127.0.0.1:{port}"),
            sha256,
            pidfile: pidfile.to_path_buf(),
        })
    }

    pub fn url(&self) -> &str {
        &self.url
    }

    /// The SHA-256 of the model file the helper serves.
    pub fn model_sha256(&self) -> &str {
        &self.sha256
    }

    /// The child's process id (tests check its sockets).
    pub fn pid(&self) -> u32 {
        self.child.id()
    }

    pub fn stop(self) {
        drop(self);
    }
}

impl Drop for EmbedHelper {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_file(&self.pidfile);
    }
}

/// Stop a helper an earlier run left behind: only when the recorded process
/// is still the configured server binary (a reused pid is never touched).
fn stop_stale(pidfile: &Path, server: &Path) {
    let Ok(text) = std::fs::read_to_string(pidfile) else {
        return;
    };
    let pid = text.trim();
    if pid.is_empty() || !pid.bytes().all(|b| b.is_ascii_digit()) {
        return;
    }
    let Ok(out) = Command::new("ps")
        .args(["-o", "command=", "-p", pid])
        .output()
    else {
        return;
    };
    let command = String::from_utf8_lossy(&out.stdout);
    if command.trim_start().starts_with(&*server.to_string_lossy())
        && command.contains("--embedding")
    {
        let _ = Command::new("kill").arg(pid).status();
    }
    let _ = std::fs::remove_file(pidfile);
}

/// A free port on 127.0.0.1: bind port 0, read it back, release it.
fn free_loopback_port() -> Result<u16, String> {
    let l =
        TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0))).map_err(|e| e.to_string())?;
    let port = l.local_addr().map_err(|e| e.to_string())?.port();
    drop(l);
    Ok(port)
}

/// `GET /health` answers 200 once the model is loaded.
fn healthy(port: u16) -> bool {
    let Ok(mut s) = TcpStream::connect_timeout(
        &SocketAddr::from((Ipv4Addr::LOCALHOST, port)),
        Duration::from_millis(300),
    ) else {
        return false;
    };
    let _ = s.set_read_timeout(Some(Duration::from_millis(500)));
    if s.write_all(b"GET /health HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut buf = [0u8; 16];
    matches!(s.read(&mut buf), Ok(n) if n >= 12 && &buf[9..12] == b"200")
}
