//! `maint-asset://localhost/<pack>/<asset>`: a pack's figures and page images
//! through the core's `Host::asset` (re-hashed before they go out), the same
//! read `harvest serve` answers `GET /asset/<pack>/<asset>` with.
//!
//! On Windows the WebView reaches custom schemes as
//! `http://maint-asset.localhost/…`; the frontend picks the form (engine/client.ts).

use crate::engine::Engine;
use tauri::http::{Request, Response, StatusCode, header};

pub const SCHEME: &str = "maint-asset";

pub fn respond(engine: &Engine, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = request.uri().path().trim_start_matches('/');
    let Some((pack_id, asset_id)) = path.split_once('/') else {
        return not_found();
    };
    match read(engine, pack_id, asset_id) {
        Ok(Some((media_type, bytes))) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, media_type)
            .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
            .body(bytes)
            .unwrap_or_else(|_| not_found()),
        Ok(None) => not_found(),
        Err(e) => {
            eprintln!("maint: asset {pack_id}/{asset_id}: {e}");
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Vec::new())
                .unwrap_or_else(|_| not_found())
        }
    }
}

pub fn not_found() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Vec::new())
        .expect("a bare 404 builds")
}

/// The asset's media type and bytes, re-hashed against the signed manifest by the core.
fn read(
    engine: &Engine,
    pack_id: &str,
    asset_id: &str,
) -> Result<Option<(String, Vec<u8>)>, String> {
    engine.asset(pack_id, asset_id)
}
