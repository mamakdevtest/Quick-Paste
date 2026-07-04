use crate::clipboard_manager;
use crate::data_store::Snippet;
use chrono::Local;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};
use unicode_segmentation::UnicodeSegmentation;
use uuid::Uuid;

const DEFAULT_FILE_NAME: &str = "text_expansions.json";
const DEFAULT_BUFFER_LIMIT: usize = 256;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextExpansion {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub trigger: String,
    #[serde(default)]
    pub replacement: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default = "default_true")]
    pub word_boundary: bool,
    #[serde(default)]
    pub app_filter: Vec<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextExpansionBundle {
    pub version: u32,
    pub text_expansions: Vec<TextExpansion>,
    #[serde(default)]
    pub exported_at: Option<String>,
}

#[derive(Clone, Debug)]
struct RuntimeState {
    items: Vec<TextExpansion>,
    max_trigger_graphemes: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TerminatorKind {
    Space,
    Enter,
    Tab,
    Punctuation(String),
}

#[derive(Clone, Debug)]
pub struct ExpansionMatch {
    pub trigger: String,
    pub replacement: String,
    pub delete_graphemes: usize,
    pub suffix: Option<String>,
}

static RUNTIME: OnceLock<RwLock<RuntimeState>> = OnceLock::new();

fn default_true() -> bool {
    true
}

fn runtime() -> &'static RwLock<RuntimeState> {
    RUNTIME.get_or_init(|| RwLock::new(RuntimeState::default()))
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            items: Vec::new(),
            max_trigger_graphemes: 0,
        }
    }
}

fn get_app_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("QUICKPASTE_APP_DIR") {
        let mut path = PathBuf::from(dir);
        path.push("QuickPaste");
        if !path.exists() {
            let _ = fs::create_dir_all(&path);
        }
        return path;
    }

    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("QuickPaste");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

fn get_text_expansions_path() -> PathBuf {
    let mut path = get_app_dir();
    path.push(DEFAULT_FILE_NAME);
    path
}

fn now_rfc3339() -> String {
    Local::now().to_rfc3339()
}

fn normalize_trigger_key(trigger: &str) -> String {
    trigger.trim().to_lowercase()
}

fn normalize_app_filter(filters: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for filter in filters {
        let normalized = normalize_process_name(filter);
        if normalized.is_empty() {
            continue;
        }
        if seen.insert(normalized.clone()) {
            out.push(normalized);
        }
    }
    out
}

fn normalize_process_name(name: &str) -> String {
    name.trim().to_lowercase()
}

fn trigger_grapheme_count(trigger: &str) -> usize {
    trigger.graphemes(true).count()
}

fn build_runtime_state(items: Vec<TextExpansion>) -> RuntimeState {
    let mut max_trigger_graphemes = 0;
    for item in items.iter() {
        max_trigger_graphemes = max_trigger_graphemes.max(trigger_grapheme_count(&item.trigger));
    }

    RuntimeState {
        items,
        max_trigger_graphemes,
    }
}

fn set_runtime(items: Vec<TextExpansion>) {
    if let Ok(mut guard) = runtime().write() {
        *guard = build_runtime_state(items);
    }
}

fn load_text_expansions_from_disk() -> Vec<TextExpansion> {
    let path = get_text_expansions_path();
    if !path.exists() {
        return default_text_expansions();
    }

    let raw = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(_) => return default_text_expansions(),
    };

    parse_text_expansion_payload(&raw).unwrap_or_else(|_| default_text_expansions())
}

fn save_text_expansions_to_disk(items: &[TextExpansion]) -> Result<(), String> {
    let path = get_text_expansions_path();
    let bundle = TextExpansionBundle {
        version: 1,
        text_expansions: items.to_vec(),
        exported_at: Some(now_rfc3339()),
    };
    let content = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn parse_text_expansion_payload(raw: &str) -> Result<Vec<TextExpansion>, String> {
    let value: serde_json::Value = serde_json::from_str(raw).map_err(|e| e.to_string())?;
    if let Some(array) = value.as_array() {
        let items: Vec<TextExpansion> = serde_json::from_value(serde_json::Value::Array(array.clone()))
            .map_err(|e| e.to_string())?;
        return Ok(items);
    }

    if let Some(items_value) = value
        .get("textExpansions")
        .or_else(|| value.get("text_expansions"))
        .or_else(|| value.get("items"))
        .or_else(|| value.get("expansions"))
    {
        let items: Vec<TextExpansion> = serde_json::from_value(items_value.clone())
            .map_err(|e| e.to_string())?;
        return Ok(items);
    }

    Err("Unsupported text expansion import format".to_string())
}

fn merge_items(mut base: Vec<TextExpansion>, incoming: Vec<TextExpansion>) -> Vec<TextExpansion> {
    for item in incoming {
        let key = normalize_trigger_key(&item.trigger);
        if let Some(index) = base
            .iter()
            .position(|existing| normalize_trigger_key(&existing.trigger) == key)
        {
            base[index] = normalize_text_expansion(item);
        } else {
            base.push(normalize_text_expansion(item));
        }
    }
    base
}

fn dedupe_items(items: Vec<TextExpansion>) -> Vec<TextExpansion> {
    let mut out: Vec<TextExpansion> = Vec::new();
    for item in items {
        let normalized = normalize_text_expansion(item);
        let key = normalize_trigger_key(&normalized.trigger);
        if let Some(index) = out
            .iter()
            .position(|existing| normalize_trigger_key(&existing.trigger) == key)
        {
            out[index] = normalized;
        } else {
            out.push(normalized);
        }
    }
    out
}

fn normalize_text_expansion(mut item: TextExpansion) -> TextExpansion {
    if item.id.trim().is_empty() {
        item.id = Uuid::new_v4().to_string();
    }
    item.trigger = item.trigger.trim().to_string();
    item.replacement = item.replacement.replace("\r\n", "\n");
    item.description = item
        .description
        .and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });
    item.app_filter = normalize_app_filter(&item.app_filter);
    if item.created_at.trim().is_empty() {
        item.created_at = now_rfc3339();
    }
    if item.updated_at.trim().is_empty() {
        item.updated_at = item.created_at.clone();
    }
    item
}

fn validate_items(items: &[TextExpansion]) -> Result<(), String> {
    let mut seen = HashSet::new();
    for item in items {
        let trigger = item.trigger.trim();
        if trigger.is_empty() {
            return Err("Trigger cannot be empty".to_string());
        }
        let key = normalize_trigger_key(trigger);
        if !seen.insert(key.clone()) {
            return Err(format!("Duplicate trigger detected: {}", trigger));
        }
    }
    Ok(())
}

fn default_text_expansions() -> Vec<TextExpansion> {
    let now = now_rfc3339();
    vec![
        seeded(":date", "{{date}}", "Insert today's date", &now),
        seeded(":time", "{{time}}", "Insert current time", &now),
        seeded(":datetime", "{{datetime}}", "Insert current date and time", &now),
        seeded(":uuid", "{{uuid}}", "Insert a new UUID", &now),
        seeded(":clip", "{{clipboard}}", "Insert clipboard text", &now),
        seeded(":email", "example@email.com", "Insert example email", &now),
        seeded(":sig", "Saygılarımla,\nCan", "Insert signature block", &now),
        seeded(
            ":bug",
            "Başlık:\nAdımlar:\nBeklenen Sonuç:\nGerçek Sonuç:\nEk Bilgi:",
            "Bug report template",
            &now,
        ),
        seeded(":todo", "TODO:", "Insert TODO marker", &now),
        seeded(":fixme", "FIXME:", "Insert FIXME marker", &now),
        seeded(":log", "Debug.Log(\"\");", "Insert Unity log snippet", &now),
    ]
}

fn seeded(trigger: &str, replacement: &str, description: &str, now: &str) -> TextExpansion {
    TextExpansion {
        id: Uuid::new_v4().to_string(),
        trigger: trigger.to_string(),
        replacement: replacement.to_string(),
        description: Some(description.to_string()),
        enabled: true,
        case_sensitive: false,
        word_boundary: true,
        app_filter: Vec::new(),
        created_at: now.to_string(),
        updated_at: now.to_string(),
    }
}

fn legacy_from_snippets(snippets: &[Snippet]) -> Vec<TextExpansion> {
    let now = now_rfc3339();
    snippets
        .iter()
        .filter_map(|snippet| {
            let trigger = snippet.trigger.as_ref()?.trim();
            if trigger.is_empty() {
                return None;
            }
            let created_at = snippet_timestamp_to_rfc3339(snippet.created_at).unwrap_or_else(|| now.clone());
            let updated_at = snippet_timestamp_to_rfc3339(snippet.last_used_at).unwrap_or_else(|| created_at.clone());
            Some(TextExpansion {
                id: Uuid::new_v4().to_string(),
                trigger: trigger.to_string(),
                replacement: snippet.content.clone(),
                description: Some(snippet.title.clone()),
                enabled: true,
                case_sensitive: false,
                word_boundary: true,
                app_filter: Vec::new(),
                created_at,
                updated_at,
            })
        })
        .collect()
}

fn snippet_timestamp_to_rfc3339(value: u64) -> Option<String> {
    if value == 0 {
        return None;
    }
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(value as i64)
        .map(|dt| dt.with_timezone(&Local).to_rfc3339())
}

fn resolve_dynamic_variables(text: &str) -> String {
    let clipboard_text = read_clipboard_text().unwrap_or_default();
    let now = Local::now();
    let date_str = now.format("%d.%m.%Y").to_string();
    let time_str = now.format("%H:%M:%S").to_string();
    let datetime_str = now.format("%d.%m.%Y %H:%M:%S").to_string();

    let mut output = String::with_capacity(text.len().saturating_add(32));
    let mut rest = text;

    while let Some(start) = rest.find("{{") {
        output.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        if let Some(end) = after.find("}}") {
            let token = &after[..end];
            let resolved = resolve_token(token.trim(), &date_str, &time_str, &datetime_str, &clipboard_text);
            output.push_str(&resolved);
            rest = &after[end + 2..];
        } else {
            output.push_str(&rest[start..]);
            return output;
        }
    }

    output.push_str(rest);
    output
}

fn resolve_token(token: &str, date_str: &str, time_str: &str, datetime_str: &str, clipboard_text: &str) -> String {
    match token {
        "date" | "tarih" => date_str.to_string(),
        "time" | "saat" => time_str.to_string(),
        "datetime" | "tarihSaat" | "tarih-saat" => datetime_str.to_string(),
        "clipboard" | "pano" => clipboard_text.to_string(),
        "uuid" => Uuid::new_v4().to_string(),
        _ if token.starts_with("random:") => resolve_random(token).unwrap_or_else(|| format!("{{{{{}}}}}", token)),
        _ => format!("{{{{{}}}}}", token),
    }
}

fn resolve_random(token: &str) -> Option<String> {
    let spec = token.strip_prefix("random:")?;
    let mut parts = spec.splitn(2, '-');
    let start = parts.next()?.trim().parse::<i64>().ok()?;
    let end = parts.next()?.trim().parse::<i64>().ok()?;
    let (min, max) = if start <= end { (start, end) } else { (end, start) };
    let mut rng = rand::thread_rng();
    Some(rng.gen_range(min..=max).to_string())
}

fn read_clipboard_text() -> Option<String> {
    let mut clipboard = arboard::Clipboard::new().ok()?;
    clipboard.get_text().ok()
}

fn app_filter_matches(expansion: &TextExpansion, active_process: &str) -> bool {
    if expansion.app_filter.is_empty() {
        return true;
    }
    let active = normalize_process_name(active_process);
    expansion
        .app_filter
        .iter()
        .any(|candidate| candidate == &active)
}

fn boundary_allows(buffer: &str, trigger: &str, word_boundary: bool) -> bool {
    if !word_boundary {
        return true;
    }

    let buffer_graphemes: Vec<&str> = buffer.graphemes(true).collect();
    let trigger_graphemes = trigger.graphemes(true).count();
    if trigger_graphemes == 0 {
        return false;
    }
    if buffer_graphemes.len() < trigger_graphemes {
        return false;
    }
    if buffer_graphemes.len() == trigger_graphemes {
        return true;
    }

    let boundary_grapheme = buffer_graphemes[buffer_graphemes.len() - trigger_graphemes - 1];
    match boundary_grapheme.chars().last() {
        Some(ch) => !ch.is_alphanumeric() && ch != '_',
        None => true,
    }
}

fn suffix_for_terminator(terminator: &TerminatorKind) -> Option<String> {
    match terminator {
        TerminatorKind::Space => Some(" ".to_string()),
        TerminatorKind::Punctuation(text) => Some(text.clone()),
        TerminatorKind::Enter | TerminatorKind::Tab => None,
    }
}

fn strip_front_graphemes(text: &mut String, keep_last: usize) {
    let total = text.graphemes(true).count();
    if total <= keep_last {
        return;
    }

    let drop_count = total - keep_last;
    if drop_count >= total {
        text.clear();
        return;
    }

    let boundary = text
        .grapheme_indices(true)
        .nth(drop_count)
        .map(|(byte_idx, _)| byte_idx)
        .unwrap_or(text.len());
    if boundary > 0 {
        text.drain(..boundary);
    }
}

fn buffer_limit() -> usize {
    let dynamic = max_trigger_graphemes().saturating_mul(4).saturating_add(16);
    dynamic.max(DEFAULT_BUFFER_LIMIT)
}

pub fn bootstrap_runtime(snippets: &[Snippet]) -> Vec<TextExpansion> {
    let path = get_text_expansions_path();
    let items = if path.exists() {
        load_text_expansions_from_disk()
    } else {
        let seeded = build_seeded_text_expansions(snippets);
        let _ = save_text_expansions_to_disk(&seeded);
        seeded
    };
    set_runtime(items.clone());
    items
}

pub fn build_seeded_text_expansions(snippets: &[Snippet]) -> Vec<TextExpansion> {
    let merged = merge_items(default_text_expansions(), legacy_from_snippets(snippets));
    dedupe_items(merged)
}

pub fn load_text_expansions() -> Vec<TextExpansion> {
    let items = load_text_expansions_from_disk();
    set_runtime(items.clone());
    items
}

pub fn save_text_expansions(items: &[TextExpansion]) -> Result<Vec<TextExpansion>, String> {
    validate_items(items)?;
    let normalized: Vec<TextExpansion> = items.iter().cloned().map(normalize_text_expansion).collect();
    save_text_expansions_to_disk(&normalized)?;
    set_runtime(normalized.clone());
    Ok(normalized)
}

pub fn replace_runtime(items: Vec<TextExpansion>) -> Result<Vec<TextExpansion>, String> {
    validate_items(&items)?;
    let normalized: Vec<TextExpansion> = items.into_iter().map(normalize_text_expansion).collect();
    save_text_expansions_to_disk(&normalized)?;
    set_runtime(normalized.clone());
    Ok(normalized)
}

pub fn reset_text_expansions() -> Result<Vec<TextExpansion>, String> {
    let defaults = default_text_expansions();
    save_text_expansions(&defaults)
}

pub fn export_payload(items: &[TextExpansion]) -> Result<String, String> {
    let bundle = TextExpansionBundle {
        version: 1,
        text_expansions: items.to_vec(),
        exported_at: Some(now_rfc3339()),
    };
    serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())
}

pub fn import_payload(raw: &str) -> Result<Vec<TextExpansion>, String> {
    let items = parse_text_expansion_payload(raw)?;
    replace_runtime(items)
}

pub fn current_snapshot() -> Vec<TextExpansion> {
    runtime()
        .read()
        .map(|guard| guard.items.clone())
        .unwrap_or_default()
}

pub fn evaluate_match(buffer: &str, terminator: &TerminatorKind) -> Option<ExpansionMatch> {
    let snapshot = runtime().read().ok()?.clone();
    if snapshot.items.is_empty() {
        return None;
    }

    let active_process = clipboard_manager::get_active_process_name();
    let mut best: Option<&TextExpansion> = None;
    let mut best_len = 0usize;

    for item in snapshot.items.iter() {
        if !item.enabled {
            continue;
        }
        let trigger = item.trigger.trim();
        if trigger.is_empty() {
            continue;
        }

        let trigger_key = if item.case_sensitive {
            trigger.to_string()
        } else {
            trigger.to_lowercase()
        };
        let buffer_key = if item.case_sensitive {
            buffer.to_string()
        } else {
            buffer.to_lowercase()
        };

        if !buffer_key.ends_with(&trigger_key) {
            continue;
        }
        if !boundary_allows(buffer, trigger, item.word_boundary) {
            continue;
        }
        if !app_filter_matches(item, &active_process) {
            continue;
        }

        let len = trigger_grapheme_count(trigger);
        if len >= best_len {
            best = Some(item);
            best_len = len;
        }
    }

    let candidate = best?;
    let resolved_replacement = resolve_dynamic_variables(&candidate.replacement);
    Some(ExpansionMatch {
        trigger: candidate.trigger.clone(),
        replacement: resolved_replacement,
        delete_graphemes: trigger_grapheme_count(&candidate.trigger),
        suffix: suffix_for_terminator(terminator),
    })
}

pub fn append_text(buffer: &mut String, text: &str) {
    buffer.push_str(text);
    strip_front_graphemes(buffer, buffer_limit());
}

pub fn backspace_buffer(buffer: &mut String) {
    if let Some((idx, _)) = buffer.grapheme_indices(true).last() {
        buffer.drain(idx..);
    } else {
        buffer.clear();
    }
}

pub fn clear_buffer(buffer: &mut String) {
    buffer.clear();
}

pub fn max_trigger_graphemes() -> usize {
    runtime()
        .read()
        .map(|guard| guard.max_trigger_graphemes)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn temp_dir() -> PathBuf {
        env::temp_dir().join(format!("quickpaste_text_expansion_test_{}", std::process::id()))
    }

    fn with_temp_dir<T>(f: impl FnOnce() -> T) -> T {
        let dir = temp_dir();
        env::set_var("QUICKPASTE_APP_DIR", &dir);
        if dir.exists() {
            let _ = fs::remove_dir_all(&dir);
        }
        let result = f();
        let _ = fs::remove_dir_all(&dir);
        env::remove_var("QUICKPASTE_APP_DIR");
        result
    }

    #[test]
    fn defaults_seed_expected_items() {
        with_temp_dir(|| {
            let items = bootstrap_runtime(&[]);
            assert!(items.iter().any(|item| item.trigger == ":date"));
            assert!(items.iter().any(|item| item.trigger == ":bug"));
        });
    }

    #[test]
    fn duplicate_triggers_are_rejected() {
        let now = now_rfc3339();
        let items = vec![
            seeded(":a", "one", "one", &now),
            seeded(":a", "two", "two", &now),
        ];
        assert!(validate_items(&items).is_err());
    }

    #[test]
    fn random_variable_resolves_in_range() {
        let text = resolve_dynamic_variables("Value: {{random:1-3}}");
        let value = text.strip_prefix("Value: ").unwrap_or_default().parse::<i64>().unwrap();
        assert!((1..=3).contains(&value));
    }

    #[test]
    fn legacy_migration_creates_expansions_from_snippets() {
        let snippets = vec![Snippet {
            title: "Email".to_string(),
            content: "can@example.com".to_string(),
            pinned: false,
            use_count: 0,
            category: None,
            tags: vec![],
            shortcut: None,
            is_secret: false,
            snippet_type: "text".to_string(),
            color: None,
            created_at: 0,
            last_used_at: 0,
            trigger: Some(":mail".to_string()),
            slot: None,
            source_app: None,
        }];
        let items = legacy_from_snippets(&snippets);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].trigger, ":mail");
        assert_eq!(items[0].replacement, "can@example.com");
    }
}
