use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub id: i64,
    pub parent_name: String,
    pub current_student_id: Option<i64>,
    pub timezone: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Student {
    pub id: i64,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Day {
    pub date: String, // YYYY-MM-DD
    pub student_id: i64,
    pub is_homeschool_day: bool,
    pub notes: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Photo {
    pub id: i64,
    pub date: String, // YYYY-MM-DD
    pub student_id: i64,
    pub file_path: String, // Relative path
    pub original_filename: Option<String>, // NEW FIELD
    pub caption: String,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DayUpdate {
    pub is_homeschool_day: Option<bool>,
    pub notes: Option<String>,
}

/// Get the database file path in app data directory
pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    Ok(app_data_dir.join("data.sqlite3"))
}

/// NUCLEAR OPTION: Delete the database file completely
/// USE WITH CAUTION - This deletes all data permanently
pub fn nuke_database(app: &AppHandle) -> Result<(), String> {
    let db_path = get_db_path(app)?;

    if db_path.exists() {
        std::fs::remove_file(&db_path)
            .map_err(|e| format!("Failed to delete database: {}", e))?;
        println!("Database nuked: {:?}", db_path);
    } else {
        println!("No database file to delete");
    }

    Ok(())
}

/// Get a database connection
pub fn get_connection(app: &AppHandle) -> Result<Connection, String> {
    let db_path = get_db_path(app)?;
    Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))
}

/// Check if database needs migration from old schema
#[allow(dead_code)] // Reserved for future migrations; keeping logic intact.
fn check_needs_migration(conn: &Connection) -> Result<bool, String> {
    // Check if photos table exists and if it has student_id column
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='photos'",
        [],
        |row| row.get::<_, i32>(0).map(|count| count > 0)
    ).map_err(|e| format!("Failed to check table existence: {}", e))?;

    if !table_exists {
        return Ok(false); // Fresh install, no migration needed
    }

    // Check if student_id column exists in photos table
    let has_student_id: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('photos') WHERE name='student_id'",
        [],
        |row| row.get::<_, i32>(0).map(|count| count > 0)
    ).map_err(|e| format!("Failed to check column existence: {}", e))?;

    Ok(!has_student_id) // Need migration if student_id column is missing
}

/// Migrate from old single-student schema to new multi-student schema
#[allow(dead_code)] // Reserved for future migrations; keeping logic intact.
fn migrate_to_multi_student(conn: &Connection) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();

    println!("Starting migration to multi-student schema...");

    // Create students table if not exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create students table in migration: {}", e))?;

    // Create a default student
    let default_student_name = "My Student"; // Default name for migrated data
    conn.execute(
        "INSERT INTO students (name, created_at, updated_at) VALUES (?1, ?2, ?2)",
        params![default_student_name, now],
    ).map_err(|e| format!("Failed to create default student: {}", e))?;

    let default_student_id: i64 = conn.last_insert_rowid();
    println!("Created default student with ID: {}", default_student_id);

    // Migrate days table
    let days_has_student_id: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('days') WHERE name='student_id'",
        [],
        |row| row.get::<_, i32>(0).map(|count| count > 0)
    ).unwrap_or(false);

    if !days_has_student_id {
        println!("Migrating days table...");

        // Rename old table
        conn.execute("ALTER TABLE days RENAME TO days_old", [])
            .map_err(|e| format!("Failed to rename days table: {}", e))?;

        // Create new table with student_id
        conn.execute(
            "CREATE TABLE days (
                date TEXT NOT NULL,
                student_id INTEGER NOT NULL,
                is_homeschool_day INTEGER NOT NULL DEFAULT 0,
                notes TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (date, student_id),
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )",
            [],
        ).map_err(|e| format!("Failed to create new days table: {}", e))?;

        // Copy data with default student_id
        conn.execute(
            "INSERT INTO days (date, student_id, is_homeschool_day, notes, created_at, updated_at)
             SELECT date, ?1, is_homeschool_day, notes, created_at, updated_at FROM days_old",
            params![default_student_id],
        ).map_err(|e| format!("Failed to copy days data: {}", e))?;

        // Drop old table
        conn.execute("DROP TABLE days_old", [])
            .map_err(|e| format!("Failed to drop old days table: {}", e))?;

        println!("Days table migrated successfully");
    }

    // Migrate photos table
    println!("Migrating photos table...");

    // Rename old table
    conn.execute("ALTER TABLE photos RENAME TO photos_old", [])
        .map_err(|e| format!("Failed to rename photos table: {}", e))?;

    // Create new table with student_id
    conn.execute(
        "CREATE TABLE photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            student_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            original_filename TEXT,
            caption TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (date, student_id) REFERENCES days(date, student_id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("Failed to create new photos table: {}", e))?;

    // Copy data with default student_id
    conn.execute(
        "INSERT INTO photos (id, date, student_id, file_path, original_filename, caption, created_at)
         SELECT id, date, ?1, file_path, NULL, caption, created_at FROM photos_old",
        params![default_student_id],
    ).map_err(|e| format!("Failed to copy photos data: {}", e))?;

    // Drop old table
    conn.execute("DROP TABLE photos_old", [])
        .map_err(|e| format!("Failed to drop old photos table: {}", e))?;

    println!("Photos table migrated successfully");

    // Update settings to set current_student_id
    conn.execute(
        "UPDATE settings SET current_student_id = ?1 WHERE id = 1",
        params![default_student_id],
    ).map_err(|e| format!("Failed to update settings with student_id: {}", e))?;

    println!("Migration completed successfully!");
    Ok(())
}

/// Initialize database with schema
pub fn init_db(app: &AppHandle) -> Result<(), String> {
    // Try to initialize, if it fails due to schema mismatch, nuke and retry
    match init_db_internal(app) {
        Ok(_) => Ok(()),
        Err(e) if e.contains("no such column") || e.contains("has no column named") => {
            println!("Schema mismatch detected, nuking database and starting fresh...");
            nuke_database(app)?;
            init_db_internal(app)
        }
        Err(e) => Err(e),
    }
}

/// Internal initialization (may fail if schema is incompatible)
fn init_db_internal(app: &AppHandle) -> Result<(), String> {
    let conn = get_connection(app)?;

    // Create settings table first
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            parent_name TEXT NOT NULL DEFAULT '',
            current_student_id INTEGER,
            timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create settings table: {}", e))?;

    // Create students table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create students table: {}", e))?;

    // Create days table (migration-safe with student_id)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS days (
            date TEXT NOT NULL,
            student_id INTEGER NOT NULL,
            is_homeschool_day INTEGER NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (date, student_id),
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("Failed to create days table: {}", e))?;

    // Create photos table (updated for new schema)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            student_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            original_filename TEXT,
            caption TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (date, student_id) REFERENCES days(date, student_id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("Failed to create photos table: {}", e))?;

    // Migrate existing databases: add original_filename column if it doesn't exist
    let has_original_filename: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('photos') WHERE name='original_filename'",
        [],
        |row| row.get::<_, i32>(0).map(|count| count > 0)
    ).unwrap_or(false);

    if !has_original_filename {
        conn.execute(
            "ALTER TABLE photos ADD COLUMN original_filename TEXT",
            [],
        ).map_err(|e| format!("Failed to add original_filename column: {}", e))?;
    }

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_photos_date_student ON photos(date, student_id)",
        [],
    ).map_err(|e| format!("Failed to create photos index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_days_student_homeschool ON days(student_id, is_homeschool_day)",
        [],
    ).map_err(|e| format!("Failed to create days index: {}", e))?;

    // Initialize default settings if not exists
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT OR IGNORE INTO settings (id, parent_name, current_student_id, timezone, created_at, updated_at)
         VALUES (1, '', NULL, 'America/Los_Angeles', ?1, ?1)",
        params![now],
    ).map_err(|e| format!("Failed to initialize settings: {}", e))?;

    Ok(())
}

/// Get settings
pub fn get_settings(app: &AppHandle) -> Result<Settings, String> {
    let conn = get_connection(app)?;

    let mut stmt = conn.prepare(
        "SELECT id, parent_name, current_student_id, timezone, created_at, updated_at
         FROM settings WHERE id = 1"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let settings = stmt.query_row([], |row| {
        Ok(Settings {
            id: row.get(0)?,
            parent_name: row.get(1)?,
            current_student_id: row.get(2)?,
            timezone: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| format!("Failed to get settings: {}", e))?;

    Ok(settings)
}

/// Update settings
pub fn update_settings(app: &AppHandle, settings: Settings) -> Result<(), String> {
    let conn = get_connection(app)?;
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE settings SET parent_name = ?1, current_student_id = ?2, timezone = ?3, updated_at = ?4
         WHERE id = 1",
        params![settings.parent_name, settings.current_student_id, settings.timezone, now],
    ).map_err(|e| format!("Failed to update settings: {}", e))?;

    Ok(())
}

/// Get a single day
pub fn get_day(app: &AppHandle, date: &str, student_id: i64) -> Result<Option<Day>, String> {
    let conn = get_connection(app)?;

    let mut stmt = conn.prepare(
        "SELECT date, student_id, is_homeschool_day, notes, created_at, updated_at
         FROM days WHERE date = ?1 AND student_id = ?2"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let result = stmt.query_row(params![date, student_id], |row| {
        Ok(Day {
            date: row.get(0)?,
            student_id: row.get(1)?,
            is_homeschool_day: row.get::<_, i64>(2)? != 0,
            notes: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    });

    match result {
        Ok(day) => Ok(Some(day)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get day: {}", e)),
    }
}

/// Get days in a month for a student
pub fn get_days_in_month(app: &AppHandle, student_id: i64, year: i32, month: u32) -> Result<Vec<Day>, String> {
    let conn = get_connection(app)?;

    let start_date = format!("{:04}-{:02}-01", year, month);
    let end_date = if month == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{:04}-{:02}-01", year, month + 1)
    };

    let mut stmt = conn.prepare(
        "SELECT date, student_id, is_homeschool_day, notes, created_at, updated_at
         FROM days WHERE student_id = ?1 AND date >= ?2 AND date < ?3 ORDER BY date"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let days = stmt.query_map(params![student_id, start_date, end_date], |row| {
        Ok(Day {
            date: row.get(0)?,
            student_id: row.get(1)?,
            is_homeschool_day: row.get::<_, i64>(2)? != 0,
            notes: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| format!("Failed to query days: {}", e))?
    .collect::<SqlResult<Vec<Day>>>()
    .map_err(|e| format!("Failed to collect days: {}", e))?;

    Ok(days)
}

/// Update or create a day
pub fn update_day(app: &AppHandle, student_id: i64, date: &str, updates: DayUpdate) -> Result<Day, String> {
    let conn = get_connection(app)?;
    let now = chrono::Utc::now().timestamp();

    // Check if day exists
    let existing = get_day(app, date, student_id)?;

    if let Some(mut day) = existing {
        // Update existing day
        if let Some(is_homeschool) = updates.is_homeschool_day {
            day.is_homeschool_day = is_homeschool;
        }
        if let Some(notes) = updates.notes {
            day.notes = notes;
        }
        day.updated_at = now;

        conn.execute(
            "UPDATE days SET is_homeschool_day = ?1, notes = ?2, updated_at = ?3
             WHERE date = ?4 AND student_id = ?5",
            params![day.is_homeschool_day as i64, &day.notes, now, date, student_id],
        ).map_err(|e| format!("Failed to update day: {}", e))?;

        Ok(day)
    } else {
        // Create new day
        let is_homeschool = updates.is_homeschool_day.unwrap_or(false);
        let notes = updates.notes.unwrap_or_default();

        conn.execute(
            "INSERT INTO days (date, student_id, is_homeschool_day, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![date, student_id, is_homeschool as i64, &notes, now],
        ).map_err(|e| format!("Failed to create day: {}", e))?;

        Ok(Day {
            date: date.to_string(),
            student_id,
            is_homeschool_day: is_homeschool,
            notes,
            created_at: now,
            updated_at: now,
        })
    }
}

/// Add a photo
pub fn add_photo(app: &AppHandle, student_id: i64, date: &str, file_path: &str, original_filename: Option<String>) -> Result<Photo, String> {
    let conn = get_connection(app)?;
    let now = chrono::Utc::now().timestamp();

    // Ensure the day exists before adding a photo (foreign key requirement)
    conn.execute(
        "INSERT OR IGNORE INTO days (date, student_id, is_homeschool_day, notes, created_at, updated_at)
         VALUES (?1, ?2, 0, '', ?3, ?3)",
        params![date, student_id, now],
    ).map_err(|e| format!("Failed to ensure day exists: {}", e))?;

    conn.execute(
        "INSERT INTO photos (date, student_id, file_path, original_filename, caption, created_at)
         VALUES (?1, ?2, ?3, ?4, '', ?5)",
        params![date, student_id, file_path, original_filename, now],
    ).map_err(|e| format!("Failed to add photo: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(Photo {
        id,
        date: date.to_string(),
        student_id,
        file_path: file_path.to_string(),
        original_filename,
        caption: String::new(),
        created_at: now,
    })
}

/// Delete a photo
pub fn delete_photo(app: &AppHandle, id: i64) -> Result<String, String> {
    let conn = get_connection(app)?;

    // Get file path before deleting
    let mut stmt = conn.prepare("SELECT file_path FROM photos WHERE id = ?1")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let file_path: String = stmt.query_row(params![id], |row| row.get(0))
        .map_err(|e| format!("Failed to get photo file path: {}", e))?;

    conn.execute("DELETE FROM photos WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete photo: {}", e))?;

    Ok(file_path)
}

/// Get photos for a date
pub fn get_photos_for_date(app: &AppHandle, student_id: i64, date: &str) -> Result<Vec<Photo>, String> {
    let conn = get_connection(app)?;

    let mut stmt = conn.prepare(
        "SELECT id, date, student_id, file_path, original_filename, caption, created_at
         FROM photos WHERE date = ?1 AND student_id = ?2 ORDER BY created_at"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let photos = stmt.query_map(params![date, student_id], |row| {
        Ok(Photo {
            id: row.get(0)?,
            date: row.get(1)?,
            student_id: row.get(2)?,
            file_path: row.get(3)?,
            original_filename: row.get(4)?,
            caption: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| format!("Failed to query photos: {}", e))?
    .collect::<SqlResult<Vec<Photo>>>()
    .map_err(|e| format!("Failed to collect photos: {}", e))?;

    Ok(photos)
}

/// Get photo count for a date
#[allow(dead_code)] // Not currently called by the app, but kept for future UI.
pub fn get_photo_count_for_date(app: &AppHandle, student_id: i64, date: &str) -> Result<i64, String> {
    let conn = get_connection(app)?;

    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM photos WHERE date = ?1 AND student_id = ?2",
        params![date, student_id],
        |row| row.get(0)
    ).map_err(|e| format!("Failed to get photo count: {}", e))?;

    Ok(count)
}

/// Get photo counts for all dates in a month
pub fn get_photo_counts_for_month(app: &AppHandle, student_id: i64, year: i32, month: i32) -> Result<std::collections::HashMap<String, i64>, String> {
    let conn = get_connection(app)?;

    // Create date range for the month (YYYY-MM-01 to YYYY-MM-31)
    let start_date = format!("{:04}-{:02}-01", year, month);
    let end_date = format!("{:04}-{:02}-31", year, month);

    let mut stmt = conn.prepare(
        "SELECT date, COUNT(*) as count
         FROM photos
         WHERE student_id = ?1 AND date >= ?2 AND date <= ?3
         GROUP BY date"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let counts = stmt.query_map(params![student_id, start_date, end_date], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| format!("Failed to execute query: {}", e))?
        .collect::<Result<std::collections::HashMap<String, i64>, _>>()
        .map_err(|e| format!("Failed to collect results: {}", e))?;

    Ok(counts)
}

// ===== Student Management =====

/// Get all students
pub fn get_students(app: &AppHandle) -> Result<Vec<Student>, String> {
    let conn = get_connection(app)?;

    let mut stmt = conn.prepare(
        "SELECT id, name, created_at, updated_at
         FROM students ORDER BY created_at"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let students = stmt.query_map([], |row| {
        Ok(Student {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
        })
    }).map_err(|e| format!("Failed to query students: {}", e))?
    .collect::<SqlResult<Vec<Student>>>()
    .map_err(|e| format!("Failed to collect students: {}", e))?;

    Ok(students)
}

/// Add a student
pub fn add_student(app: &AppHandle, name: &str) -> Result<Student, String> {
    let conn = get_connection(app)?;
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO students (name, created_at, updated_at)
         VALUES (?1, ?2, ?2)",
        params![name, now],
    ).map_err(|e| format!("Failed to add student: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(Student {
        id,
        name: name.to_string(),
        created_at: now,
        updated_at: now,
    })
}

/// Update a student
pub fn update_student(app: &AppHandle, id: i64, name: &str) -> Result<(), String> {
    let conn = get_connection(app)?;
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE students SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, now, id],
    ).map_err(|e| format!("Failed to update student: {}", e))?;

    Ok(())
}

/// Delete a student (and all their data via CASCADE)
pub fn delete_student(app: &AppHandle, id: i64) -> Result<(), String> {
    let conn = get_connection(app)?;

    conn.execute(
        "DELETE FROM students WHERE id = ?1",
        params![id],
    ).map_err(|e| format!("Failed to delete student: {}", e))?;

    Ok(())
}

/// Get total homeschool days count for a student
pub fn get_total_homeschool_days(app: &AppHandle, student_id: i64) -> Result<i64, String> {
    let conn = get_connection(app)?;

    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM days WHERE student_id = ?1 AND is_homeschool_day = 1",
        params![student_id],
        |row| row.get(0)
    ).map_err(|e| format!("Failed to get total homeschool days: {}", e))?;

    Ok(count)
}
