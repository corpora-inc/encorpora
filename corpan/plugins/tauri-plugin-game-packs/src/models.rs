use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct GamePackInfo {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
}
