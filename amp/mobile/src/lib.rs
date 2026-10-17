mod transport;
use amp_native_session::{ApiResult, LearningRequest, NativeSession, PublicSession, SessionError};
use serde::Serialize;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
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
fn native_status(
    transport: tauri::State<'_, PublicTransport>,
    session: tauri::State<'_, Arc<NativeSession>>,
) -> NativeStatus {
    NativeStatus {
        api_configuration: transport.configuration(),
        authentication: session.configuration() == "configured",
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionEvent {
    session: Option<PublicSession>,
    error: Option<&'static str>,
}

#[tauri::command]
async fn native_session(
    session: tauri::State<'_, Arc<NativeSession>>,
) -> Result<Option<PublicSession>, SessionError> {
    Ok(session.current().await)
}
#[tauri::command]
async fn native_sign_in(
    app: tauri::AppHandle,
    session: tauri::State<'_, Arc<NativeSession>>,
) -> Result<(), SessionError> {
    let url = session.begin().await?;
    session
        .publish(|current, error| {
            let _ = app.emit(
                "amp-session",
                SessionEvent {
                    session: current,
                    error,
                },
            );
        })
        .await;
    session
        .open_pending(&url, |url| {
            app.opener()
                .open_url(url, None::<&str>)
                .map_err(|_| SessionError::Unavailable)
        })
        .await?;
    Ok(())
}
#[tauri::command]
async fn native_sign_out(
    app: tauri::AppHandle,
    session: tauri::State<'_, Arc<NativeSession>>,
) -> Result<(), SessionError> {
    session.logout().await;
    session
        .publish(|current, error| {
            let _ = app.emit(
                "amp-session",
                SessionEvent {
                    session: current,
                    error,
                },
            );
        })
        .await;
    Ok(())
}
#[tauri::command]
async fn native_learning_request(
    session: tauri::State<'_, Arc<NativeSession>>,
    handle: String,
    request: LearningRequest,
) -> Result<ApiResult, SessionError> {
    session.request(&handle, request).await
}

fn receive_callback(app: tauri::AppHandle, raw: String) {
    tauri::async_runtime::spawn(async move {
        let service = app.state::<Arc<NativeSession>>().inner().clone();
        match service.complete(&raw).await {
            Ok(_) => {
                service
                    .publish(|current, error| {
                        let _ = app.emit(
                            "amp-session",
                            SessionEvent {
                                session: current,
                                error,
                            },
                        );
                    })
                    .await
            }
            Err(SessionError::InvalidCallback | SessionError::SessionChanged) => {}
            Err(_) => {
                service
                    .publish(|current, error| {
                        let _ = app.emit(
                            "amp-session",
                            SessionEvent {
                                session: current,
                                error,
                            },
                        );
                    })
                    .await
            }
        }
    });
}

/// Native tokens are held only by the session service; IPC exposes opaque handles.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let transport = PublicTransport::new(option_env!("AMP_NATIVE_API_ORIGIN"))
        .expect("Unable to initialize native HTTPS transport");
    let session = NativeSession::new(amp_native_session::SessionConfig::from_build())
        .expect("Unable to initialize native identity transport");
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(session))
        .setup(|app| {
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    receive_callback(handle.clone(), url.to_string());
                }
            });
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                for url in urls {
                    receive_callback(app.handle().clone(), url.to_string());
                }
            }
            Ok(())
        })
        .manage(transport)
        .invoke_handler(tauri::generate_handler![
            native_status,
            read_public_resource,
            native_session,
            native_sign_in,
            native_sign_out,
            native_learning_request
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start AMP native preview");
}
