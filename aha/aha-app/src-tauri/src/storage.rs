//! The database is authoritative. Commands never accept SQL or filesystem paths.
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{path::Path, time::Duration};

const MAX_JSON: usize = 512 * 1024;
const MAX_BACKUP: usize = 32 * 1024 * 1024;
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
    ListAttempts,
    LoadSnapshot,
    GetJournal,
    PutJournal,
    DeleteJournal,
    ExportBackup,
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
    if version > 1 {
        return Err("Database requires a newer version of AHA".into());
    }
    if version == 0 {
        conn.execute_batch("BEGIN IMMEDIATE;
          CREATE TABLE profiles(account TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(account,id));
          CREATE TABLE records(account TEXT NOT NULL, profile TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('session','activity','attempt','snapshot')), id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(account,profile,kind,id), FOREIGN KEY(account,profile) REFERENCES profiles(account,id) ON DELETE CASCADE);
          CREATE TABLE journal(account TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(account,id));
          PRAGMA user_version=1; COMMIT;").map_err(err)?;
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
fn digest(payload: &BackupPayload) -> Result<String> {
    Ok(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(payload).map_err(err)?)
    ))
}
fn export(conn: &mut Connection, account: &str) -> Result<String> {
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
    let tx = conn.transaction().map_err(err)?;
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
        if !["session", "activity", "attempt", "snapshot"].contains(&kind.as_str()) {
            return Err("Invalid record kind".into());
        }
        if ["activity", "attempt"].contains(&kind.as_str()) {
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
    let orphan:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM records a WHERE a.account=? AND a.kind='attempt' AND NOT EXISTS(SELECT 1 FROM records b WHERE b.account=a.account AND b.profile=a.profile AND b.kind='activity' AND b.id=json_extract(a.data,'$.activityId')))",[account],|r|r.get(0)).map_err(err)?;
    if orphan {
        return Err("Backup contains an orphan attempt".into());
    }
    // Billing/auth journals are intentionally not exported or restored: an old
    // payment operation must never be replayed by importing a learning backup.
    tx.commit().map_err(err)?;
    Ok(())
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
        c.pragma_update(None, "user_version", 2).unwrap();
        assert!(migrate(&c).is_err());
        assert!(encoded(&json!("x".repeat(MAX_JSON))).is_err());
        assert!(execute(&mut c, request("", Operation::ListProfiles, Value::Null)).is_err());
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
