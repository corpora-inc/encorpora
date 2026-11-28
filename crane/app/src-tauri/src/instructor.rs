//! The Instructor in the native app: harvest-core answers every turn
//! (harvest/CONTRACT.md "Instructor turns"). The app owns the conversation;
//! each call is stateless. Tree moves are answered from the course tree;
//! free text goes through the on-device model when one is loaded and through
//! tree and rule search when not. The model is not wired yet: `llm` is None,
//! the hook for tauri-plugin-corpan-llm.

use harvest_core::Engine;
use harvest_core::course::CourseTree;
use harvest_core::instructor::{Instructor, Learner, Turn, TurnRequest};
use std::sync::{Arc, OnceLock};
use tauri::AppHandle;

static INSTRUCTOR: OnceLock<Result<Arc<Instructor>, String>> = OnceLock::new();

fn instructor(app: &AppHandle) -> Result<Arc<Instructor>, String> {
    INSTRUCTOR
        .get_or_init(|| {
            let pack = crate::pack::opened(app)?;
            let tree = CourseTree::from_pack(&pack, None).map_err(|e| e.to_string())?;
            Ok(Arc::new(Instructor::new(
                Arc::new(Engine::new(pack)),
                None,
                tree,
            )))
        })
        .clone()
}

/// The opening turn: the pack's welcome, checked on read.
#[tauri::command]
pub async fn instructor_welcome(app: AppHandle, learner: Learner) -> Result<Turn, String> {
    tauri::async_runtime::spawn_blocking(move || {
        instructor(&app)?
            .welcome(&learner)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// One turn for a request (history, learner, where the conversation is, and the words or the tapped move).
#[tauri::command]
pub async fn instructor_turn(app: AppHandle, request: TurnRequest) -> Result<Turn, String> {
    tauri::async_runtime::spawn_blocking(move || {
        instructor(&app)?.turn(&request).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
