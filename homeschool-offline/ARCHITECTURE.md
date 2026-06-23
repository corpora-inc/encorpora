# Homeschool Offline - Architecture Documentation

## Overview

Homeschool Offline is built with Tauri 2, combining a Rust backend with a React frontend for a native, performant desktop and mobile application.

## Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 4** - Utility-first styling
- **Zustand 5** - State management with persistence
- **Radix UI** - Headless accessible components
- **date-fns** - Date utilities
- **lucide-react** - Icons

### Backend
- **Rust** - Systems programming language
- **Tauri 2** - Desktop/mobile app framework
- **rusqlite** (bundled) - SQLite database
- **serde/serde_json** - Serialization
- **zip** - Archive creation/extraction
- **chrono** - Date/time handling

## Data Model

### Database Schema

```sql
-- Settings (single row)
CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    parent_name TEXT NOT NULL DEFAULT '',
    grade_level TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Days (one row per date)
CREATE TABLE days (
    date TEXT PRIMARY KEY,  -- YYYY-MM-DD
    is_homeschool_day INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Photos (multiple per day)
CREATE TABLE photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    file_path TEXT NOT NULL,  -- Relative path
    caption TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (date) REFERENCES days(date) ON DELETE CASCADE
);

CREATE INDEX idx_photos_date ON photos(date);
CREATE INDEX idx_days_is_homeschool ON days(is_homeschool_day);
```

### File System Structure

```
{app_data_dir}/
├── data.sqlite3           # SQLite database
└── photos/                # Photo storage
    ├── 2026-01-10/
    │   ├── 1737389472123.jpg
    │   └── 1737389485678.jpg
    └── 2026-01-15/
        └── 1737823456789.jpg
```

## Architecture Decisions

### 1. Hybrid Storage (SQLite + File System)

**Decision**: Store structured data in SQLite, photos in the file system

**Rationale**:
- SQLite BLOBs have performance limitations for large files
- File system storage allows easy inspection and debugging
- Photos can be previewed outside the app if needed
- Simpler backup/restore (just ZIP the entire app data dir)

### 2. State Management (Zustand with Persistence)

**Decision**: Use Zustand for global state with localStorage persistence

**Rationale**:
- Lightweight compared to Redux
- Simple API, easy to understand
- Built-in persistence middleware
- Type-safe with TypeScript
- Caches loaded data to reduce backend calls

### 3. Export Format (ZIP)

**Decision**: Export as ZIP containing SQLite DB + photos + manifest.json

**Rationale**:
- Single file for easy sharing/backup
- Preserves directory structure
- Cross-platform compatible
- Manifest provides metadata for validation
- Easy to inspect (standard ZIP format)

### 4. Auto-save Pattern

**Decision**: Auto-save notes on blur with debouncing

**Rationale**:
- No explicit "save" button needed
- Prevents data loss
- Debouncing reduces backend calls
- User-friendly (no interruptions)

## API Reference

### Tauri Commands

#### Database

```rust
init_db_command(app: AppHandle) -> Result<(), String>
```
Initialize database with schema. Called on app startup.

```rust
get_settings_command(app: AppHandle) -> Result<Settings, String>
```
Get app settings.

```rust
update_settings_command(app: AppHandle, settings: Settings) -> Result<(), String>
```
Update app settings.

```rust
get_day(app: AppHandle, date: String) -> Result<Option<Day>, String>
```
Get a single day's data by date (YYYY-MM-DD).

```rust
get_days_in_month_command(app: AppHandle, year: i32, month: u32) -> Result<Vec<Day>, String>
```
Get all days in a specific month.

```rust
update_day(app: AppHandle, date: String, updates: DayUpdate) -> Result<Day, String>
```
Update or create a day record.

#### Photos

```rust
add_photo_command(app: AppHandle, date: String, source_path: String) -> Result<Photo, String>
```
Copy a photo to managed storage and add to database.

```rust
delete_photo_command(app: AppHandle, id: i64) -> Result<(), String>
```
Delete a photo from database and file system.

```rust
get_photos_for_date(app: AppHandle, date: String) -> Result<Vec<Photo>, String>
```
Get all photos for a specific date.

#### Export/Import

```rust
export_data_command(app: AppHandle, dest_path: String) -> Result<(), String>
```
Export all data to a ZIP file.

```rust
import_data_command(app: AppHandle, source_path: String) -> Result<(), String>
```
Import data from a ZIP file (backs up current data first).

## Project Structure

```
homeschool-offline/
├── app/                           # Tauri app
│   ├── src/                       # React frontend
│   │   ├── components/
│   │   │   ├── ui/               # Reusable UI components
│   │   │   ├── Calendar.tsx
│   │   │   ├── MonthView.tsx
│   │   │   ├── DayView.tsx
│   │   │   ├── PhotoGallery.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   ├── ExportImport.tsx
│   │   │   └── WelcomeScreen.tsx
│   │   ├── store/                # Zustand stores
│   │   ├── lib/                  # Utilities
│   │   ├── types/                # TypeScript types
│   │   └── App.tsx               # Root component
│   │
│   ├── src-tauri/                # Rust backend
│   │   └── src/
│   │       ├── db.rs             # Database operations
│   │       ├── photos.rs         # Photo file operations
│   │       ├── export.rs         # Export to ZIP
│   │       ├── import.rs         # Import from ZIP
│   │       ├── lib.rs            # Command registry
│   │       └── main.rs           # Entry point
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.cjs
│
├── packs/                        # Future: Curriculum packs
└── plugins/                      # Future: Custom plugins
```

## Security Considerations

1. **No Network Access**: App requires no network permissions
2. **Local Storage Only**: All data stays on device
3. **File System Permissions**: Limited to app data directory
4. **Input Validation**: All user inputs are validated
5. **SQL Injection Protection**: Using parameterized queries

## Performance Optimizations

1. **Lazy Loading**: Only load current month's data
2. **Photo Caching**: Store photos on file system, not in DB
3. **State Caching**: Zustand caches loaded data
4. **Debounced Auto-save**: Reduces backend calls
5. **Indexed Queries**: Database indexes on common queries

## Future Enhancements

### Quarterly View
- 3-month calendar grid
- Statistics dashboard
- Filtered exports

### Multi-Student Support
- Multiple student profiles
- Per-student data separation
- Student filtering in UI

### Curriculum Packs
- Pre-loaded state requirements
- Grade-level checklists
- Premium pack monetization

### Advanced Features
- Search functionality
- Tags/categories
- Markdown notes
- Custom checklists
- Print-friendly reports
- Optional cloud sync

## Build & Distribution

### Desktop

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build
```

Outputs:
- **macOS**: `.dmg` and `.app`
- **Windows**: `.msi` and `.exe`
- **Linux**: `.deb`, `.rpm`, `.AppImage`

### Mobile (Future)

```bash
# iOS
npm run tauri ios dev

# Android
npm run tauri android dev
```

## Troubleshooting

### Database locked
- Only one instance should access the DB
- Check for zombie processes

### Photos not displaying
- Verify asset protocol is enabled
- Check file permissions
- Ensure photos directory exists

### Import fails
- Validate ZIP structure
- Check manifest.json format
- Ensure sufficient disk space

## Contributing

See main README for development setup.
