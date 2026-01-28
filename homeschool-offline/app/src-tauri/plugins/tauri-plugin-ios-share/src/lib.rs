use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(target_os = "ios")]
mod mobile;

#[cfg(target_os = "ios")]
use mobile::IOSShare;

/// Extensions to access the iOS share APIs.
#[cfg(target_os = "ios")]
pub trait IOSShareExt<R: Runtime> {
    fn ios_share(&self) -> &IOSShare<R>;
}

#[cfg(target_os = "ios")]
impl<R: Runtime, T: Manager<R>> IOSShareExt<R> for T {
    fn ios_share(&self) -> &IOSShare<R> {
        self.state::<IOSShare<R>>().inner()
    }
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_ios_share);

#[tauri::command]
async fn share_file<R: Runtime>(
    app: tauri::AppHandle<R>,
    file_path: String,
) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        app.ios_share()
            .share_file(file_path)
            .map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "ios"))]
    {
        Err("share_file is only available on iOS".to_string())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("ios-share")
        .invoke_handler(tauri::generate_handler![share_file])
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            {
                let ios_share = mobile::init(app, api)?;
                app.manage(ios_share);
            }
            Ok(())
        })
        .build()
}
