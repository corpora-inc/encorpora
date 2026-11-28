//! The local HTTP transport of the API (`harvest serve`), for the app in a
//! browser during development. It carries `(method, params)` to
//! [`super::call`] and the envelope back; nothing else happens here.
//!
//! ```text
//! POST /api/<method>      body: params JSON     → envelope
//! POST /api               body: {method, params} → envelope
//! GET  /api               → {api_version, methods}
//! GET  /api/schema        → the API's JSON Schema
//! GET  /asset/<pack>/<id> → a figure or page file of a verified pack
//! GET  /…                 → files from --static (index.html for app routes)
//! ```
//!
//! A web page in the same browser can reach a loopback port, so the server
//! answers only requests whose `Host` is its own loopback name (no DNS
//! rebinding), refuses an `Origin` it was not told to allow, and takes API
//! calls only as `application/json` (no cross-site form posts).

use super::{Host, envelope};
use crate::error::{Error, Result};
use std::io::Read;
use std::net::SocketAddr;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use tiny_http::{Header, Method, Request, Response, Server};

/// Largest request body taken.
const MAX_BODY: u64 = 8 << 20;

/// How to serve.
#[derive(Debug, Clone)]
pub struct ServeConfig {
    pub bind: SocketAddr,
    /// The built app, served at `/`.
    pub static_dir: Option<PathBuf>,
    /// Origins allowed to call the API cross-origin (a dev server such as
    /// `http://localhost:5173`). The server's own origin always is.
    pub allow_origins: Vec<String>,
}

/// An error envelope as it leaves the machine: file paths replaced (the
/// full message goes to the log).
fn public(mut out: serde_json::Value) -> serde_json::Value {
    if let Some(m) = out
        .pointer_mut("/error/message")
        .and_then(|m| m.as_str().map(str::to_string))
    {
        let r = redact(&m);
        if r != m {
            eprintln!("harvest serve: {m}");
        }
        out["error"]["message"] = serde_json::Value::String(r);
    }
    out
}

/// Replace anything that looks like a file path with `<path>`: a run that
/// starts with `/`, `~/`, `./`, `../` or a drive (`C:\`) after a space,
/// quote, bracket or `=`, up to the next such delimiter. URLs keep theirs.
pub fn redact(msg: &str) -> String {
    let chars: Vec<char> = msg.chars().collect();
    let delim = |c: char| c.is_whitespace() || "\"'`()[]{}<>,;=".contains(c);
    let mut out = String::with_capacity(msg.len());
    let mut i = 0;
    while i < chars.len() {
        let boundary = i == 0 || delim(chars[i - 1]);
        let rest: String = chars[i..chars.len().min(i + 3)].iter().collect();
        let tail: String = chars[i..].iter().take(8).collect();
        let route = ["/hub/", "/api/", "/asset/"]
            .iter()
            .any(|r| tail.starts_with(r));
        let starts = boundary
            && !route
            && (chars[i] == '/'
                || chars[i] == '\\'
                || tail.starts_with("file:")
                || (chars[i].is_ascii_alphabetic()
                    && chars.get(i + 1) == Some(&':')
                    && chars.get(i + 2) == Some(&'/'))
                || rest.starts_with("~/")
                || rest.starts_with("./")
                || rest.starts_with("../")
                || (chars[i].is_ascii_alphabetic()
                    && chars.get(i + 1) == Some(&':')
                    && chars.get(i + 2) == Some(&'\\')));
        if starts {
            let mut j = i;
            loop {
                while j < chars.len() && !(delim(chars[j]) && chars[j] != '=') {
                    j += 1;
                }
                // A space inside a path ("John Smith\AppData", "Application
                // Support/…"): the path goes on when the next word holds a
                // separator.
                if j < chars.len() && chars[j] == ' ' {
                    let mut k = j + 1;
                    while k < chars.len() && !delim(chars[k]) {
                        k += 1;
                    }
                    if chars[j + 1..k].iter().any(|c| *c == '/' || *c == '\\') {
                        j = k;
                        continue;
                    }
                }
                break;
            }
            out.push_str("<path>");
            i = j;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

/// Bundles per `/hub/bundles` page by default.
pub const BUNDLE_PAGE: usize = 50;

/// Request workers.
const WORKERS: usize = 4;

/// A running server.
pub struct Running {
    server: Arc<Server>,
    addr: SocketAddr,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl Running {
    pub fn addr(&self) -> SocketAddr {
        self.addr
    }
    /// Stop accepting and wait for the server thread.
    pub fn stop(mut self) {
        for _ in 0..WORKERS {
            self.server.unblock();
        }
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
    /// Serve until the process ends.
    pub fn wait(mut self) {
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

/// Bind and serve on a background thread.
pub fn start(host: Arc<Host>, cfg: ServeConfig) -> Result<Running> {
    let server = Arc::new(
        Server::http(cfg.bind).map_err(|e| Error::Invalid(format!("bind {}: {e}", cfg.bind)))?,
    );
    let addr = server
        .server_addr()
        .to_ip()
        .ok_or_else(|| Error::Invalid("the server has no IP address".into()))?;
    let s = server.clone();
    // A few workers, so one slow upload does not hold every other device
    // up; a panic in a handler costs that request, never the server.
    let cfg = Arc::new(cfg);
    let thread = std::thread::spawn(move || {
        let workers: Vec<_> = (0..WORKERS)
            .map(|_| {
                let (s, host, cfg) = (s.clone(), host.clone(), cfg.clone());
                std::thread::spawn(move || {
                    while let Ok(req) = s.recv() {
                        let out = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                            handle(&host, &cfg, addr, req)
                        }));
                        match out {
                            Ok(Ok(())) => {}
                            Ok(Err(e)) => eprintln!("harvest serve: {e}"),
                            Err(_) => eprintln!(
                                "harvest serve: a request handler panicked; the request was dropped"
                            ),
                        }
                    }
                })
            })
            .collect();
        for w in workers {
            let _ = w.join();
        }
    });
    Ok(Running {
        server,
        addr,
        thread: Some(thread),
    })
}

fn header(req: &Request, name: &str) -> Option<String> {
    req.headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name))
        .map(|h| h.value.as_str().to_string())
}

fn h(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("valid header")
}

fn json_response(status: u16, body: &serde_json::Value) -> Response<std::io::Cursor<Vec<u8>>> {
    Response::from_data(body.to_string().into_bytes())
        .with_status_code(status)
        .with_header(h("Content-Type", "application/json; charset=utf-8"))
        .with_header(h("Cache-Control", "no-store"))
}

fn text(status: u16, msg: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    Response::from_data(msg.as_bytes().to_vec())
        .with_status_code(status)
        .with_header(h("Content-Type", "text/plain; charset=utf-8"))
}

/// The names this server answers to: its loopback names, or anything when
/// bound to a non-loopback address on purpose.
fn host_ok(host_header: Option<&str>, addr: SocketAddr) -> bool {
    if !addr.ip().is_loopback() {
        return true;
    }
    let Some(hh) = host_header else { return false };
    let port = addr.port();
    [
        format!("127.0.0.1:{port}"),
        format!("localhost:{port}"),
        format!("[::1]:{port}"),
    ]
    .iter()
    .any(|n| n.eq_ignore_ascii_case(hh.trim()))
}

fn origin_ok(origin: Option<&str>, host_header: Option<&str>, cfg: &ServeConfig) -> bool {
    let Some(o) = origin else { return true };
    if let Some(hh) = host_header
        && (o.eq_ignore_ascii_case(&format!("http://{hh}")))
    {
        return true;
    }
    cfg.allow_origins.iter().any(|a| a.eq_ignore_ascii_case(o))
}

fn handle(
    host: &Host,
    cfg: &ServeConfig,
    addr: SocketAddr,
    mut req: Request,
) -> std::io::Result<()> {
    let host_header = header(&req, "Host");
    let origin = header(&req, "Origin");
    if !host_ok(host_header.as_deref(), addr) {
        return req.respond(text(403, "unknown Host"));
    }
    let url = req.url().to_string();
    let path = url.split(['?', '#']).next().unwrap_or("/").to_string();
    let is_api = path == "/api"
        || path.starts_with("/api/")
        || path.starts_with("/asset/")
        || path.starts_with("/hub/");
    if is_api && !origin_ok(origin.as_deref(), host_header.as_deref(), cfg) {
        return req.respond(text(403, "origin not allowed"));
    }
    let cors = |r: Response<std::io::Cursor<Vec<u8>>>| match &origin {
        Some(o) if is_api => r
            .with_header(h("Access-Control-Allow-Origin", o))
            .with_header(h("Vary", "Origin")),
        _ => r,
    };
    match (req.method().clone(), path.as_str()) {
        (Method::Options, _) if is_api => {
            let r = text(204, "")
                .with_header(h("Access-Control-Allow-Methods", "GET, POST, OPTIONS"))
                .with_header(h("Access-Control-Allow-Headers", "Content-Type"))
                .with_header(h("Access-Control-Max-Age", "600"));
            req.respond(cors(r))
        }
        (Method::Get, "/api") => req.respond(cors(json_response(
            200,
            &serde_json::json!({"api_version": super::API_VERSION, "methods": super::METHODS}),
        ))),
        (Method::Get, "/api/schema") => {
            req.respond(cors(json_response(200, &super::schema::schema())))
        }
        (Method::Post, p) if p == "/api" || p.starts_with("/api/") => {
            let ct = header(&req, "Content-Type").unwrap_or_default();
            if !ct.to_ascii_lowercase().starts_with("application/json") {
                return req.respond(cors(text(415, "API calls are application/json")));
            }
            if req.body_length().is_some_and(|n| n as u64 > MAX_BODY) {
                return req.respond(cors(text(413, "request too large")));
            }
            let mut body = String::new();
            if let Err(e) = req.as_reader().take(MAX_BODY + 1).read_to_string(&mut body) {
                return req.respond(cors(text(400, &format!("body: {e}"))));
            }
            if body.len() as u64 > MAX_BODY {
                return req.respond(cors(text(413, "request too large")));
            }
            // Who is calling, when the host identifies people.
            let who = match host.identity() {
                None => None,
                Some(id) => {
                    let meta = crate::hub::auth::RequestMeta {
                        remote: req.remote_addr().map(|a| a.ip()),
                        headers: req
                            .headers()
                            .iter()
                            .map(|h| {
                                (
                                    h.field.as_str().as_str().to_ascii_lowercase(),
                                    h.value.as_str().to_string(),
                                )
                            })
                            .collect(),
                    };
                    match id.identify(&meta) {
                        Ok(p) => p,
                        Err(e) => {
                            let body = envelope(Err(super::ApiError {
                                code: "unauthenticated".into(),
                                message: e.to_string(),
                            }));
                            return req.respond(cors(json_response(401, &body)));
                        }
                    }
                }
            };
            let out = if p == "/api" {
                match serde_json::from_str::<serde_json::Value>(&body) {
                    Ok(v) => {
                        let method = v
                            .get("method")
                            .and_then(|m| m.as_str())
                            .unwrap_or("")
                            .to_string();
                        let params = v.get("params").cloned().unwrap_or(serde_json::Value::Null);
                        envelope(super::call_as(host, who.as_ref(), &method, params))
                    }
                    Err(e) => envelope(Err(super::bad_params("request", e))),
                }
            } else {
                let method = &p["/api/".len()..];
                let params = if body.trim().is_empty() {
                    Ok(serde_json::Value::Null)
                } else {
                    serde_json::from_str(&body).map_err(|e| super::bad_params(method, e))
                };
                envelope(params.and_then(|v| super::call_as(host, who.as_ref(), method, v)))
            };
            req.respond(cors(json_response(200, &public(out))))
        }
        (m, p) if p.starts_with("/hub/") => {
            let Some(hub) = host.hub() else {
                return req.respond(cors(text(404, "this server is not a hub")));
            };
            let query = url
                .split_once('?')
                .map(|(_, q)| q.to_string())
                .unwrap_or_default();
            let mut body = String::new();
            if m == Method::Post {
                let ct = header(&req, "Content-Type").unwrap_or_default();
                if !ct.to_ascii_lowercase().starts_with("application/json") {
                    return req.respond(cors(text(415, "hub calls are application/json")));
                }
                if let Err(e) = req.as_reader().take(MAX_BODY + 1).read_to_string(&mut body) {
                    return req.respond(cors(text(400, &format!("body: {e}"))));
                }
                if body.len() as u64 > MAX_BODY {
                    return req.respond(cors(text(413, "request too large")));
                }
            }
            let hub = hub.lock().unwrap_or_else(|p| p.into_inner());
            match hub_route(&hub, &m, p, &query, &body) {
                Ok(HubReply::Json(v)) => req.respond(cors(json_response(200, &v))),
                Ok(HubReply::Bytes(b)) => req.respond(cors(
                    Response::from_data(b)
                        .with_header(h("Content-Type", "application/octet-stream")),
                )),
                Err((code, msg)) => {
                    eprintln!("harvest serve: {p}: {code} {msg}");
                    req.respond(cors(text(code, &redact(&msg))))
                }
            }
        }
        (Method::Get, p) if p.starts_with("/asset/") => {
            let rest = &p["/asset/".len()..];
            let Some((pack_id, asset_id)) = rest.split_once('/') else {
                return req.respond(cors(text(404, "not found")));
            };
            match asset(host, pack_id, asset_id) {
                Ok(Some((media, bytes))) => req.respond(cors(
                    Response::from_data(bytes)
                        .with_header(h("Content-Type", &media))
                        .with_header(h("X-Content-Type-Options", "nosniff"))
                        .with_header(h(
                            "Content-Security-Policy",
                            "default-src 'none'; style-src 'unsafe-inline'",
                        ))
                        .with_header(h("Cache-Control", "private, max-age=3600")),
                )),
                Ok(None) => req.respond(cors(text(404, "not found"))),
                Err(e) => {
                    eprintln!("harvest serve: {p}: {e}");
                    req.respond(cors(text(500, "the asset could not be read")))
                }
            }
        }
        (Method::Get, p) => match &cfg.static_dir {
            Some(dir) => match static_file(dir, p) {
                Some((file, media)) => match std::fs::read(&file) {
                    Ok(bytes) => req.respond(
                        Response::from_data(bytes)
                            .with_header(h("Content-Type", media))
                            .with_header(h("X-Content-Type-Options", "nosniff")),
                    ),
                    Err(_) => req.respond(text(404, "not found")),
                },
                None => req.respond(text(404, "not found")),
            },
            None => req.respond(text(404, "harvest serve: the API is at /api")),
        },
        _ => req.respond(cors(text(405, "method not allowed"))),
    }
}

enum HubReply {
    Json(serde_json::Value),
    Bytes(Vec<u8>),
}

fn query_get(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|kv| {
        let (k, v) = kv.split_once('=')?;
        (k == key).then(|| percent_decode(v))
    })
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%'
            && i + 2 < b.len() + 1
            && let Some(x) = s
                .get(i + 1..i + 3)
                .and_then(|h| u8::from_str_radix(h, 16).ok())
        {
            out.push(x);
            i += 3;
            continue;
        }
        out.push(if b[i] == b'+' { b' ' } else { b[i] });
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// The device routes of a hub (CONTRACT "Hub").
fn hub_route(
    hub: &crate::hub::Hub,
    m: &Method,
    path: &str,
    query: &str,
    body: &str,
) -> std::result::Result<HubReply, (u16, String)> {
    let err = |e: Error| {
        (
            if matches!(e, Error::Invalid(_)) {
                400
            } else {
                500
            },
            e.to_string(),
        )
    };
    match (m, path) {
        (Method::Post, "/hub/receive") => {
            let d: crate::sync::Delivery =
                serde_json::from_str(body).map_err(|e| (400, format!("delivery: {e}")))?;
            let r = hub.receive(&d).map_err(|e| match e {
                Error::Signature(m) => (403, m),
                other => err(other),
            })?;
            Ok(HubReply::Json(
                serde_json::to_value(r).map_err(|e| (500, e.to_string()))?,
            ))
        }
        (Method::Post, "/hub/hello") => {
            let h: crate::sync::Hello =
                serde_json::from_str(body).map_err(|e| (400, format!("hello: {e}")))?;
            let r = hub.hello(&h).map_err(err)?;
            Ok(HubReply::Json(
                serde_json::to_value(r).map_err(|e| (500, e.to_string()))?,
            ))
        }
        (Method::Get, "/hub/attachment") => {
            let sha = query_get(query, "sha256").ok_or((400, "sha256".to_string()))?;
            let total = query_get(query, "total")
                .and_then(|t| t.parse::<u64>().ok())
                .ok_or((400, "total".to_string()))?;
            // Older devices do not name themselves; the answer still has `held`.
            let device = query_get(query, "device_id").unwrap_or_default();
            let held = hub.held_for(&device, &sha, total).map_err(err)?;
            Ok(HubReply::Json(
                serde_json::to_value(held).map_err(|e| (500, e.to_string()))?,
            ))
        }
        (Method::Post, "/hub/attachment") => {
            let c: crate::sync::AttachmentChunk =
                serde_json::from_str(body).map_err(|e| (400, format!("chunk: {e}")))?;
            let held = hub.put_chunk_signed(&c).map_err(|e| match e {
                Error::Signature(m) => (403, m),
                other => err(other),
            })?;
            Ok(HubReply::Json(
                serde_json::to_value(held).map_err(|e| (500, e.to_string()))?,
            ))
        }
        (Method::Get, "/hub/fleet") => Ok(HubReply::Json(
            hub.fleet_document()
                .map_err(err)?
                .unwrap_or(serde_json::Value::Null),
        )),
        (Method::Get, "/hub/bundles") => {
            let since = query_get(query, "since")
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            let limit = query_get(query, "limit")
                .and_then(|s| s.parse::<usize>().ok())
                .unwrap_or(BUNDLE_PAGE)
                .clamp(1, 200);
            Ok(HubReply::Json(serde_json::Value::Array(
                hub.bundles_page(since, limit).map_err(err)?,
            )))
        }
        (Method::Get, "/hub/pack-offer") => {
            let pack_id = query_get(query, "pack_id").ok_or((400, "pack_id".to_string()))?;
            let have = query_get(query, "have");
            let o = hub.pack_offer(&pack_id, have.as_deref()).map_err(err)?;
            Ok(HubReply::Json(
                serde_json::to_value(o).map_err(|e| (500, e.to_string()))?,
            ))
        }
        (Method::Get, p) if p.starts_with("/hub/pack-file/") => {
            let rest = &p["/hub/pack-file/".len()..];
            let mut parts = rest.splitn(3, '/');
            let (Some(pack_id), Some(dir), Some(file)) = (parts.next(), parts.next(), parts.next())
            else {
                return Err((404, "not found".into()));
            };
            let offer = crate::sync::PackOffer {
                pack_id: percent_decode(pack_id),
                version: String::new(),
                kind: String::new(),
                base_version: None,
                dir: percent_decode(dir),
                files: Vec::new(),
                bytes: 0,
            };
            Ok(HubReply::Bytes(
                hub.fetch(&offer, &percent_decode(file)).map_err(err)?,
            ))
        }
        _ => Err((404, "not found".into())),
    }
}

fn asset(host: &Host, pack_id: &str, asset_id: &str) -> Result<Option<(String, Vec<u8>)>> {
    host.asset(pack_id, asset_id)
}

/// A file under `dir` for a URL path; app routes without an extension get
/// `index.html`. `None` for anything that leaves `dir`.
fn static_file(dir: &Path, url_path: &str) -> Option<(PathBuf, &'static str)> {
    let rel = url_path.trim_start_matches('/');
    let mut p = dir.to_path_buf();
    for c in Path::new(rel).components() {
        match c {
            Component::Normal(x) => p.push(x),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if rel.is_empty() || p.is_dir() {
        p.push("index.html");
    }
    if !p.is_file() {
        if Path::new(rel).extension().is_some() {
            return None;
        }
        p = dir.join("index.html");
    }
    let media = match p.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        "ico" => "image/x-icon",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    };
    p.is_file().then_some((p, media))
}

#[cfg(test)]
mod redact_tests {
    use super::redact;

    #[test]
    fn paths_never_leave_the_machine() {
        assert_eq!(
            redact("open /Users/x/records.db: denied"),
            "open <path> denied"
        );
        assert_eq!(redact("pack \"/tmp/p/m.json\" bad"), "pack \"<path>\" bad");
        assert_eq!(
            redact("at ~/keys/k and ./a/b and C:\\x\\y"),
            "at <path> and <path> and <path>"
        );
        assert_eq!(
            redact("hub /hub/bundles?since=0: 503"),
            "hub /hub/bundles?since=0: 503"
        );
        assert_eq!(
            redact("at C:/Users/x and \\\\srv\\share and file:///Users/x"),
            "at <path> and <path> and <path>"
        );
        assert_eq!(
            redact("fetch http://hub:4318/hub/receive failed"),
            "fetch http://hub:4318/hub/receive failed"
        );
        assert_eq!(
            redact("no pack \"pump40\" is loaded"),
            "no pack \"pump40\" is loaded"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hosts() {
        let a: SocketAddr = "127.0.0.1:4310".parse().unwrap();
        assert!(host_ok(Some("127.0.0.1:4310"), a));
        assert!(host_ok(Some("localhost:4310"), a));
        assert!(!host_ok(Some("evil.example:4310"), a));
        assert!(!host_ok(None, a));
        let lan: SocketAddr = "0.0.0.0:4310".parse().unwrap();
        assert!(host_ok(Some("192.168.1.5:4310"), lan));
    }

    #[test]
    fn static_paths_stay_inside() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().to_path_buf();
        std::fs::write(dir.join("index.html"), "x").unwrap();
        assert!(static_file(&dir, "/").is_some());
        assert!(static_file(&dir, "/jobs/123").is_some());
        assert!(static_file(&dir, "/../secret.txt").is_none());
        assert!(static_file(&dir, "/missing.js").is_none());
    }
}
