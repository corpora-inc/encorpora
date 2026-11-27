//! Canonical JSON: the exact bytes a manifest signature covers.
//!
//! Object keys sorted by code point, no insignificant whitespace, strings
//! escaped as `serde_json` escapes them (`"`, `\\`, and control characters;
//! non-ASCII is written raw as UTF-8). Python produces identical bytes with
//! `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`
//! for manifests that hold only strings, integers, booleans, null, arrays and
//! objects. Floats are refused: their text form differs between languages.

use crate::error::{Error, Result};
use serde_json::Value;

/// Canonical bytes of `value`.
pub fn to_vec(value: &Value) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(512);
    write(value, &mut out)?;
    Ok(out)
}

fn write(value: &Value, out: &mut Vec<u8>) -> Result<()> {
    match value {
        Value::Null => out.extend_from_slice(b"null"),
        Value::Bool(b) => out.extend_from_slice(if *b { b"true" } else { b"false" }),
        Value::Number(n) => {
            if n.is_f64() {
                return Err(Error::Invalid(
                    "canonical JSON refuses floating-point numbers".into(),
                ));
            }
            out.extend_from_slice(n.to_string().as_bytes());
        }
        Value::String(s) => out.extend_from_slice(serde_json::to_string(s)?.as_bytes()),
        Value::Array(items) => {
            out.push(b'[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(b',');
                }
                write(item, out)?;
            }
            out.push(b']');
        }
        Value::Object(map) => {
            // Sort explicitly: serde_json's map order depends on a feature flag
            // any crate in the graph can switch on.
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            out.push(b'{');
            for (i, key) in keys.into_iter().enumerate() {
                if i > 0 {
                    out.push(b',');
                }
                out.extend_from_slice(serde_json::to_string(key)?.as_bytes());
                out.push(b':');
                write(&map[key], out)?;
            }
            out.push(b'}');
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sorts_keys_and_strips_whitespace() {
        let v = json!({"b": 1, "a": {"d": [1, 2, "x"], "c": null}, "é": "ü\n\"q\""});
        let s = String::from_utf8(to_vec(&v).unwrap()).unwrap();
        assert_eq!(s, r#"{"a":{"c":null,"d":[1,2,"x"]},"b":1,"é":"ü\n\"q\""}"#);
    }

    #[test]
    fn refuses_floats() {
        assert!(to_vec(&json!({"x": 1.5})).is_err());
    }

    #[test]
    fn escapes_control_characters_like_python() {
        // json.dumps("\u0001", ensure_ascii=False) == '"\\u0001"'
        let s = String::from_utf8(to_vec(&json!("\u{1}")).unwrap()).unwrap();
        assert_eq!(s, "\"\\u0001\"");
    }
}
