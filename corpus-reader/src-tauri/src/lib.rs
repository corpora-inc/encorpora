use tauri_plugin_sql::{Migration, MigrationKind};
mod config;
mod db_commands;
mod epub_commands;
mod file_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create books table",
            sql: "CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                last_read DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_read_page INTEGER DEFAULT 0,
                cover_path TEXT,
                lang TEXT,
                path TEXT NOT NULL,
                is_finished BOOLEAN DEFAULT FALSE,
                added_to_library_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                publisher TEXT,
                publication_date TEXT,
                rating INTEGER CHECK (rating >= 0 AND rating <= 5) DEFAULT 0
            )",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create bookmarks table",
            sql: "CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                cfi TEXT NOT NULL,
                page_number INTEGER,
                name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create highlights table",
            sql: "CREATE TABLE IF NOT EXISTS highlights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                cfi_range TEXT NOT NULL,
                color TEXT,
                note TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create notes table",
            sql: "CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                cfi TEXT,
                page_number INTEGER,
                title TEXT,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:library.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            file_commands::pick_file,
        ])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
