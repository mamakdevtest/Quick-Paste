use crate::clipboard_manager;
use crate::data_store::Snippet;
use chrono::Local;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextExpansionPack {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub recommended: bool,
    #[serde(default)]
    pub app_filter: Vec<String>,
    #[serde(default)]
    pub items: Vec<TextExpansion>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextExpansionCatalog {
    pub version: u32,
    pub locale: String,
    pub recommended_pack_ids: Vec<String>,
    pub packs: Vec<TextExpansionPack>,
}

#[derive(Clone, Debug)]
struct DefaultPackSection {
    key: &'static str,
    id: &'static str,
    title_en: &'static str,
    title_tr: &'static str,
    description_en: &'static str,
    description_tr: &'static str,
    app_filter: &'static [&'static str],
}

const UNITY_DEFAULT_APP_FILTER: &[&str] = &["unity.exe", "rider64.exe", "rider.exe", "code.exe"];
const GENERAL_DEV_APP_FILTER: &[&str] = &["rider64.exe", "rider.exe", "code.exe"];

const DEFAULT_PACK_SECTIONS: &[DefaultPackSection] = &[
    DefaultPackSection {
        key: "daily",
        id: "daily-productivity",
        title_en: "Daily / General Productivity",
        title_tr: "Günlük Verimlilik",
        description_en: "Date, contact, symbols, and lightweight communication snippets.",
        description_tr: "Tarih, iletişim, semboller ve günlük akışta sık kullanılan yardımcı snippet'ler.",
        app_filter: &[],
    },
    DefaultPackSection {
        key: "git",
        id: "git-version-control",
        title_en: "Git / Version Control",
        title_tr: "Git / Sürüm Kontrolü",
        description_en: "Commit, branch, PR, and repository workflow helpers.",
        description_tr: "Commit, branch, PR ve depo iş akışı yardımcıları.",
        app_filter: &[],
    },
    DefaultPackSection {
        key: "unity-lifecycle",
        id: "unity-lifecycle",
        title_en: "Unity / Lifecycle",
        title_tr: "Unity / Yaşam Döngüsü",
        description_en: "MonoBehaviour lifecycle and callback templates.",
        description_tr: "MonoBehaviour yaşam döngüsü ve callback şablonları.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-debug",
        id: "unity-debug",
        title_en: "Unity / Debug & Logging",
        title_tr: "Unity / Debug ve Loglama",
        description_en: "Logging, assertions, and quick diagnostics.",
        description_tr: "Loglama, assertion ve hızlı teşhis snippet'leri.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-attributes",
        id: "unity-attributes",
        title_en: "Unity / Attributes & Serialization",
        title_tr: "Unity / Özellikler ve Serileştirme",
        description_en: "SerializeField, attributes, and inspector helpers.",
        description_tr: "SerializeField, attribute'lar ve inspector yardımcıları.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-components",
        id: "unity-components",
        title_en: "Unity / Components & GameObject",
        title_tr: "Unity / Bileşenler ve GameObject",
        description_en: "Component lookups, instantiation, destruction, and object state.",
        description_tr: "Component erişimi, instantiate, destroy ve obje durumu.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-coroutine",
        id: "unity-coroutines",
        title_en: "Unity / Coroutines & Time",
        title_tr: "Unity / Coroutine ve Zaman",
        description_en: "Coroutine patterns, waits, invocation, and timing helpers.",
        description_tr: "Coroutine kalıpları, beklemeler, invoke ve zaman yardımcıları.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-physics",
        id: "unity-physics",
        title_en: "Unity / Physics",
        title_tr: "Unity / Fizik",
        description_en: "Raycasts, overlaps, rigidbody utilities, and 2D physics.",
        description_tr: "Raycast, overlap, rigidbody yardımcıları ve 2D fizik.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-math",
        id: "unity-math",
        title_en: "Unity / Math",
        title_tr: "Unity / Matematik",
        description_en: "Vector, Mathf, and numerical helpers.",
        description_tr: "Vector, Mathf ve sayısal yardımcılar.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-transform",
        id: "unity-transform",
        title_en: "Unity / Transform & Rotation",
        title_tr: "Unity / Transform ve Rotasyon",
        description_en: "Transform access, parenting, and rotation helpers.",
        description_tr: "Transform erişimi, parenting ve rotasyon yardımcıları.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-input",
        id: "unity-input",
        title_en: "Unity / Input",
        title_tr: "Unity / Input",
        description_en: "Keyboard, mouse, touch, and Input System helpers.",
        description_tr: "Klavye, mouse, touch ve Input System yardımcıları.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-ui",
        id: "unity-ui",
        title_en: "Unity / UI & TMP",
        title_tr: "Unity / UI ve TMP",
        description_en: "TextMeshPro, UI components, and pointer events.",
        description_tr: "TextMeshPro, UI bileşenleri ve pointer event'leri.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-events",
        id: "unity-events",
        title_en: "Unity / Events & Architecture",
        title_tr: "Unity / Olaylar ve Mimari",
        description_en: "Events, UnityEvent, state, scene loading, and persistence.",
        description_tr: "Event'ler, UnityEvent, state, scene yükleme ve kalıcılık.",
        app_filter: UNITY_DEFAULT_APP_FILTER,
    },
    DefaultPackSection {
        key: "unity-general",
        id: "unity-general",
        title_en: "Unity / General C# Utilities",
        title_tr: "Unity / Genel C# Yardımcıları",
        description_en: "Using statements and general-purpose C# helpers for Unity work.",
        description_tr: "Unity çalışmaları için using ve genel amaçlı C# yardımcıları.",
        app_filter: GENERAL_DEV_APP_FILTER,
    },
];

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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextExpansionSuggestion {
    pub trigger: String,
    pub description: Option<String>,
    pub replacement_preview: String,
}

static RUNTIME: OnceLock<RwLock<RuntimeState>> = OnceLock::new();
static LEGACY_UNITY_TRIGGER_MAP: OnceLock<HashMap<String, (String, String)>> = OnceLock::new();

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
    let backup = path.with_extension("json.bak");
    if !path.exists() && !backup.exists() {
        return Vec::new();
    }

    for candidate in [&path, &backup] {
        if let Ok(raw) = fs::read_to_string(candidate) {
            if let Ok(items) = parse_text_expansion_payload(&raw) {
                if candidate == &backup && !path.exists() {
                    let _ = fs::copy(&backup, &path);
                }
                return items;
            }
        }
    }

    Vec::new()
}

fn save_text_expansions_to_disk(items: &[TextExpansion]) -> Result<(), String> {
    let path = get_text_expansions_path();
    let tmp = path.with_extension("json.tmp");
    let backup = path.with_extension("json.bak");
    let bundle = TextExpansionBundle {
        version: 1,
        text_expansions: items.to_vec(),
        exported_at: Some(now_rfc3339()),
    };
    let content = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;
    fs::write(&tmp, content).map_err(|e| format!("Could not write expansion data: {e}"))?;

    if path.exists() {
        fs::copy(&path, &backup)
            .map_err(|e| format!("Could not back up expansion data: {e}"))?;
        fs::remove_file(&path)
            .map_err(|e| format!("Could not replace expansion data: {e}"))?;
    }

    fs::rename(&tmp, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        if backup.exists() && !path.exists() {
            let _ = fs::copy(&backup, &path);
        }
        format!("Could not commit expansion data: {e}")
    })?;
    fs::copy(&path, &backup)
        .map_err(|e| format!("Could not update expansion backup: {e}"))?;
    Ok(())
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
    item.trigger = canonicalize_legacy_text_expansion_trigger(&item.trigger, &item.replacement);
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

fn canonicalize_legacy_text_expansion_trigger(trigger: &str, replacement: &str) -> String {
    let trimmed = trigger.trim();
    let normalized_replacement = replacement.replace("\r\n", "\n");
    let canonical = legacy_unity_trigger_map();
    if let Some((new_trigger, expected_replacement)) = canonical.get(trimmed) {
        if normalized_replacement == *expected_replacement {
            return new_trigger.clone();
        }
    }

    trimmed.to_string()
}

fn legacy_unity_trigger_map() -> &'static HashMap<String, (String, String)> {
    LEGACY_UNITY_TRIGGER_MAP.get_or_init(|| {
        let mut map = HashMap::new();
        let catalog = build_default_catalog("en", None);
        for pack in catalog.packs {
            if !pack.id.starts_with("unity") {
                continue;
            }
            for item in pack.items {
                let raw_trigger = if item.trigger.starts_with('U') {
                    format!(":{}", item.trigger.trim_start_matches('U'))
                } else {
                    item.trigger.clone()
                };
                map.entry(raw_trigger)
                    .or_insert((item.trigger.clone(), item.replacement.clone()));
            }
        }
        map
    })
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

fn default_catalog_source() -> &'static str {
    include_str!("../defaults/text_expansion_catalog.txt")
}

fn default_profile_name() -> &'static str {
    "Can"
}

fn core_essentials_items(profile_name: Option<&str>) -> Vec<TextExpansion> {
    let name = profile_name
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or(default_profile_name());
    let now = now_rfc3339();
    vec![
        seeded(":date", "{{date}}", "Insert today's date", &now),
        seeded(":time", "{{time}}", "Insert current time", &now),
        seeded(":datetime", "{{datetime}}", "Insert current date and time", &now),
        seeded(":uuid", "{{uuid}}", "Insert a new UUID", &now),
        seeded(":clip", "{{clipboard}}", "Insert clipboard text", &now),
        TextExpansion {
            id: Uuid::new_v4().to_string(),
            trigger: ":sig".to_string(),
            replacement: format!("Saygılarımla,\n{}", name),
            description: Some("Insert signature block".to_string()),
            enabled: true,
            case_sensitive: false,
            word_boundary: true,
            app_filter: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
        },
    ]
}

fn canonicalize_default_trigger(section_key: &str, trigger: &str) -> String {
    let trigger = trigger.trim();
    if section_key.starts_with("unity") {
        let trimmed = trigger.trim_start_matches(':');
        if trimmed.starts_with('U') {
            trimmed.to_string()
        } else {
            format!("U{}", trimmed)
        }
    } else {
        trigger.to_string()
    }
}

fn section_meta_for_key(key: &str, locale: &str) -> &'static DefaultPackSection {
    DEFAULT_PACK_SECTIONS
        .iter()
        .find(|section| section.key == key)
        .unwrap_or_else(|| {
            if locale.starts_with("tr") {
                &DEFAULT_PACK_SECTIONS[0]
            } else {
                &DEFAULT_PACK_SECTIONS[0]
            }
        })
}

fn locale_is_turkish(locale: &str) -> bool {
    locale.to_lowercase().starts_with("tr")
}

fn heading_to_section_key(heading: &str) -> Option<&'static str> {
    let normalized = heading
        .replace('—', "-")
        .to_lowercase();
    if normalized.contains("günlük kullanım") {
        Some("daily")
    } else if normalized.contains("git & commit") {
        Some("git")
    } else if normalized.contains("unity - lifecycle") {
        Some("unity-lifecycle")
    } else if normalized.contains("unity - debug & logging") {
        Some("unity-debug")
    } else if normalized.contains("unity - attributes & serialization") {
        Some("unity-attributes")
    } else if normalized.contains("unity - component & gameobject") {
        Some("unity-components")
    } else if normalized.contains("unity - coroutine & time") {
        Some("unity-coroutines")
    } else if normalized.contains("unity - physics") {
        Some("unity-physics")
    } else if normalized.contains("unity - math") {
        Some("unity-math")
    } else if normalized.contains("unity - transform & rotation") {
        Some("unity-transform")
    } else if normalized.contains("unity - input") {
        Some("unity-input")
    } else if normalized.contains("unity - ui / tmp") || normalized.contains("unity - ui & tmp") {
        Some("unity-ui")
    } else if normalized.contains("unity - events & architecture") {
        Some("unity-events")
    } else if normalized.contains("unity - events & mimari") {
        Some("unity-events")
    } else if normalized.contains("genel c# & using") || normalized.contains("unity - general c#") {
        Some("unity-general")
    } else {
        None
    }
}

fn parse_catalog_line(line: &str) -> Option<(String, String)> {
    let (left, right) = line.split_once('→')?;
    let trigger = left.split('`').nth(1)?.trim().to_string();
    let replacement = right.trim().replace("\\n", "\n");
    Some((trigger, replacement))
}

fn build_pack_from_section(section_key: &str, locale: &str, items: Vec<TextExpansion>) -> TextExpansionPack {
    let meta = section_meta_for_key(section_key, locale);
    let is_tr = locale_is_turkish(locale);
    TextExpansionPack {
        id: meta.id.to_string(),
        title: if is_tr {
            meta.title_tr.to_string()
        } else {
            meta.title_en.to_string()
        },
        description: if is_tr {
            meta.description_tr.to_string()
        } else {
            meta.description_en.to_string()
        },
        recommended: true,
        app_filter: meta.app_filter.iter().map(|value| value.to_string()).collect(),
        items,
    }
}

fn build_default_catalog(locale: &str, profile_name: Option<&str>) -> TextExpansionCatalog {
    let mut packs = Vec::new();
    packs.push(TextExpansionPack {
        id: "core-essentials".to_string(),
        title: if locale_is_turkish(locale) {
            "Çekirdek / Temel".to_string()
        } else {
            "Core / Essentials".to_string()
        },
        description: if locale_is_turkish(locale) {
            "Tarih, saat, UUID ve pano için her zaman açık temel parçalar.".to_string()
        } else {
            "Always-available helpers for date, time, UUID, and clipboard.".to_string()
        },
        recommended: true,
        app_filter: Vec::new(),
        items: core_essentials_items(profile_name),
    });

    let mut current_section_key: Option<&'static str> = None;
    let mut current_items: Vec<TextExpansion> = Vec::new();

    for line in default_catalog_source().lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Some(heading) = trimmed.strip_prefix("## ") {
            if let Some(section_key) = current_section_key.take() {
                packs.push(build_pack_from_section(section_key, locale, current_items));
                current_items = Vec::new();
            }

            current_section_key = heading_to_section_key(heading);
            continue;
        }

        if current_section_key.is_none() {
            continue;
        }

        let Some((raw_trigger, raw_replacement)) = parse_catalog_line(trimmed) else {
            continue;
        };

        let section_key = current_section_key.unwrap_or("daily");
        let canonical_trigger = canonicalize_default_trigger(section_key, &raw_trigger);
        let replacement = if canonical_trigger == ":sig" {
            let name = profile_name
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .unwrap_or(default_profile_name());
            format!("Saygılarımla,\n{}", name)
        } else {
            raw_replacement
        };
        let app_filter = if section_key == "unity-general" {
            GENERAL_DEV_APP_FILTER.iter().map(|value| value.to_string()).collect()
        } else if section_key.starts_with("unity") {
            UNITY_DEFAULT_APP_FILTER.iter().map(|value| value.to_string()).collect()
        } else {
            Vec::new()
        };

        current_items.push(TextExpansion {
            id: Uuid::new_v4().to_string(),
            trigger: canonical_trigger,
            replacement,
            description: None,
            enabled: true,
            case_sensitive: false,
            word_boundary: true,
            app_filter,
            created_at: String::new(),
            updated_at: String::new(),
        });
    }

    if let Some(section_key) = current_section_key.take() {
        packs.push(build_pack_from_section(section_key, locale, current_items));
    }

    let recommended_pack_ids = packs.iter().map(|pack| pack.id.clone()).collect();
    TextExpansionCatalog {
        version: 1,
        locale: locale.to_string(),
        recommended_pack_ids,
        packs,
    }
}

fn default_pack_items_for_ids(pack_ids: &[String], profile_name: Option<&str>) -> Vec<TextExpansion> {
    let catalog = build_default_catalog("en", profile_name);
    let mut items = Vec::new();
    let mut seen = HashSet::new();
    for pack_id in pack_ids {
        if let Some(pack) = catalog.packs.iter().find(|entry| entry.id == *pack_id) {
            for item in &pack.items {
                let key = normalize_trigger_key(&item.trigger);
                if seen.insert(key) {
                    items.push(item.clone());
                }
            }
        }
    }
    items
}

#[allow(dead_code)]
fn default_text_expansions() -> Vec<TextExpansion> {
    core_essentials_items(None)
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
    let clipboard_text = clipboard_manager::read_clipboard_text_with_retry(5, 8).unwrap_or_default();
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

fn normalize_search_key(value: &str) -> String {
    let trimmed = value.trim().trim_start_matches(':');
    trimmed.to_lowercase()
}

fn preview_replacement(value: &str) -> String {
    let mut preview = value.replace("\r\n", "\n").replace('\n', " ⏎ ");
    preview = preview.replace('\t', "  ");
    let preview = preview.trim();
    let mut out = String::new();
    for grapheme in preview.graphemes(true).take(70) {
        out.push_str(grapheme);
    }
    if preview.graphemes(true).count() > 70 {
        out.push('…');
    }
    out
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
    let settings = crate::data_store::load_settings();
    let selected_ids = settings.text_expansion_default_pack_ids.clone();
    let mut merged = if selected_ids.is_empty() {
        Vec::new()
    } else {
        default_pack_items_for_ids(&selected_ids, Some(&settings.text_expansion_profile_name))
    };
    merged = merge_items(merged, legacy_from_snippets(snippets));
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
    let settings = crate::data_store::load_settings();
    let defaults = if settings.text_expansion_default_pack_ids.is_empty() {
        Vec::new()
    } else {
        default_pack_items_for_ids(
            &settings.text_expansion_default_pack_ids,
            Some(&settings.text_expansion_profile_name),
        )
    };
    save_text_expansions(&defaults)
}

pub fn load_text_expansion_catalog(locale: Option<String>) -> TextExpansionCatalog {
    let locale = locale
        .as_deref()
        .map(|value| value.to_lowercase())
        .unwrap_or_else(|| "en".to_string());
    build_default_catalog(&locale, None)
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

pub fn resolve_trigger_replacement(trigger: &str) -> Option<String> {
    let normalized = normalize_trigger_key(trigger);
    let snapshot = runtime().read().ok()?.clone();
    let candidate = snapshot
        .items
        .iter()
        .find(|item| normalize_trigger_key(&item.trigger) == normalized)?;
    Some(resolve_dynamic_variables(&candidate.replacement))
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

pub fn suggest_matches(prefix: &str, limit: usize) -> Vec<TextExpansionSuggestion> {
    let snapshot = match runtime().read() {
        Ok(guard) => guard.clone(),
        Err(_) => return Vec::new(),
    };

    let active_process = clipboard_manager::get_active_process_name();
    let query = normalize_search_key(prefix);
    if query.is_empty() {
        return Vec::new();
    }

    let mut ranked: Vec<(usize, usize, TextExpansionSuggestion)> = Vec::new();

    for item in snapshot.items.iter() {
        if !item.enabled {
            continue;
        }
        if !app_filter_matches(item, &active_process) {
            continue;
        }

        let trigger_key = normalize_search_key(&item.trigger);
        if !trigger_key.starts_with(&query) {
            continue;
        }

        let prefix_delta = trigger_key.len().saturating_sub(query.len());
        let exact_bonus = if trigger_key == query { 0 } else { 1 };
        ranked.push((
            exact_bonus,
            prefix_delta,
            TextExpansionSuggestion {
                trigger: item.trigger.clone(),
                description: item.description.clone(),
                replacement_preview: preview_replacement(&item.replacement),
            },
        ));
    }

    ranked.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)).then(a.2.trigger.cmp(&b.2.trigger)));
    ranked
        .into_iter()
        .take(limit.max(1))
        .map(|(_, _, suggestion)| suggestion)
        .collect()
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

    fn with_temp_dir<T>(f: impl FnOnce() -> T) -> T {
        let _guard = crate::test_support::env_lock().lock().unwrap();
        let dir = crate::test_support::temp_dir("text_expansion");
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
    fn defaults_start_empty_without_pack_selection() {
        with_temp_dir(|| {
            let items = bootstrap_runtime(&[]);
            assert!(items.is_empty());
        });
    }

    #[test]
    fn seeded_pack_selection_uses_unity_u_prefix() {
        with_temp_dir(|| {
            let mut settings = crate::data_store::Settings::default();
            settings.text_expansion_onboarding_completed = true;
            settings.text_expansion_default_pack_ids = vec!["unity-debug".to_string()];
            crate::data_store::save_settings(&settings);

            let items = build_seeded_text_expansions(&[]);
            let triggers: Vec<String> = items.iter().map(|item| item.trigger.clone()).collect();
            assert!(triggers.iter().any(|trigger| trigger == "Ulog"), "triggers: {:?}", triggers);
            assert!(triggers.iter().any(|trigger| trigger == "Ulogw"), "triggers: {:?}", triggers);
            assert!(triggers.iter().any(|trigger| trigger == "Uloge"), "triggers: {:?}", triggers);
        });
    }

    #[test]
    fn prefix_suggestions_match_unity_triggers() {
        with_temp_dir(|| {
            let mut settings = crate::data_store::Settings::default();
            settings.text_expansion_onboarding_completed = true;
            settings.text_expansion_default_pack_ids = vec!["core-essentials".to_string()];
            crate::data_store::save_settings(&settings);

            let items = build_seeded_text_expansions(&[]);
            let _ = replace_runtime(items).unwrap();
            let suggestions = suggest_matches(":da", 6);
            let triggers: Vec<String> = suggestions.into_iter().map(|item| item.trigger).collect();
            assert!(triggers.iter().any(|trigger| trigger == ":date"), "triggers: {:?}", triggers);
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
