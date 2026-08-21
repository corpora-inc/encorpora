// src/offline_cache/net.rs — the streaming download half of the D12 image
// cache. Depends ONLY on reqwest + futures-util + std (no Tauri imports), so
// it compiles and unit-tests on this build box via the standalone proof crate
// (the full Tauri dep tree needs system GTK/WebKit headers).
//
// Policy mirrors content_packs.rs fetch_bytes: https always; plain http only
// for localhost/private hosts (dev servers). The size ceiling is enforced
// BOTH on the declared Content-Length (fail before any bytes) and on the
// streamed byte count (fail mid-stream on a lying/absent header), and a
// failed/oversized download always removes its tmp file.

use futures_util::StreamExt;
use std::io::Write;
use std::path::Path;

/// Same private-host allowance as content_packs.rs `is_private_host`.
fn is_private_host(host: &str) -> bool {
    host == "localhost"
        || host == "127.0.0.1"
        || host.starts_with("10.")
        || host.starts_with("192.168.")
        || host.starts_with("172.16.")
        || host.starts_with("172.17.")
        || host.starts_with("172.18.")
        || host.starts_with("172.19.")
        || host.starts_with("172.2")
        || host.starts_with("172.30.")
        || host.starts_with("172.31.")
}

/// Validate the URL scheme/host policy. Returns the parsed URL.
pub fn validate_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| "Invalid URL".to_string())?;
    match parsed.scheme() {
        "https" => Ok(parsed),
        "http" => {
            if is_private_host(parsed.host_str().unwrap_or("")) {
                Ok(parsed)
            } else {
                Err("Insecure HTTP is only allowed for localhost/private hosts".to_string())
            }
        }
        _ => Err("Unsupported URL scheme".to_string()),
    }
}

#[derive(Debug)]
pub struct DownloadedFile {
    pub size: u64,
    pub content_type: Option<String>,
}

/// Stream `url` into `dest` with a hard byte ceiling. On ANY failure the
/// partial `dest` is removed before returning — callers only ever see a
/// fully-written tmp file or no file at all.
pub async fn download_to_file(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    max_bytes: u64,
) -> Result<DownloadedFile, String> {
    let parsed = validate_url(url)?;
    let res = client
        .get(parsed)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;
    let status = res.status();
    if !status.is_success() {
        return Err(format!("Download failed ({status})"));
    }
    if let Some(len) = res.content_length() {
        if len > max_bytes {
            return Err("Image exceeds size limit".to_string());
        }
    }
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let write_result: Result<u64, String> = async {
        let mut file = std::fs::File::create(dest).map_err(|e| e.to_string())?;
        let mut written = 0u64;
        let mut stream = res.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download failed: {e}"))?;
            written += chunk.len() as u64;
            if written > max_bytes {
                return Err("Image exceeds size limit".to_string());
            }
            file.write_all(&chunk).map_err(|e| e.to_string())?;
        }
        file.flush().map_err(|e| e.to_string())?;
        Ok(written)
    }
    .await;

    match write_result {
        Ok(size) => Ok(DownloadedFile { size, content_type }),
        Err(e) => {
            let _ = std::fs::remove_file(dest);
            Err(e)
        }
    }
}

/* ---------------------------------- tests --------------------------------- */
// Network-free policy tests here; the end-to-end stream/ceiling tests run in
// the standalone proof crate against a local TCP fixture (see the W2 gates).

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_policy_https_always_http_private_only() {
        assert!(validate_url("https://encorpora.io/assets/a.png").is_ok());
        assert!(validate_url("http://localhost:5173/a.png").is_ok());
        assert!(validate_url("http://192.168.1.10/a.png").is_ok());
        assert!(validate_url("http://encorpora.io/a.png").is_err());
        assert!(validate_url("ftp://encorpora.io/a.png").is_err());
        assert!(validate_url("file:///etc/passwd").is_err());
        assert!(validate_url("corpan-pack://localhost/x/a.png").is_err());
        assert!(validate_url("not a url").is_err());
    }
}
