//! Practice attempts: what was answered, right or wrong, how long it took.
//! Sealed at rest like other records, audited, and queued for the hub as
//! their own low-volume item kind (`practice`, `harvest-practice/1`). The
//! app rebuilds mastery from [`Records::practice_history`] after a
//! reinstall.

use super::Records;
use crate::audit::{AuditEvent, now_rfc3339};
use crate::crypt;
use crate::error::{Error, Result};
use crate::pack::Pack;
use crate::sync;
use rusqlite::params;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub(crate) const DDL: &str = "
CREATE TABLE IF NOT EXISTS practice_attempt (
  attempt_id   TEXT PRIMARY KEY,
  pack_id      TEXT NOT NULL,
  pack_version TEXT NOT NULL,
  q_id         TEXT NOT NULL,
  skill_id     TEXT NOT NULL,
  at           TEXT NOT NULL,
  body         TEXT NOT NULL      -- json {chosen, correct, ms}, sealed
);
CREATE INDEX IF NOT EXISTS practice_attempt_pack ON practice_attempt (pack_id, at);
";

/// The outbox format of an attempt.
pub const PRACTICE_FORMAT: &str = "harvest-practice/1";

/// One answer to record.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PracticeInput {
    pub q_id: String,
    /// What was chosen: the choice index as text (mc), the value given
    /// (numeric) or the text written (free_text).
    pub chosen: String,
    pub correct: bool,
    /// Milliseconds from showing the question to the answer.
    pub ms: u64,
    /// When it was answered (RFC 3339); now when absent.
    #[serde(default)]
    pub at: Option<String>,
}

/// One recorded attempt.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PracticeAttempt {
    pub attempt_id: String,
    pub pack_id: String,
    pub pack_version: String,
    pub q_id: String,
    pub skill_id: String,
    pub chosen: String,
    pub correct: bool,
    pub ms: u64,
    pub at: String,
}

fn aad(id: &str, pack: &str, version: &str, q: &str, skill: &str, at: &str) -> String {
    format!("practice_attempt:{id}|{pack}|{version}|{q}|{skill}|{at}")
}

impl Records {
    /// Record an answer to a question of `pack`.
    pub fn record_practice(&self, pack: &Pack, p: &PracticeInput) -> Result<PracticeAttempt> {
        let q = pack.question(&p.q_id)?.ok_or_else(|| {
            Error::Invalid(format!("no question {:?} in {}", p.q_id, pack.pack_id()))
        })?;
        if p.chosen.len() > 4000 {
            return Err(Error::Invalid("an answer is at most 4000 bytes".into()));
        }
        let at = match &p.at {
            Some(a) => {
                if super::maint::parse_rfc3339_ms(a).is_none() {
                    return Err(Error::Invalid(format!("at {a:?} is not an RFC 3339 time")));
                }
                a.clone()
            }
            None => now_rfc3339(),
        };
        let attempt = PracticeAttempt {
            attempt_id: super::new_id("pa", &[pack.pack_id(), &q.q_id, &at, &p.chosen]),
            pack_id: pack.pack_id().to_string(),
            pack_version: pack.version().to_string(),
            q_id: q.q_id.clone(),
            skill_id: q.skill_id.clone(),
            chosen: p.chosen.clone(),
            correct: p.correct,
            ms: p.ms,
            at,
        };
        let body = serde_json::json!({"chosen": attempt.chosen, "correct": attempt.correct, "ms": attempt.ms}).to_string();
        let tx = self.write_tx()?;
        tx.execute(
            "INSERT INTO practice_attempt (attempt_id, pack_id, pack_version, q_id, skill_id, at, body)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                attempt.attempt_id,
                attempt.pack_id,
                attempt.pack_version,
                attempt.q_id,
                attempt.skill_id,
                attempt.at,
                crypt::seal_opt(
                    self.key(),
                    &aad(
                        &attempt.attempt_id,
                        &attempt.pack_id,
                        &attempt.pack_version,
                        &attempt.q_id,
                        &attempt.skill_id,
                        &attempt.at
                    ),
                    &body
                )?,
            ],
        )?;
        let mut payload = serde_json::to_value(&attempt)?;
        payload["format"] = PRACTICE_FORMAT.into();
        sync::enqueue_ref(
            &tx,
            self.key(),
            "practice",
            Some(&attempt.attempt_id),
            &payload,
        )?;
        let mut ev = AuditEvent::new("practice.record", &attempt.attempt_id);
        ev.detail = serde_json::json!({"pack_id": attempt.pack_id, "q_id": attempt.q_id, "correct": attempt.correct});
        crate::audit::append_event_locked_with(&tx, self.key(), &ev)?;
        tx.commit()?;
        Ok(attempt)
    }

    /// Every attempt at `pack_id`'s questions, oldest first.
    pub fn practice_history(&self, pack_id: &str) -> Result<Vec<PracticeAttempt>> {
        type Row = (String, String, String, String, String, String, String);
        let rows: Vec<Row> = self
            .conn
            .prepare(
                "SELECT attempt_id, pack_id, pack_version, q_id, skill_id, at, body FROM practice_attempt
                 WHERE pack_id = ?1 ORDER BY at, attempt_id",
            )?
            .query_map([pack_id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?))
            })?
            .collect::<rusqlite::Result<_>>()?;
        rows.into_iter()
            .map(|(id, pack, version, q, skill, at, body)| {
                let clear = crypt::open_opt(
                    self.key(),
                    &aad(&id, &pack, &version, &q, &skill, &at),
                    &body,
                )?;
                let b: serde_json::Value = serde_json::from_str(&clear)?;
                Ok(PracticeAttempt {
                    chosen: b["chosen"].as_str().unwrap_or_default().to_string(),
                    correct: b["correct"].as_bool().unwrap_or(false),
                    ms: b["ms"].as_u64().unwrap_or(0),
                    attempt_id: id,
                    pack_id: pack,
                    pack_version: version,
                    q_id: q,
                    skill_id: skill,
                    at,
                })
            })
            .collect()
    }
}
