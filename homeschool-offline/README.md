# Homeschool Offline

**100% offline, no cloud, you own your data.**

Homeschool Offline is a beautiful, privacy-first calendar app for homeschooling parents. Track your homeschooling activities, add notes and photos, and export your data for backups or device transfers—all without any cloud dependency.

## Features

- **Offline-First**: Works completely offline, no internet required
- **Calendar Views**: Month and day views for easy navigation
- **Track Homeschool Days**: Toggle days as homeschool/non-homeschool
- **Notes**: Add detailed notes about daily activities (auto-save)
- **Photos**: Attach photos from your device to any day
- **Export/Import**: Full data export as ZIP for backups and transfers
- **Privacy**: Your data stays on your device, period
- **Cross-Platform**: macOS, Windows, Linux, iOS, Android

## Getting Started

### First Launch

1. Launch Homeschool Offline
2. Enter your name and grade level (optional)
3. Click "Get Started"

### Daily Use

1. **Navigate the calendar**: Use the month view to browse dates
2. **Select a day**: Click any date to see details
3. **Mark homeschool days**: Toggle the "Homeschool Day" switch
4. **Add notes**: Type in the notes field (auto-saves when you click away)
5. **Add photos**: Click "Add Photo" and select images from your device

### Backup & Restore

**Export:**
1. Click the settings icon (top-right)
2. Click "Export Backup"
3. Choose a location to save the ZIP file

**Import:**
1. Click the settings icon (top-right)
2. Click "Import Backup"
3. Select a previously exported ZIP file
4. Your data will be restored (current data is backed up automatically)

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Tauri CLI

### Setup

```bash
cd app
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Backend**: Rust, Tauri 2
- **Database**: SQLite (local file)
- **Storage**: File system for photos

## Data Location

Your data is stored locally in:
- **macOS**: `~/Library/Application Support/com.homeschool.offline/`
- **Windows**: `C:\Users\{user}\AppData\Roaming\com.homeschool.offline\`
- **Linux**: `~/.local/share/com.homeschool.offline/`

## License

MIT License - See LICENSE file for details

## Support

For bugs or feature requests, please open an issue on GitHub.

## Credits

Built with love for homeschooling families.
