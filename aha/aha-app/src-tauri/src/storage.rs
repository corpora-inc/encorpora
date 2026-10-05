//! The database is authoritative. Commands never accept SQL or filesystem paths.
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{path::Path, time::Duration};

const MAX_JSON: usize = 512 * 1024;
pub const MAX_BACKUP: usize = 32 * 1024 * 1024;
type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn identifier(s: &str) -> Result<()> {
    if s.is_empty() || s.len() > 200 || s.chars().any(char::is_control) {
        return Err("Invalid identifier".into());
    }
    Ok(())
}
fn encoded(v: &Value) -> Result<String> {
    let s = serde_json::to_string(v).map_err(err)?;
    if s.len() > MAX_JSON {
        return Err("Record exceeds storage limit".into());
    }
    Ok(s)
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub account_id: String,
    pub operation: Operation,
    #[serde(default)]
    pub profile_id: String,
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub data: Value,
    #[serde(default)]
    pub snapshot: Value,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Operation {
    ListProfiles,
    SaveProfile,
    DeleteProfile,
    LoadSession,
    SaveSession,
    SaveActivity,
    ListActivities,
    RecordAttempt,
    RecordDispute,
    ListDisputes,
    ListAttempts,
    LoadSnapshot,
    GetJournal,
    PutJournal,
    DeleteJournal,
    ExportBackup,
    GetRecoveryBackup,
    RestoreBackup,
    DeleteAccount,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Backup {
    version: u32,
    account_id: String,
    payload: BackupPayload,
    sha256: String,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct BackupPayload {
    profiles: Vec<(String, Value)>,
    records: Vec<(String, String, String, Value)>,
}

pub fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path).map_err(err)?;
    conn.busy_timeout(Duration::from_secs(5)).map_err(err)?;
    conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;")
        .map_err(err)?;
    migrate(&conn)?;
    Ok(conn)
}
fn migrate(conn: &Connection) -> Result<()> {
    let version: u32 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(err)?;
    if version > 4 {
        return Err("Database requires a newer version of AHA".into());
    }
    if version == 0 {
        conn.execute_batch("BEGIN IMMEDIATE;
          CREATE TABLE profiles(account TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(account,id));
          CREATE TABLE records(account TEXT NOT NULL, profile TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('session','activity','attempt','snapshot')), id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(account,profile,kind,id), FOREIGN KEY(account,profile) REFERENCES profiles(account,id) ON DELETE CASCADE);
          CREATE TABLE journal(account TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(account,id));
          PRAGMA user_version=1; COMMIT;").map_err(err)?;
    }
    if version < 2 {
        conn.execute_batch("BEGIN IMMEDIATE; CREATE TABLE recovery(account TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL CHECK(json_valid(data))); PRAGMA user_version=2; COMMIT;").map_err(err)?;
    }
    if version < 3 {
        conn.execute_batch("BEGIN IMMEDIATE;
          CREATE TABLE records_v3(account TEXT NOT NULL, profile TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('session','activity','attempt','snapshot','dispute')), id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(account,profile,kind,id), FOREIGN KEY(account,profile) REFERENCES profiles(account,id) ON DELETE CASCADE);
          INSERT INTO records_v3 SELECT account,profile,kind,id,data FROM records ORDER BY rowid;
          DROP TABLE records; ALTER TABLE records_v3 RENAME TO records;
          PRAGMA user_version=3; COMMIT;").map_err(err)?;
    }
    if version < 4 {
        conn.execute_batch("BEGIN IMMEDIATE; CREATE UNIQUE INDEX one_attempt_per_activity ON records(account,profile,json_extract(data,'$.activityId')) WHERE kind='attempt'; PRAGMA user_version=4; COMMIT;").map_err(err)?;
    }
    Ok(())
}
fn read(conn: &Connection, account: &str, profile: &str, kind: &str, id: &str) -> Result<Value> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT data FROM records WHERE account=? AND profile=? AND kind=? AND id=?",
            params![account, profile, kind, id],
            |r| r.get(0),
        )
        .optional()
        .map_err(err)?;
    raw.map(|s| serde_json::from_str(&s).map_err(err))
        .transpose()
        .map(|v| v.unwrap_or(Value::Null))
}
fn put(
    conn: &Connection,
    account: &str,
    profile: &str,
    kind: &str,
    id: &str,
    data: &Value,
) -> Result<()> {
    conn.execute("INSERT INTO records(account,profile,kind,id,data) VALUES(?,?,?,?,?) ON CONFLICT(account,profile,kind,id) DO UPDATE SET data=excluded.data", params![account,profile,kind,id,encoded(data)?]).map_err(err)?;
    Ok(())
}
fn list(conn: &Connection, account: &str, profile: &str, kind: &str) -> Result<Value> {
    let mut stmt = conn
        .prepare("SELECT data FROM records WHERE account=? AND profile=? AND kind=? ORDER BY rowid")
        .map_err(err)?;
    let rows = stmt
        .query_map(params![account, profile, kind], |r| r.get::<_, String>(0))
        .map_err(err)?;
    let values: std::result::Result<Vec<Value>, String> = rows
        .map(|s| serde_json::from_str(&s.map_err(err)?).map_err(err))
        .collect();
    values.map(Value::Array)
}
fn validate_record(data: &Value, id: &str) -> Result<()> {
    if !data.is_object() || data.get("id").and_then(Value::as_str) != Some(id) {
        return Err("Record id does not match key".into());
    }
    encoded(data)?;
    Ok(())
}
pub fn execute(conn: &mut Connection, r: Request) -> Result<Value> {
    identifier(&r.account_id)?;
    let a = &r.account_id;
    let p = &r.profile_id;
    let k = &r.key;
    use Operation::*;
    match r.operation {
        ListProfiles => {
            let mut stmt = conn
                .prepare("SELECT data FROM profiles WHERE account=? ORDER BY rowid")
                .map_err(err)?;
            let rows = stmt
                .query_map([a], |r| r.get::<_, String>(0))
                .map_err(err)?;
            let values: Result<Vec<Value>> = rows
                .map(|s| serde_json::from_str(&s.map_err(err)?).map_err(err))
                .collect();
            values.map(Value::Array)
        }
        SaveProfile => {
            identifier(p)?;
            validate_record(&r.data, p)?;
            conn.execute("INSERT INTO profiles(account,id,data) VALUES(?,?,?) ON CONFLICT(account,id) DO UPDATE SET data=excluded.data",params![a,p,encoded(&r.data)?]).map_err(err)?;
            Ok(Value::Null)
        }
        DeleteProfile => {
            identifier(p)?;
            conn.execute(
                "DELETE FROM profiles WHERE account=? AND id=?",
                params![a, p],
            )
            .map_err(err)?;
            Ok(Value::Null)
        }
        DeleteAccount => {
            let tx = conn.transaction().map_err(err)?;
            tx.execute("DELETE FROM profiles WHERE account=?", [a])
                .map_err(err)?;
            tx.execute("DELETE FROM journal WHERE account=?", [a])
                .map_err(err)?;
            tx.execute("DELETE FROM recovery WHERE account=?", [a])
                .map_err(err)?;
            tx.commit().map_err(err)?;
            Ok(Value::Null)
        }
        GetJournal => {
            identifier(k)?;
            let raw: Option<String> = conn
                .query_row(
                    "SELECT data FROM journal WHERE account=? AND id=?",
                    params![a, k],
                    |r| r.get(0),
                )
                .optional()
                .map_err(err)?;
            raw.map(|s| serde_json::from_str(&s).map_err(err))
                .transpose()
                .map(|v| v.unwrap_or(Value::Null))
        }
        PutJournal => {
            identifier(k)?;
            conn.execute("INSERT INTO journal(account,id,data) VALUES(?,?,?) ON CONFLICT(account,id) DO UPDATE SET data=excluded.data",params![a,k,encoded(&r.data)?]).map_err(err)?;
            Ok(Value::Null)
        }
        DeleteJournal => {
            identifier(k)?;
            conn.execute(
                "DELETE FROM journal WHERE account=? AND id=?",
                params![a, k],
            )
            .map_err(err)?;
            Ok(Value::Null)
        }
        ExportBackup => export(conn, a).map(Value::String),
        GetRecoveryBackup => {
            let text: Option<String> = conn
                .query_row("SELECT data FROM recovery WHERE account=?", [a], |r| {
                    r.get(0)
                })
                .optional()
                .map_err(err)?;
            Ok(text.map(Value::String).unwrap_or(Value::Null))
        }
        RestoreBackup => {
            restore(conn, a, r.data.as_str().ok_or("Backup must be a string")?)?;
            Ok(Value::Null)
        }
        operation => {
            identifier(p)?;
            let exists: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM profiles WHERE account=? AND id=?)",
                    params![a, p],
                    |r| r.get(0),
                )
                .map_err(err)?;
            if !exists {
                return Err("Learner profile not found for this account".into());
            }
            match operation {
                LoadSession => read(conn, a, p, "session", "current"),
                SaveSession => {
                    let id = r
                        .data
                        .get("id")
                        .and_then(Value::as_str)
                        .ok_or("Session requires id")?;
                    identifier(id)?;
                    if id == "current" {
                        return Err("Reserved session identifier".into());
                    }
                    let tx = conn.transaction().map_err(err)?;
                    put(&tx, a, p, "session", id, &r.data)?;
                    put(&tx, a, p, "session", "current", &r.data)?;
                    tx.commit().map_err(err)?;
                    Ok(Value::Null)
                }
                LoadSnapshot => read(conn, a, p, "snapshot", "current"),
                ListActivities => list(conn, a, p, "activity"),
                ListAttempts => list(conn, a, p, "attempt"),
                ListDisputes => list(conn, a, p, "dispute"),
                RecordDispute => {
                    identifier(k)?;
                    validate_record(&r.data, k)?;
                    encoded(&r.snapshot)?;
                    let activity = r
                        .data
                        .get("activityId")
                        .and_then(Value::as_str)
                        .ok_or("Dispute requires activityId")?;
                    let reason = r
                        .data
                        .get("reason")
                        .and_then(Value::as_str)
                        .ok_or("Dispute requires reason")?;
                    if reason.trim().is_empty() || reason.len() > 2000 {
                        return Err("Dispute reason must be 1..2000 bytes".into());
                    }
                    let tx = conn.transaction().map_err(err)?;
                    let existing = read(&tx, a, p, "dispute", k)?;
                    if !existing.is_null() {
                        if existing != r.data {
                            return Err("Dispute id collision".into());
                        }
                        return Ok(Value::Null);
                    }
                    if read(&tx, a, p, "activity", activity)?.is_null() {
                        return Err("Disputed activity not found".into());
                    }
                    put(&tx, a, p, "dispute", k, &r.data)?;
                    put(&tx, a, p, "snapshot", "current", &r.snapshot)?;
                    tx.commit().map_err(err)?;
                    Ok(Value::Null)
                }
                SaveActivity => {
                    identifier(k)?;
                    validate_record(&r.data, k)?;
                    let existing = read(conn, a, p, "activity", k)?;
                    if !existing.is_null() && existing != r.data {
                        return Err("Activity ids are immutable".into());
                    }
                    put(conn, a, p, "activity", k, &r.data)?;
                    Ok(Value::Null)
                }
                RecordAttempt => {
                    identifier(k)?;
                    validate_record(&r.data, k)?;
                    encoded(&r.snapshot)?;
                    let activity = r
                        .data
                        .get("activityId")
                        .and_then(Value::as_str)
                        .ok_or("Attempt requires activityId")?;
                    let tx = conn.transaction().map_err(err)?;
                    let existing = read(&tx, a, p, "attempt", k)?;
                    if !existing.is_null() {
                        if existing != r.data {
                            return Err("Attempt id collision".into());
                        }
                        return Ok(
                            json!({"inserted":false,"snapshot":read(&tx,a,p,"snapshot","current")?}),
                        );
                    }
                    if read(&tx, a, p, "activity", activity)?.is_null() {
                        return Err("Attempt activity not found".into());
                    }
                    let disputed: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM records WHERE account=? AND profile=? AND kind='dispute' AND json_extract(data,'$.activityId')=?)", params![a,p,activity], |row|row.get(0)).map_err(err)?;
                    if disputed {
                        return Err("This activity is quarantined and cannot earn credit".into());
                    }
                    let answered: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM records WHERE account=? AND profile=? AND kind='attempt' AND json_extract(data,'$.activityId')=?)", params![a,p,activity], |row|row.get(0)).map_err(err)?;
                    if answered {
                        return Err("This activity has already been answered".into());
                    }
                    put(&tx, a, p, "attempt", k, &r.data)?;
                    put(&tx, a, p, "snapshot", "current", &r.snapshot)?;
                    tx.commit().map_err(err)?;
                    Ok(json!({"inserted":true,"snapshot":r.snapshot}))
                }
                _ => unreachable!(),
            }
        }
    }
}
/// SHA-256 of the payload's canonical form: every object's members sorted by name. Since
/// tauri-plugin-f2z d63959f9 this binary builds serde_json with `preserve_order`, so stored JSON keeps
/// its original member order; earlier (and older installed) builds sort members. Hashing the sorted
/// form gives the bytes a build without `preserve_order` hashes, so backups verify in both directions.
fn digest(payload: &BackupPayload) -> Result<String> {
    let mut canonical = serde_json::to_value(payload).map_err(err)?;
    canonical.sort_all_objects();
    Ok(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&canonical).map_err(err)?)
    ))
}
pub fn export(conn: &mut Connection, account: &str) -> Result<String> {
    identifier(account)?;
    let tx = conn.transaction().map_err(err)?;
    let profiles = {
        let mut s = tx
            .prepare("SELECT id,data FROM profiles WHERE account=? ORDER BY id")
            .map_err(err)?;
        let rows = s
            .query_map([account], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(err)?;
        rows.map(|row| {
            let (id, raw) = row.map_err(err)?;
            Ok((id, serde_json::from_str(&raw).map_err(err)?))
        })
        .collect::<Result<Vec<_>>>()?
    };
    let records = {
        let mut s = tx
            .prepare(
                "SELECT profile,kind,id,data FROM records WHERE account=? ORDER BY profile,kind,id",
            )
            .map_err(err)?;
        let rows = s
            .query_map([account], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            })
            .map_err(err)?;
        rows.map(|row| {
            let (p, k, id, raw) = row.map_err(err)?;
            Ok((p, k, id, serde_json::from_str(&raw).map_err(err)?))
        })
        .collect::<Result<Vec<_>>>()?
    };
    let payload = BackupPayload { profiles, records };
    let sha256 = digest(&payload)?;
    let text = serde_json::to_string(&Backup {
        version: 1,
        account_id: account.into(),
        payload,
        sha256,
    })
    .map_err(err)?;
    if text.len() > MAX_BACKUP {
        return Err("Backup exceeds 32 MiB limit".into());
    }
    tx.commit().map_err(err)?;
    Ok(text)
}
fn restore(conn: &mut Connection, account: &str, text: &str) -> Result<()> {
    if text.len() > MAX_BACKUP {
        return Err("Backup exceeds 32 MiB limit".into());
    }
    let b: Backup = serde_json::from_str(text).map_err(err)?;
    if b.version != 1 || b.account_id != account || digest(&b.payload)? != b.sha256 {
        return Err("Backup version, owner, or integrity mismatch".into());
    }
    let prior = export(conn, account)?;
    let tx = conn.transaction().map_err(err)?;
    tx.execute("INSERT INTO recovery(account,data) VALUES(?,?) ON CONFLICT(account) DO UPDATE SET data=excluded.data", params![account,prior]).map_err(err)?;
    tx.execute("DELETE FROM profiles WHERE account=?", [account])
        .map_err(err)?;
    for (id, data) in &b.payload.profiles {
        identifier(id)?;
        validate_record(data, id)?;
        tx.execute(
            "INSERT INTO profiles VALUES(?,?,?)",
            params![account, id, encoded(data)?],
        )
        .map_err(err)?;
    }
    for (profile, kind, id, data) in &b.payload.records {
        identifier(id)?;
        identifier(profile)?;
        if !["session", "activity", "attempt", "snapshot", "dispute"].contains(&kind.as_str()) {
            return Err("Invalid record kind".into());
        }
        if ["activity", "attempt", "dispute"].contains(&kind.as_str()) {
            validate_record(data, id)?;
        } else if kind == "snapshot" && id != "current" {
            return Err("Invalid singleton key".into());
        } else if kind == "session" && id != "current" {
            validate_record(data, id)?;
        }
        tx.execute(
            "INSERT INTO records VALUES(?,?,?,?,?)",
            params![account, profile, kind, id, encoded(data)?],
        )
        .map_err(err)?;
    }
    let orphan:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM records a WHERE a.account=? AND a.kind IN ('attempt','dispute') AND NOT EXISTS(SELECT 1 FROM records b WHERE b.account=a.account AND b.profile=a.profile AND b.kind='activity' AND b.id=json_extract(a.data,'$.activityId')))",[account],|r|r.get(0)).map_err(err)?;
    if orphan {
        return Err("Backup contains an orphan attempt or dispute".into());
    }
    // Billing/auth journals are intentionally not exported or restored: an old
    // payment operation must never be replayed by importing a learning backup.
    tx.commit().map_err(err)?;
    Ok(())
}

/// Validate the entire import without touching the live database.
/// Running the same restore validator in an isolated database prevents preview
/// and commit from accidentally using different integrity/reference rules.
pub fn preview(account: &str, text: &str) -> Result<Value> {
    identifier(account)?;
    let mut isolated = open(Path::new(":memory:"))?;
    restore(&mut isolated, account, text)?;
    let backup: Backup = serde_json::from_str(text).map_err(err)?;
    Ok(json!({
        "backup": text,
        "profileCount": backup.payload.profiles.len(),
        "activityCount": backup.payload.records.iter().filter(|r|r.1=="activity").count(),
        "attemptCount": backup.payload.records.iter().filter(|r|r.1=="attempt").count(),
        "disputeCount": backup.payload.records.iter().filter(|r|r.1=="dispute").count()
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        open(Path::new(":memory:")).unwrap()
    }
    fn request(account: &str, op: Operation, data: Value) -> Request {
        Request {
            account_id: account.into(),
            profile_id: "learner".into(),
            key: data
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("key")
                .into(),
            operation: op,
            data,
            snapshot: json!({"mastery":1}),
        }
    }
    fn profile(c: &mut Connection, a: &str) {
        execute(
            c,
            request(
                a,
                Operation::SaveProfile,
                json!({"id":"learner","name":"Learner"}),
            ),
        )
        .unwrap();
    }
    #[test]
    fn isolation_and_cascade() {
        let mut c = db();
        profile(&mut c, "a");
        profile(&mut c, "b");
        execute(
            &mut c,
            request("a", Operation::SaveSession, json!({"id":"session1"})),
        )
        .unwrap();
        assert_eq!(
            execute(&mut c, request("b", Operation::LoadSession, Value::Null)).unwrap(),
            Value::Null
        );
        execute(&mut c, request("a", Operation::DeleteProfile, Value::Null)).unwrap();
        assert!(execute(&mut c, request("a", Operation::LoadSession, Value::Null)).is_err());
        assert_eq!(
            execute(&mut c, request("b", Operation::ListProfiles, Value::Null))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn attempts_are_atomic_idempotent_and_immutable() {
        let mut c = db();
        profile(&mut c, "a");
        let attempt = json!({"id":"attempt","activityId":"activity"});
        assert!(
            execute(
                &mut c,
                request("a", Operation::RecordAttempt, attempt.clone())
            )
            .is_err()
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::LoadSnapshot, Value::Null)).unwrap(),
            Value::Null
        );
        execute(
            &mut c,
            request("a", Operation::SaveActivity, json!({"id":"activity"})),
        )
        .unwrap();
        assert_eq!(
            execute(
                &mut c,
                request("a", Operation::RecordAttempt, attempt.clone())
            )
            .unwrap()["inserted"],
            true
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::RecordAttempt, attempt)).unwrap()["inserted"],
            false
        );
        assert!(
            execute(
                &mut c,
                request(
                    "a",
                    Operation::RecordAttempt,
                    json!({"id":"attempt","activityId":"activity","answer":5})
                )
            )
            .is_err()
        );
    }
    /// tauri-plugin-f2z d63959f9 unifies serde_json `preserve_order` into this app, so stored JSON keeps the
    /// webview's member order. Every earlier build (and any older build a backup is restored on) re-sorts
    /// members. The digest must not depend on that: it hashes the canonical, member-sorted form.
    #[test]
    fn backup_digest_is_canonical_whatever_the_json_member_order() {
        let mut c = db();
        execute(
            &mut c,
            request(
                "a",
                Operation::SaveProfile,
                json!({"name":"Learner","id":"learner","grade":3}),
            ),
        )
        .unwrap();
        let backup = export(&mut c, "a").unwrap();
        let b: Backup = serde_json::from_str(&backup).unwrap();
        // Exactly what a build without `preserve_order` hashes for the same payload.
        let sorted = r#"{"profiles":[["learner",{"grade":3,"id":"learner","name":"Learner"}]],"records":[]}"#;
        assert_eq!(b.sha256, format!("{:x}", Sha256::digest(sorted.as_bytes())));
        // An older build's backup (members sorted) restores on this build...
        let older = format!(
            r#"{{"version":1,"accountId":"a","payload":{sorted},"sha256":"{}"}}"#,
            b.sha256
        );
        restore(&mut c, "a", &older).unwrap();
        // ...and this build's backup restores here, whatever order it stored.
        restore(&mut c, "a", &backup).unwrap();
        // Tampering still fails.
        assert!(restore(&mut c, "a", &older.replace("\"grade\":3", "\"grade\":4")).is_err());
    }
    #[test]
    fn backups_validate_owner_hash_and_rollback() {
        let mut c = db();
        profile(&mut c, "a");
        let backup = export(&mut c, "a").unwrap();
        assert!(restore(&mut c, "b", &backup).is_err());
        assert!(restore(&mut c, "a", &backup.replace("Learner", "Changed")).is_err());
        let mut b: Backup = serde_json::from_str(&backup).unwrap();
        b.payload
            .profiles
            .push(("learner".into(), json!({"id":"learner"})));
        b.sha256 = digest(&b.payload).unwrap();
        assert!(restore(&mut c, "a", &serde_json::to_string(&b).unwrap()).is_err());
        assert_eq!(
            execute(&mut c, request("a", Operation::ListProfiles, Value::Null)).unwrap()[0]["name"],
            "Learner"
        );
        restore(&mut c, "a", &backup).unwrap();
    }
    #[test]
    fn migrations_refuse_future_and_bound_records() {
        let mut c = db();
        c.pragma_update(None, "user_version", 5).unwrap();
        assert!(migrate(&c).is_err());
        assert!(encoded(&json!("x".repeat(MAX_JSON))).is_err());
        assert!(execute(&mut c, request("", Operation::ListProfiles, Value::Null)).is_err());
    }
    #[test]
    fn restore_retains_prior_account_snapshot_and_preview_is_read_only() {
        let mut c = db();
        profile(&mut c, "a");
        let old = export(&mut c, "a").unwrap();
        execute(
            &mut c,
            request(
                "a",
                Operation::SaveProfile,
                json!({"id":"learner","name":"New name"}),
            ),
        )
        .unwrap();
        assert_eq!(preview("a", &old).unwrap()["profileCount"], 1);
        assert_eq!(
            execute(&mut c, request("a", Operation::ListProfiles, Value::Null)).unwrap()[0]["name"],
            "New name"
        );
        restore(&mut c, "a", &old).unwrap();
        let recovery = execute(
            &mut c,
            request("a", Operation::GetRecoveryBackup, Value::Null),
        )
        .unwrap();
        assert!(recovery.as_str().unwrap().contains("New name"));
        assert_eq!(
            execute(
                &mut c,
                request("b", Operation::GetRecoveryBackup, Value::Null)
            )
            .unwrap(),
            Value::Null
        );
    }
    #[test]
    fn session_history_survives_resume_and_backup() {
        let mut c = db();
        profile(&mut c, "a");
        for id in ["first", "second"] {
            execute(
                &mut c,
                request("a", Operation::SaveSession, json!({"id":id,"data":{}})),
            )
            .unwrap();
        }
        assert_eq!(
            execute(&mut c, request("a", Operation::LoadSession, Value::Null)).unwrap()["id"],
            "second"
        );
        let backup = export(&mut c, "a").unwrap();
        restore(&mut c, "a", &backup).unwrap();
        assert_eq!(
            read(&c, "a", "learner", "session", "first").unwrap()["id"],
            "first"
        );
    }
    #[test]
    fn snapshot_write_failure_rolls_back_attempt() {
        let mut c = db();
        profile(&mut c, "a");
        execute(
            &mut c,
            request("a", Operation::SaveActivity, json!({"id":"activity"})),
        )
        .unwrap();
        c.execute_batch("CREATE TRIGGER reject_snapshot BEFORE INSERT ON records WHEN NEW.kind='snapshot' BEGIN SELECT RAISE(ABORT,'simulated disk write failure'); END;").unwrap();
        assert!(
            execute(
                &mut c,
                request(
                    "a",
                    Operation::RecordAttempt,
                    json!({"id":"attempt","activityId":"activity"})
                )
            )
            .is_err()
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::ListAttempts, Value::Null)).unwrap(),
            json!([])
        );
        assert!(
            execute(
                &mut c,
                request(
                    "a",
                    Operation::RecordDispute,
                    json!({"id":"dispute","activityId":"activity","reason":"incorrect key"})
                )
            )
            .is_err()
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::ListDisputes, Value::Null)).unwrap(),
            json!([])
        );
    }
    #[test]
    fn journals_remain_account_scoped_and_outside_backup() {
        let mut c = db();
        profile(&mut c, "a");
        execute(
            &mut c,
            request("a", Operation::PutJournal, json!({"operation":"pending"})),
        )
        .unwrap();
        assert_eq!(
            execute(&mut c, request("b", Operation::GetJournal, Value::Null)).unwrap(),
            Value::Null
        );
        let backup = export(&mut c, "a").unwrap();
        assert!(!backup.contains("pending"));
        restore(&mut c, "a", &backup).unwrap();
        assert_eq!(
            execute(&mut c, request("a", Operation::GetJournal, Value::Null)).unwrap()["operation"],
            "pending"
        );
        execute(&mut c, request("a", Operation::DeleteAccount, Value::Null)).unwrap();
        assert_eq!(
            execute(&mut c, request("a", Operation::GetJournal, Value::Null)).unwrap(),
            Value::Null
        );
    }
    #[test]
    fn version_one_upgrades_without_losing_progress() {
        let mut c = db();
        profile(&mut c, "a");
        c.execute_batch("DROP TABLE recovery; PRAGMA user_version=1;")
            .unwrap();
        migrate(&c).unwrap();
        assert_eq!(
            c.query_row("PRAGMA user_version", [], |r| r.get::<_, u32>(0))
                .unwrap(),
            4
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::ListProfiles, Value::Null))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            execute(
                &mut c,
                request("a", Operation::GetRecoveryBackup, Value::Null)
            )
            .unwrap(),
            Value::Null
        );
    }
    #[test]
    fn disputes_quarantine_atomically_and_deduplicate() {
        let path = std::env::temp_dir().join(format!(
            "aha-dispute-{}-{}.sqlite",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut c = open(&path).unwrap();
        profile(&mut c, "a");
        execute(
            &mut c,
            request("a", Operation::SaveActivity, json!({"id":"activity"})),
        )
        .unwrap();
        let mut attempt = request(
            "a",
            Operation::RecordAttempt,
            json!({"id":"answer","activityId":"activity"}),
        );
        attempt.snapshot = json!({"mastered":true});
        execute(&mut c, attempt).unwrap();
        let dispute = json!({"id":"dispute","activityId":"activity","reason":"incorrect answer key","createdAt":"2026-09-27"});
        let mut req = request("a", Operation::RecordDispute, dispute.clone());
        req.snapshot = json!({"mastered":false,"quarantined":["activity"]});
        execute(&mut c, req).unwrap();
        let mut replay = request("a", Operation::RecordDispute, dispute);
        replay.snapshot = json!({"mastered":true});
        execute(&mut c, replay).unwrap();
        assert_eq!(
            execute(&mut c, request("a", Operation::LoadSnapshot, Value::Null)).unwrap()["mastered"],
            false
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::ListDisputes, Value::Null))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        drop(c);
        let mut c = open(&path).unwrap();
        assert_eq!(
            execute(&mut c, request("a", Operation::LoadSnapshot, Value::Null)).unwrap()["mastered"],
            false
        );
        let backup = export(&mut c, "a").unwrap();
        let mut reopened = db();
        restore(&mut reopened, "a", &backup).unwrap();
        assert_eq!(
            execute(
                &mut reopened,
                request("a", Operation::LoadSnapshot, Value::Null)
            )
            .unwrap()["quarantined"],
            json!(["activity"])
        );
        assert!(
            execute(
                &mut c,
                request(
                    "a",
                    Operation::RecordDispute,
                    json!({"id":"dispute","activityId":"activity","reason":"different"})
                )
            )
            .is_err()
        );
        drop(c);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn pre_answer_dispute_permanently_prevents_credit() {
        let path = std::env::temp_dir().join(format!(
            "aha-predispute-{}-{}.sqlite",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut c = open(&path).unwrap();
        profile(&mut c, "a");
        execute(
            &mut c,
            request("a", Operation::SaveActivity, json!({"id":"activity"})),
        )
        .unwrap();
        let mut dispute = request(
            "a",
            Operation::RecordDispute,
            json!({"id":"dispute","activityId":"activity","reason":"wrong prompt"}),
        );
        dispute.snapshot = json!({"mastered":false});
        execute(&mut c, dispute).unwrap();
        drop(c);
        let mut c = open(&path).unwrap();
        let attempt = request(
            "a",
            Operation::RecordAttempt,
            json!({"id":"late-answer","activityId":"activity"}),
        );
        assert!(
            execute(&mut c, attempt)
                .unwrap_err()
                .contains("quarantined")
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::ListAttempts, Value::Null)).unwrap(),
            json!([])
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::LoadSnapshot, Value::Null)).unwrap()["mastered"],
            false
        );
        drop(c);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn different_attempt_ids_cannot_replace_first_evidence() {
        let mut c = db();
        profile(&mut c, "a");
        execute(
            &mut c,
            request("a", Operation::SaveActivity, json!({"id":"activity"})),
        )
        .unwrap();
        let mut first = request(
            "a",
            Operation::RecordAttempt,
            json!({"id":"first","activityId":"activity"}),
        );
        first.snapshot = json!({"mastered":true});
        execute(&mut c, first).unwrap();
        let mut retry = request(
            "a",
            Operation::RecordAttempt,
            json!({"id":"different-id","activityId":"activity"}),
        );
        retry.snapshot = json!({"mastered":false});
        assert!(
            execute(&mut c, retry)
                .unwrap_err()
                .contains("already been answered")
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::ListAttempts, Value::Null))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            execute(&mut c, request("a", Operation::LoadSnapshot, Value::Null)).unwrap()["mastered"],
            true
        );
        let mut backup: Backup = serde_json::from_str(&export(&mut c, "a").unwrap()).unwrap();
        backup.payload.records.push((
            "learner".into(),
            "attempt".into(),
            "another".into(),
            json!({"id":"another","activityId":"activity"}),
        ));
        backup.sha256 = digest(&backup.payload).unwrap();
        assert!(restore(&mut c, "a", &serde_json::to_string(&backup).unwrap()).is_err());
        assert_eq!(
            execute(&mut c, request("a", Operation::LoadSnapshot, Value::Null)).unwrap()["mastered"],
            true
        );
    }
    #[test]
    fn durable_restart() {
        let path = std::env::temp_dir().join(format!(
            "aha-test-{}-{}.sqlite",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        {
            let mut c = open(&path).unwrap();
            profile(&mut c, "a");
        }
        let mut c = open(&path).unwrap();
        assert_eq!(
            execute(&mut c, request("a", Operation::ListProfiles, Value::Null))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        drop(c);
        std::fs::remove_file(path).unwrap();
    }
}
