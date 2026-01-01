use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GamePackInfo {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
}
