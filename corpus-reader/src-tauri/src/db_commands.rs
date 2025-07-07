use crate::config::DB_PATH;
use sqlx::{Pool, Sqlite};
use tauri::Manager;
use tauri_plugin_sql::{DbInstances, DbPool};

#[tauri::command]
pub async fn get_db(app: tauri::AppHandle) -> Result<Pool<Sqlite>, String> {
    let instances = app.state::<DbInstances>();
    let instances_guard = instances.0.read().await;

    let db_pool_enum_ref = instances_guard
        .get(DB_PATH)
        .ok_or_else(|| "Database instance 'sqlite:library.db' not found.".to_string())?;

    match db_pool_enum_ref {
        DbPool::Sqlite(pool) => {
            let my_pool = pool.clone();
            return Ok(my_pool);
        }
        _ => Err("Found a database instance but it's not a Sqlite pool.".to_string()),
    }
}

#[tauri::command]
pub async fn add_book_to_db(
    app: tauri::AppHandle,
    title: String,
    author: String,
    cover_path: String,
    lang: String,
    path: String,
    publisher: String,
    publication_date: String,
) {
    let db = get_db(app).await.unwrap();
    let query_string = r#"
    INSERT INTO books (title, author, cover_path, lang, path, publisher, publication_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
"#;
    sqlx::query(query_string)
        .bind(title)
        .bind(author)
        .bind(cover_path)
        .bind(lang)
        .bind(path)
        .bind(publisher)
        .bind(publication_date)
        .execute(&db)
        .await
        .unwrap();
    println!("Book added to library:");
}
