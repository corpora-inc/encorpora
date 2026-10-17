mod transport;
use serde::Serialize;
use transport::{PublicResource, PublicTransport, TransportError};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeStatus {
    api_configuration: &'static str,
    authentication: bool,
    purchases: bool,
    downloads: bool,
    exports: bool,
}

#[tauri::command]
fn native_status(transport: tauri::State<'_, PublicTransport>) -> NativeStatus {
    NativeStatus {
        api_configuration: transport.configuration(),
        authentication: false,
        purchases: false,
        downloads: false,
        exports: false,
    }
}

#[tauri::command]
async fn read_public_resource(
    transport: tauri::State<'_, PublicTransport>,
    resource: PublicResource,
) -> Result<serde_json::Value, TransportError> {
    transport.read(resource).await
}

/// Public transport only; no authenticated native commands are installed.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let transport = PublicTransport::new(option_env!("AMP_NATIVE_API_ORIGIN"))
        .expect("Unable to initialize native HTTPS transport");
    tauri::Builder::default()
        .manage(transport)
        .invoke_handler(tauri::generate_handler![
            native_status,
            read_public_resource
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start AMP native preview");
}
