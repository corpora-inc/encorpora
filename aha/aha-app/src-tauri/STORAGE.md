# Local persistence contract

`NativeRepository(accountId)` calls the single `local_repository` native command
with a closed operation enum. The caller gets `accountId` from the authenticated
Free2Z session; it is an ownership partition, not a replacement for OS device security.
A single native mutex serializes commands on the blocking worker pool, keeping
database and backup work off the UI thread. SQLite uses WAL, FULL synchronous
writes, foreign keys and transactional migrations in app-local `learning.sqlite3`.
No raw SQL or arbitrary file paths cross the bridge. No silent web-storage fallback.

Profiles retain historical sessions plus a resumable current-session copy.
They own session, activity, attempt and snapshot records through composite
account/profile keys. Activities are immutable, attempts append-only, and duplicate
attempt IDs must match their original payload. Recording an attempt and replacing
its derived snapshot is one transaction; retry returns the current durable snapshot.
Persist the activity before submitting its first answer. Persist a paused session
before backgrounding; storage rejects failures instead of pretending they succeeded.

The caller owns domain schema versions inside `data` and `snapshot`. Each record is
limited to 512 KiB. Journals are opaque account-scoped SDK state, subject to the same
limit, and must contain no raw bearer tokens or private keys. Native secure storage
belongs to the SDK integration, not the learning database.

Backups are JSON envelope version 1 with account ownership and SHA-256 over a
canonical serialized payload. Export reads one SQLite snapshot. Import validates
size (32 MiB), version, owner, hash, record keys, references and duplicate keys,
then replaces that account's learning data transactionally; other accounts remain
untouched. SHA-256 detects accidental corruption, not malicious rewriting. Backup
JSON is plaintext and the export UI must make that clear. Auth/billing journals are
excluded and remain unchanged on restore, so restoring learning progress cannot
replay an old payment operation. Profile deletion cascades learning records;
account deletion removes profiles, its journals and its recovery snapshot atomically.
A successful import atomically saves the prior account learning data in `recovery`,
so `getRecoveryBackup()` can recover from importing a valid but older backup.
The recovery snapshot is excluded from normal export to prevent recursive backups.

An app update whose database schema is newer than this binary is refused, never
reset. `PRAGMA user_version` 1 is the initial schema; version 2 adds the recovery snapshot table. Add future migrations in
transactions and extend reopen/import compatibility tests.


## Native document flow

`shareBackup()` exports through the iOS share sheet, or the system save dialog
(Android `ACTION_CREATE_DOCUMENT`, native desktop picker). No WebView filesystem
paths are accepted. On iOS, `true` means the sheet was presented, not that the user
finished exporting. The private share file remains until next launch because share
extensions read lazily; app startup removes these app-generated temporary files.
On Android/desktop, `false` means the picker was cancelled.

`pickBackup()` reads at most 32 MiB plus one sentinel byte from a system-selected
file via the native filesystem plugin, including Android `content://` URIs. It
validates a full restore against an isolated database and returns a preview with
counts and the backup text; it never changes live progress. The UI confirms the
replacement before `restoreBackup(preview.backup)`. No filesystem, dialog or share
plugin permissions are granted to JavaScript; only these account-based native
commands are exposed. Use `getRecoveryBackup()` then preview/confirm/restore to
undo an import. Dialog presentation and external provider behavior still require
physical-device testing.
