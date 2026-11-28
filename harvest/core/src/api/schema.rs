//! The API contract, generated: a JSON Schema for every method's params and
//! result, and TypeScript types emitted from that schema. The checked-in
//! copies live in `harvest/api/`; a test fails when they are stale
//! (`harvest api-schema harvest/api` rewrites them).
//!
//! Params are described as they are read (a field with a default may be
//! left out); results as they are written (every field is present, `null`
//! when empty). A type used both ways and described differently appears
//! twice: the params form is named `<Name>Input`.

use super::{API_VERSION, method_schemas};
use schemars::generate::SchemaSettings;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;

/// The schema file's name in `harvest/api/`.
pub const SCHEMA_FILE: &str = "api.schema.json";
/// The TypeScript file's name in `harvest/api/`.
pub const TS_FILE: &str = "types.ts";

fn defs_of(g: &mut schemars::SchemaGenerator) -> Map<String, Value> {
    g.take_definitions(true)
}

/// Rewrite `#/$defs/<old>` references per `names`.
fn rename_refs(v: &mut Value, names: &BTreeMap<String, String>) {
    match v {
        Value::Object(m) => {
            if let Some(Value::String(r)) = m.get_mut("$ref")
                && let Some(name) = r.strip_prefix("#/$defs/")
                && let Some(new) = names.get(name)
            {
                *r = format!("#/$defs/{new}");
            }
            for (_, x) in m.iter_mut() {
                rename_refs(x, names);
            }
        }
        Value::Array(a) => a.iter_mut().for_each(|x| rename_refs(x, names)),
        _ => {}
    }
}

/// The API schema as JSON.
pub fn schema() -> Value {
    let mut pgen = SchemaSettings::draft2020_12()
        .for_deserialize()
        .into_generator();
    let mut rgen = SchemaSettings::draft2020_12()
        .for_serialize()
        .into_generator();
    let methods = method_schemas(&mut pgen, &mut rgen);
    let pdefs = defs_of(&mut pgen);
    let rdefs = defs_of(&mut rgen);
    // Params-side names that clash with a different results-side schema.
    let renames: BTreeMap<String, String> = pdefs
        .iter()
        .filter(|(k, v)| rdefs.get(*k).is_some_and(|r| r != *v))
        .map(|(k, _)| (k.clone(), format!("{k}Input")))
        .collect();
    let mut defs: Map<String, Value> = Map::new();
    for (k, mut v) in pdefs {
        rename_refs(&mut v, &renames);
        defs.insert(renames.get(&k).cloned().unwrap_or(k), v);
    }
    for (k, v) in rdefs {
        defs.insert(k, v);
    }
    let mut out = Map::new();
    for (name, p, r) in methods {
        let mut p = p.to_value();
        rename_refs(&mut p, &renames);
        out.insert(
            name.to_string(),
            json!({"params": p, "result": r.to_value()}),
        );
    }
    let mut error = SchemaSettings::draft2020_12()
        .for_serialize()
        .into_generator()
        .into_root_schema_for::<super::ApiError>()
        .to_value();
    if let Some(m) = error.as_object_mut() {
        m.remove("$schema");
        m.remove("title");
    }
    defs.insert("ApiError".into(), error);
    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "harvest API",
        "description": "One JSON API over harvest-core: call(method, params) -> result. Generated; do not edit.",
        "version": API_VERSION,
        "methods": out,
        "$defs": defs,
    })
}

/// The schema file's text (pretty, newline at the end).
pub fn schema_text() -> String {
    let mut s = serde_json::to_string_pretty(&schema()).expect("schema serializes");
    s.push('\n');
    s
}

const ALLOWED: &[&str] = &[
    "$ref",
    "$schema",
    "title",
    "description",
    "type",
    "const",
    "enum",
    "oneOf",
    "anyOf",
    "allOf",
    "items",
    "prefixItems",
    "properties",
    "required",
    "additionalProperties",
    "format",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minItems",
    "maxItems",
    "uniqueItems",
    "default",
    "examples",
    "deprecated",
    "readOnly",
    "writeOnly",
];

fn ts_name(r: &str) -> String {
    r.strip_prefix("#/$defs/")
        .unwrap_or_else(|| panic!("unsupported $ref {r}"))
        .to_string()
}

fn literal(v: &Value) -> String {
    serde_json::to_string(v).expect("literal")
}

fn union(parts: Vec<String>) -> String {
    let mut seen: Vec<String> = Vec::new();
    for p in parts {
        if !seen.contains(&p) {
            seen.push(p);
        }
    }
    match seen.len() {
        0 => "never".into(),
        1 => seen.pop().unwrap(),
        _ => seen.join(" | "),
    }
}

fn paren(t: &str) -> String {
    if t.contains(' ') && !(t.starts_with('{') && t.ends_with('}')) {
        format!("({t})")
    } else {
        t.to_string()
    }
}

fn doc(desc: Option<&Value>, indent: &str) -> String {
    match desc.and_then(Value::as_str) {
        Some(d) if !d.trim().is_empty() => {
            let lines: Vec<&str> = d.lines().collect();
            if lines.len() == 1 {
                format!("{indent}/** {} */\n", lines[0].replace("*/", "* /"))
            } else {
                let mut s = format!("{indent}/**\n");
                for l in lines {
                    s.push_str(
                        &format!("{indent} * {}\n", l.replace("*/", "* /")).replace(" \n", "\n"),
                    );
                }
                s.push_str(&format!("{indent} */\n"));
                s
            }
        }
        _ => String::new(),
    }
}

fn key(k: &str) -> String {
    if k.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        && !k.starts_with(|c: char| c.is_ascii_digit())
    {
        k.to_string()
    } else {
        literal(&Value::String(k.into()))
    }
}

fn object_body(m: &Map<String, Value>, indent: &str) -> String {
    let props = m.get("properties").and_then(Value::as_object);
    let required: Vec<&str> = m
        .get("required")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    let inner = format!("{indent}  ");
    let mut s = String::from("{\n");
    if let Some(props) = props {
        for (k, v) in props {
            s.push_str(&doc(v.get("description"), &inner));
            let opt = if required.contains(&k.as_str()) {
                ""
            } else {
                "?"
            };
            s.push_str(&format!("{inner}{}{opt}: {};\n", key(k), ts(v, &inner)));
        }
    }
    match m.get("additionalProperties") {
        Some(Value::Bool(false)) | None => {}
        Some(Value::Bool(true)) if props.is_none() => {}
        Some(Value::Bool(true)) => s.push_str(&format!("{inner}[key: string]: unknown;\n")),
        Some(extra) => s.push_str(&format!("{inner}[key: string]: {};\n", ts(extra, &inner))),
    }
    s.push_str(&format!("{indent}}}"));
    s
}

/// TypeScript for one schema.
fn ts(schema: &Value, indent: &str) -> String {
    let m = match schema {
        Value::Bool(true) => return "unknown".into(),
        Value::Bool(false) => return "never".into(),
        Value::Object(m) => m,
        other => panic!("unsupported schema {other}"),
    };
    for k in m.keys() {
        assert!(
            ALLOWED.contains(&k.as_str()),
            "unsupported schema keyword {k:?} in {schema}"
        );
    }
    if let Some(Value::String(r)) = m.get("$ref") {
        return ts_name(r);
    }
    if let Some(c) = m.get("const") {
        return literal(c);
    }
    if let Some(Value::Array(e)) = m.get("enum") {
        return union(e.iter().map(literal).collect());
    }
    let mut base: Option<String> = None;
    for k in ["oneOf", "anyOf"] {
        if let Some(Value::Array(vs)) = m.get(k) {
            let alts = union(vs.iter().map(|v| ts(v, indent)).collect());
            let has_props = m.contains_key("properties");
            return if has_props {
                let mut rest = m.clone();
                rest.remove(k);
                format!("{} & ({alts})", ts(&Value::Object(rest), indent))
            } else {
                alts
            };
        }
    }
    if let Some(Value::Array(vs)) = m.get("allOf") {
        let mut rest = m.clone();
        rest.remove("allOf");
        let mut parts: Vec<String> = vs.iter().map(|v| paren(&ts(v, indent))).collect();
        if rest.contains_key("properties") || rest.contains_key("type") {
            parts.insert(0, ts(&Value::Object(rest), indent));
        }
        base = Some(parts.join(" & "));
    }
    if let Some(b) = base {
        return b;
    }
    let types: Vec<String> = match m.get("type") {
        None => return "unknown".into(),
        Some(Value::String(t)) => vec![t.clone()],
        Some(Value::Array(a)) => a
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect(),
        Some(other) => panic!("unsupported type {other}"),
    };
    union(
        types
            .iter()
            .map(|t| match t.as_str() {
                "null" => "null".to_string(),
                "string" => "string".into(),
                "integer" | "number" => "number".into(),
                "boolean" => "boolean".into(),
                "array" => {
                    if let Some(Value::Array(p)) = m.get("prefixItems") {
                        format!(
                            "[{}]",
                            p.iter()
                                .map(|v| ts(v, indent))
                                .collect::<Vec<_>>()
                                .join(", ")
                        )
                    } else {
                        let item = m.get("items").map_or("unknown".into(), |i| ts(i, indent));
                        format!("{}[]", paren(&item))
                    }
                }
                "object" => {
                    let props = m.get("properties").and_then(Value::as_object);
                    match (props, m.get("additionalProperties")) {
                        (None, Some(extra)) if !extra.is_boolean() => {
                            format!("Record<string, {}>", ts(extra, indent))
                        }
                        (None, Some(Value::Bool(false))) => "Record<string, never>".into(),
                        (None, _) => "Record<string, unknown>".into(),
                        (Some(_), _) => object_body(m, indent),
                    }
                }
                other => panic!("unsupported type {other:?}"),
            })
            .collect(),
    )
}

/// The TypeScript file's text.
pub fn typescript() -> String {
    let s = schema();
    let mut out = String::new();
    out.push_str(
        "// Generated from harvest/api/api.schema.json by harvest-core (`harvest api-schema`).\n",
    );
    out.push_str("// Do not edit: change the Rust types and regenerate.\n\n");
    out.push_str(&format!(
        "export const API_VERSION = {} as const;\n\n",
        literal(&s["version"])
    ));
    let defs = s["$defs"].as_object().expect("defs");
    for (name, def) in defs {
        let m = def.as_object();
        out.push_str(&doc(def.get("description"), ""));
        let is_interface = m.is_some_and(|m| {
            m.get("type") == Some(&Value::String("object".into()))
                && m.contains_key("properties")
                && !m.contains_key("oneOf")
                && !m.contains_key("anyOf")
                && !m.contains_key("allOf")
        });
        if is_interface {
            out.push_str(&format!(
                "export interface {name} {}\n\n",
                object_body(m.unwrap(), "")
            ));
        } else {
            out.push_str(&format!("export type {name} = {};\n\n", ts(def, "")));
        }
    }
    out.push_str("/** Every method: its params and its result. */\nexport interface Methods {\n");
    let methods = s["methods"].as_object().expect("methods");
    for name in super::METHODS {
        let m = &methods[*name];
        out.push_str(&format!(
            "  {}: {{ params: {}; result: {} }};\n",
            literal(&Value::String((*name).into())),
            ts(&m["params"], "  "),
            ts(&m["result"], "  ")
        ));
    }
    out.push_str("}\n\n");
    out.push_str("export type Method = keyof Methods;\n");
    out.push_str("export type Params<M extends Method> = Methods[M][\"params\"];\n");
    out.push_str("export type Result<M extends Method> = Methods[M][\"result\"];\n");
    out.push_str("/** What every transport returns. */\n");
    out.push_str(
        "export type Envelope<T> = { ok: true; result: T } | { ok: false; error: ApiError };\n\n",
    );
    out.push_str("export const METHODS = [\n");
    for name in super::METHODS {
        out.push_str(&format!("  {},\n", literal(&Value::String((*name).into()))));
    }
    out.push_str("] as const satisfies readonly Method[];\n");
    out
}
