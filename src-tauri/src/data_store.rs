use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Snippet {
    #[serde(default)]
    pub id: Option<String>,
    pub title: String,
    pub content: String,
    pub pinned: bool,
    pub use_count: u32,
    pub category: Option<String>,
    pub tags: Vec<String>,
    #[serde(default)]
    pub shortcut: Option<String>,
    /// Whether the snippet content should be masked in the UI
    #[serde(default)]
    pub is_secret: bool,
    /// Snippet type: "text" | "code" | "url" | "password"
    #[serde(default = "default_snippet_type")]
    pub snippet_type: String,
    /// Optional color label hex string e.g. "#ef4444"
    #[serde(default)]
    pub color: Option<String>,
    /// Unix timestamp (ms) when snippet was created
    #[serde(default)]
    pub created_at: u64,
    /// Unix timestamp (ms) when snippet was last used/pasted
    #[serde(default)]
    pub last_used_at: u64,
    /// Optional trigger abbreviation for text expansion (e.g. ":email")
    #[serde(default)]
    pub trigger: Option<String>,
    /// Optional favorite slot (1-9) for global Alt+1..9 hotkeys
    #[serde(default)]
    pub slot: Option<u8>,
    /// Optional executable name of the application the snippet was copied from
    #[serde(default)]
    pub source_app: Option<String>,
    /// Optional custom icon shown by the frontend.
    #[serde(default)]
    pub emoji: Option<String>,
    /// Macro steps executed in sequence.
    #[serde(default)]
    pub chain: Vec<String>,
}

fn default_snippet_type() -> String {
    "text".to_string()
}


#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Settings {
    pub dark_mode: bool,
    pub auto_paste: bool,
    pub clipboard_history_enabled: bool,
    pub startup_with_os: bool,
    pub hotkey: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_history_days")]
    pub clipboard_history_duration_days: u32,
    #[serde(default)]
    pub text_expansion_onboarding_completed: bool,
    #[serde(default)]
    pub text_expansion_default_pack_ids: Vec<String>,
    #[serde(default)]
    pub text_expansion_profile_name: String,
    #[serde(default)]
    pub text_expansion_profile_role: String,
    #[serde(default)]
    pub text_expansion_profile_stack: String,
    #[serde(default)]
    pub text_expansion_show_welcome_on_startup: bool,
}

fn default_theme() -> String {
    "violet".to_string()
}

fn default_history_days() -> u32 {
    30
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            dark_mode: false,
            auto_paste: true,
            clipboard_history_enabled: false,
            startup_with_os: false,
            hotkey: "alt+q".to_string(),
            theme: default_theme(),
            clipboard_history_duration_days: 30,
            text_expansion_onboarding_completed: false,
            text_expansion_default_pack_ids: Vec::new(),
            text_expansion_profile_name: String::new(),
            text_expansion_profile_role: String::new(),
            text_expansion_profile_stack: String::new(),
            text_expansion_show_welcome_on_startup: false,
        }
    }
}

fn get_app_dir() -> PathBuf {
    // Allow overriding the data directory for tests and portability via env var
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

pub fn get_snippets_path() -> PathBuf {
    let mut p = get_app_dir();
    p.push("snippets.json");
    p
}

pub fn get_settings_path() -> PathBuf {
    let mut p = get_app_dir();
    p.push("settings.json");
    p
}

fn sidecar_path(path: &PathBuf, suffix: &str) -> PathBuf {
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "data.json".to_string());
    let mut sidecar = path.clone();
    sidecar.set_file_name(format!("{}.{}", file_name, suffix));
    sidecar
}

fn backup_path(path: &PathBuf) -> PathBuf {
    sidecar_path(path, "bak")
}

fn temp_path(path: &PathBuf) -> PathBuf {
    sidecar_path(path, "tmp")
}

fn corrupt_archive_path(path: &PathBuf) -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "data.json".to_string());
    let mut archived = path.clone();
    archived.set_file_name(format!("{}.corrupted-{}", file_name, stamp));
    archived
}

fn write_json_with_backup(path: &PathBuf, content: &str) -> Result<(), String> {
    let tmp = temp_path(path);
    let backup = backup_path(path);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create data directory: {e}"))?;
    }
    let mut file = File::create(&tmp)
        .map_err(|e| format!("Could not create temporary data file: {e}"))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Could not write temporary data file: {e}"))?;
    file.sync_all()
        .map_err(|e| format!("Could not flush temporary data file: {e}"))?;
    drop(file);

    if path.exists() {
        fs::copy(path, &backup)
            .map_err(|e| format!("Could not create data backup: {e}"))?;
        fs::remove_file(path)
            .map_err(|e| format!("Could not replace existing data file: {e}"))?;
    }

    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        if backup.exists() && !path.exists() {
            let _ = fs::copy(&backup, path);
        }
        format!("Could not commit data file: {e}")
    })?;

    // Keep the backup synchronized after the first successful write as well.
    fs::copy(path, &backup).map_err(|e| format!("Could not update data backup: {e}"))?;
    Ok(())
}

fn archive_corrupt_file(path: &PathBuf) {
    if !path.exists() {
        return;
    }
    let archived = corrupt_archive_path(path);
    if archived.exists() {
        let _ = fs::remove_file(&archived);
    }
    if fs::rename(path, &archived).is_err() {
        let _ = fs::copy(path, &archived);
    }
}

fn read_json_file(path: &PathBuf) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

pub fn load_snippets() -> Vec<Snippet> {
    let path = get_snippets_path();
    if !path.exists() {
        let defaults = vec![
            Snippet {
                title: "Welcome".to_string(),
                content: "Welcome to QuickPaste! Click once to paste.".to_string(),
                pinned: true,
                use_count: 0,
                category: Some("General".to_string()),
                tags: vec!["welcome".to_string()],
                shortcut: None,
                is_secret: false,
                snippet_type: "text".to_string(),
                color: None,
                created_at: 0,
                last_used_at: 0,
                trigger: None,
                slot: None,
                source_app: None,
                id: None,
                emoji: None,
                chain: Vec::new(),
            }
        ];
        save_snippets(&defaults);
        return defaults;
    }

    let mut list: Vec<Snippet> = match read_json_file(&path).and_then(|content| {
        serde_json::from_str::<Vec<Snippet>>(&content).map_err(|e| e.to_string())
    }) {
        Ok(items) => items,
        Err(err) => {
            eprintln!("[QuickPaste] load_snippets failed to parse {}: {}", path.display(), err);
            let backup = backup_path(&path);
            match read_json_file(&backup).and_then(|content| {
                serde_json::from_str::<Vec<Snippet>>(&content).map_err(|e| e.to_string())
            }) {
                Ok(recovered) => {
                    eprintln!(
                        "[QuickPaste] load_snippets recovered from backup {}",
                        backup.display()
                    );
                    archive_corrupt_file(&path);
                    save_snippets(&recovered);
                    recovered
                }
                Err(backup_err) => {
                    eprintln!(
                        "[QuickPaste] load_snippets backup recovery failed ({}): {}",
                        backup.display(),
                        backup_err
                    );
                    archive_corrupt_file(&path);
                    Vec::new()
                }
            }
        }
    };

    // Auto-clean old clipboard history
    let settings = load_settings();
    if settings.clipboard_history_duration_days > 0 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let threshold_ms = (settings.clipboard_history_duration_days as u64) * 24 * 60 * 60 * 1000;
        if now > threshold_ms {
            let cutoff = now - threshold_ms;
            let original_len = list.len();
            list.retain(|s| {
                if s.category.as_deref() == Some("Clipboard") {
                    s.created_at >= cutoff
                } else {
                    true
                }
            });
            if list.len() != original_len {
                save_snippets(&list);
            }
        }
    }

    list
}

pub fn validate_snippets(snippets: &[Snippet]) -> Result<(), String> {
    if snippets.len() > 100_000 {
        return Err("Snippet limit exceeded".to_string());
    }
    for snippet in snippets {
        if snippet.title.trim().is_empty() || snippet.content.is_empty() {
            return Err("Snippet title and content are required".to_string());
        }
        if snippet.title.chars().count() > 200 || snippet.content.len() > 1_000_000 {
            return Err("Snippet field size limit exceeded".to_string());
        }
        if snippet.slot.is_some_and(|slot| !(1..=9).contains(&slot)) {
            return Err("Favorite slot must be between 1 and 9".to_string());
        }
    }
    Ok(())
}

pub fn save_snippets(snippets: &[Snippet]) -> Result<(), String> {
    validate_snippets(snippets)?;
    let path = get_snippets_path();
    let content = serde_json::to_string_pretty(snippets)
        .map_err(|e| format!("Could not serialize snippets: {e}"))?;
    write_json_with_backup(&path, &content)
}

pub fn load_settings() -> Settings {
    let path = get_settings_path();
    if !path.exists() {
        let defaults = Settings::default();
        save_settings(&defaults);
        return defaults;
    }

    match read_json_file(&path).and_then(|content| {
        serde_json::from_str(&content).map_err(|e| e.to_string())
    }) {
        Ok(settings) => settings,
        Err(err) => {
            eprintln!("[QuickPaste] load_settings failed to parse {}: {}", path.display(), err);
            let backup = backup_path(&path);
            match read_json_file(&backup).and_then(|content| {
                serde_json::from_str::<Settings>(&content).map_err(|e| e.to_string())
            }) {
                Ok(recovered) => {
                    eprintln!(
                        "[QuickPaste] load_settings recovered from backup {}",
                        backup.display()
                    );
                    archive_corrupt_file(&path);
                    save_settings(&recovered);
                    recovered
                }
                Err(backup_err) => {
                    eprintln!(
                        "[QuickPaste] load_settings backup recovery failed ({}): {}",
                        backup.display(),
                        backup_err
                    );
                    archive_corrupt_file(&path);
                    Settings::default()
                }
            }
        }
    }
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let path = get_settings_path();
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Could not serialize settings: {e}"))?;
    write_json_with_backup(&path, &content)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    #[test]
    fn save_and_load_snippets_roundtrip() {
        let _guard = crate::test_support::env_lock().lock().unwrap();
        let tmp = crate::test_support::temp_dir("snippets_roundtrip");
        env::set_var("QUICKPASTE_APP_DIR", &tmp);
        if tmp.exists() { let _ = fs::remove_dir_all(&tmp); }

        let defaults = vec![Snippet {
            title: "Test".to_string(),
            content: "Hello".to_string(),
            pinned: false,
            use_count: 0,
            category: Some("Test".to_string()),
            tags: vec!["t".to_string()],
            shortcut: None,
            is_secret: false,
            snippet_type: "text".to_string(),
            color: None,
            created_at: 0,
            last_used_at: 0,
            trigger: None,
            slot: None,
            source_app: None,
            id: None,
            emoji: None,
            chain: Vec::new(),
        }];

        save_snippets(&defaults);
        let loaded = load_snippets();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].title, "Test");

        let _ = fs::remove_dir_all(get_app_dir());
        env::remove_var("QUICKPASTE_APP_DIR");
    }

    #[test]
    fn save_and_load_settings_roundtrip() {
        let _guard = crate::test_support::env_lock().lock().unwrap();
        let tmp = crate::test_support::temp_dir("settings_roundtrip");
        env::set_var("QUICKPASTE_APP_DIR", &tmp);
        if tmp.exists() { let _ = fs::remove_dir_all(&tmp); }

        let mut s = Settings::default();
        s.dark_mode = true;
        s.theme = "custom:#112233".to_string();
        save_settings(&s);
        let loaded = load_settings();
        assert_eq!(loaded.dark_mode, true);
        assert_eq!(loaded.theme, "custom:#112233");

        let _ = fs::remove_dir_all(get_app_dir());
        env::remove_var("QUICKPASTE_APP_DIR");
    }

    #[test]
    fn load_snippets_recovers_from_backup_after_corruption() {
        let _guard = crate::test_support::env_lock().lock().unwrap();
        let tmp = crate::test_support::temp_dir("snippets_recover");
        env::set_var("QUICKPASTE_APP_DIR", &tmp);
        if tmp.exists() { let _ = fs::remove_dir_all(&tmp); }

        let defaults = vec![Snippet {
            title: "Recover".to_string(),
            content: "Backup".to_string(),
            pinned: false,
            use_count: 0,
            category: Some("Test".to_string()),
            tags: vec![],
            shortcut: None,
            is_secret: false,
            snippet_type: "text".to_string(),
            color: None,
            created_at: 0,
            last_used_at: 0,
            trigger: None,
            slot: None,
            source_app: None,
            id: None,
            emoji: None,
            chain: Vec::new(),
        }];

        save_snippets(&defaults);
        let path = get_snippets_path();
        fs::write(&path, "{invalid json").unwrap();

        let loaded = load_snippets();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].title, "Recover");

        let _ = fs::remove_dir_all(get_app_dir());
        env::remove_var("QUICKPASTE_APP_DIR");
    }

    #[test]
    fn load_settings_recovers_from_backup_after_corruption() {
        let _guard = crate::test_support::env_lock().lock().unwrap();
        let tmp = crate::test_support::temp_dir("settings_recover");
        env::set_var("QUICKPASTE_APP_DIR", &tmp);
        if tmp.exists() { let _ = fs::remove_dir_all(&tmp); }

        let mut settings = Settings::default();
        settings.dark_mode = true;
        settings.theme = "custom:#334455".to_string();
        save_settings(&settings);

        let path = get_settings_path();
        fs::write(&path, "{invalid json").unwrap();

        let loaded = load_settings();
        assert_eq!(loaded.dark_mode, true);
        assert_eq!(loaded.theme, "custom:#334455");

        let _ = fs::remove_dir_all(get_app_dir());
        env::remove_var("QUICKPASTE_APP_DIR");
    }
}
