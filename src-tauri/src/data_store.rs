use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Snippet {
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
            }
        ];
        save_snippets(&defaults);
        return defaults;
    }

    let mut list: Vec<Snippet> = if let Ok(mut file) = File::open(&path) {
        let mut content = String::new();
        if file.read_to_string(&mut content).is_ok() {
            serde_json::from_str(&content).unwrap_or_else(|_| Vec::new())
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
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

pub fn save_snippets(snippets: &[Snippet]) {
    let path = get_snippets_path();
    if let Ok(content) = serde_json::to_string_pretty(snippets) {
        if let Ok(mut file) = File::create(&path) {
            let _ = file.write_all(content.as_bytes());
        }
    }
}

pub fn load_settings() -> Settings {
    let path = get_settings_path();
    if !path.exists() {
        let defaults = Settings::default();
        save_settings(&defaults);
        return defaults;
    }

    let mut file = match File::open(&path) {
        Ok(f) => f,
        Err(_) => return Settings::default(),
    };
    let mut content = String::new();
    if file.read_to_string(&mut content).is_ok() {
        serde_json::from_str(&content).unwrap_or_else(|_| Settings::default())
    } else {
        Settings::default()
    }
}

pub fn save_settings(settings: &Settings) {
    let path = get_settings_path();
    if let Ok(content) = serde_json::to_string_pretty(settings) {
        if let Ok(mut file) = File::create(&path) {
            let _ = file.write_all(content.as_bytes());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    #[test]
    fn save_and_load_snippets_roundtrip() {
        let tmp = env::temp_dir().join(format!("quickpaste_test_{}", std::process::id()));
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
        let tmp = env::temp_dir().join(format!("quickpaste_test_{}", std::process::id()));
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
}
