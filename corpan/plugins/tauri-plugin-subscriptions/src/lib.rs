use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
mod error;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::Subscriptions;
#[cfg(mobile)]
use mobile::Subscriptions;

/// Extension trait on `Manager<R>` for reaching the plugin state.
pub trait SubscriptionsExt<R: Runtime> {
    fn subscriptions(&self) -> &Subscriptions<R>;
}

impl<R: Runtime, T: Manager<R>> SubscriptionsExt<R> for T {
    fn subscriptions(&self) -> &Subscriptions<R> {
        self.state::<Subscriptions<R>>().inner()
    }
}

/// Initialize the `subscriptions` plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("subscriptions")
        .invoke_handler(tauri::generate_handler![commands::show_manage_subscriptions])
        .setup(|app, _api| {
            #[cfg(mobile)]
            {
                let subs = mobile::init(app, _api)?;
                app.manage(subs);
            }

            #[cfg(desktop)]
            {
                let subs = desktop::Subscriptions::init(app)?;
                app.manage(subs);
            }

            Ok(())
        })
        .build()
}
