//! An asset's attribute values for applicability (CONTRACT
//! "Applicability"): typed in by the technician, resolved from the data
//! plate, or read from the vehicle. Each value keeps where it came from;
//! every change is audited.

use super::Records;
use crate::audit::{AuditEvent, now_rfc3339};
use crate::error::{Error, Result};
use crate::maint::applic::{AttrDef, AttrSource, AttrValues};
use crate::maint::resolve::Plate;
use rusqlite::params;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub(crate) const DDL: &str = "
CREATE TABLE IF NOT EXISTS asset_attr (
  asset_id TEXT NOT NULL,
  attr     TEXT NOT NULL,
  value    TEXT NOT NULL,
  source   TEXT NOT NULL CHECK (source IN ('typed', 'plate', 'vehicle')),
  set_at   TEXT NOT NULL,
  PRIMARY KEY (asset_id, attr)
);
";

/// Where a value came from.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ValueSource {
    Typed,
    Plate,
    Vehicle,
}

impl ValueSource {
    fn as_str(self) -> &'static str {
        match self {
            Self::Typed => "typed",
            Self::Plate => "plate",
            Self::Vehicle => "vehicle",
        }
    }
}

/// One attribute value of an asset.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct AttrValue {
    pub attr: String,
    pub value: String,
    pub source: ValueSource,
    pub set_at: String,
}

/// The attribute values a data plate or a vehicle's version message gives,
/// for the attributes the pack declares with that source: `serial`,
/// `model`, `firmware` by id, and any plate parameter of the same id.
pub fn plate_values(
    defs: &[AttrDef],
    plate: &Plate,
    source: AttrSource,
) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for d in defs.iter().filter(|d| d.source == source) {
        let v = match d.id.as_str() {
            "serial" => plate.serial.clone(),
            "model" => plate.model.clone(),
            "firmware" => plate.firmware.clone(),
            other => plate.params.get(other).cloned(),
        };
        if let Some(v) = v.filter(|v| !v.trim().is_empty()) {
            out.insert(d.id.clone(), v);
        }
    }
    out
}

impl Records {
    /// Set attribute values of an asset (`None` clears one). Each must be
    /// declared by `defs` when given; values are kept as text.
    pub fn set_asset_attrs(
        &self,
        asset_id: &str,
        values: &BTreeMap<String, Option<String>>,
        source: ValueSource,
        defs: Option<&[AttrDef]>,
    ) -> Result<Vec<AttrValue>> {
        if self.asset(asset_id)?.is_none() {
            return Err(Error::Invalid(format!("no asset {asset_id:?}")));
        }
        if let Some(defs) = defs {
            for k in values.keys() {
                if !defs.iter().any(|d| &d.id == k) {
                    return Err(Error::Invalid(format!(
                        "attribute {k:?} is not one the pack declares ({})",
                        defs.iter()
                            .map(|d| d.id.as_str())
                            .collect::<Vec<_>>()
                            .join(", ")
                    )));
                }
            }
        }
        let now = now_rfc3339();
        let tx = self.write_tx()?;
        for (k, v) in values {
            match v {
                Some(v) if v.len() > 200 => {
                    return Err(Error::Invalid(format!(
                        "attribute {k:?}: at most 200 bytes"
                    )));
                }
                Some(v) => {
                    tx.execute(
                        "INSERT INTO asset_attr (asset_id, attr, value, source, set_at) VALUES (?1, ?2, ?3, ?4, ?5)
                         ON CONFLICT (asset_id, attr) DO UPDATE SET value = excluded.value,
                           source = excluded.source, set_at = excluded.set_at",
                        params![asset_id, k, v.trim(), source.as_str(), now],
                    )?;
                }
                None => {
                    tx.execute(
                        "DELETE FROM asset_attr WHERE asset_id = ?1 AND attr = ?2",
                        params![asset_id, k],
                    )?;
                }
            }
        }
        let mut ev = AuditEvent::new("asset.attrs", asset_id);
        ev.detail = serde_json::json!({"source": source.as_str(), "values": values});
        crate::audit::append_event_locked_with(&tx, self.key(), &ev)?;
        tx.commit()?;
        self.asset_attrs(asset_id)
    }

    /// An asset's attribute values, by attribute.
    pub fn asset_attrs(&self, asset_id: &str) -> Result<Vec<AttrValue>> {
        Ok(self
            .conn
            .prepare("SELECT attr, value, source, set_at FROM asset_attr WHERE asset_id = ?1 ORDER BY attr")?
            .query_map([asset_id], |r| {
                let s: String = r.get(2)?;
                Ok(AttrValue {
                    attr: r.get(0)?,
                    value: r.get(1)?,
                    source: match s.as_str() {
                        "plate" => ValueSource::Plate,
                        "vehicle" => ValueSource::Vehicle,
                        _ => ValueSource::Typed,
                    },
                    set_at: r.get(3)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?)
    }

    /// The values as applicability reads them (empty for no asset).
    pub fn attr_values(&self, asset_id: Option<&str>) -> Result<AttrValues> {
        match asset_id {
            None => Ok(AttrValues::new()),
            Some(a) => Ok(self
                .asset_attrs(a)?
                .into_iter()
                .map(|v| (v.attr, v.value))
                .collect()),
        }
    }
}
