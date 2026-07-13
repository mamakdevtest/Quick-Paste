use std::sync::Mutex;
use std::str::FromStr;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

mod clipboard_manager;
mod clipboard_monitor;
mod data_store;
mod text_expansion;

#[cfg(target_os = "windows")]
mod keyboard_hook;


use data_store::{Snippet, Settings};
use text_expansion::TextExpansion;

#[cfg(test)]
pub(crate) mod test_support {
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};

    pub fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    pub fn temp_dir(prefix: &str) -> PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "quickpaste_test_{}_{}_{}",
            prefix,
            std::process::id(),
            stamp
        ))
    }
}

struct AppState {
    own_hwnd: Mutex<isize>,
    previous_window: Mutex<isize>,
    monitor: Mutex<clipboard_monitor::ClipboardMonitor>,
    pinned: Mutex<bool>,
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn is_own_window(hwnd: isize) -> bool {
    if hwnd == 0 {
        return false;
    }
    unsafe {
        let mut pid: u32 = 0;
        windows_sys::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(
            hwnd as windows_sys::Win32::Foundation::HWND,
            &mut pid,
        );
        let own_pid = windows_sys::Win32::System::Threading::GetCurrentProcessId();
        pid == own_pid
    }
}

#[cfg(not(target_os = "windows"))]
fn is_own_window(_hwnd: isize) -> bool {
    false
}

/// Capture the currently-active foreground window but reject our own handle or system shell windows.
fn capture_target(state: &AppState) {
    let hwnd = clipboard_manager::get_foreground_window();
    let own = *state.own_hwnd.lock().unwrap_or_else(|e| e.into_inner());
    if hwnd != 0 && hwnd != own && !clipboard_manager::is_system_window(hwnd) {
        let mut prev = state.previous_window.lock().unwrap_or_else(|e| e.into_inner());
        *prev = hwnd;
    }
}

fn resolve_paste_target(state: &AppState, hwnd: Option<isize>) -> isize {
    if let Some(target) = hwnd.filter(|value| *value != 0) {
        return target;
    }

    capture_target(state);
    *state.previous_window.lock().unwrap_or_else(|e| e.into_inner())
}

fn show_window(win: &tauri::WebviewWindow, state: &AppState) {
    capture_target(state);
    let _ = win.show();
    let _ = win.set_focus();
}

fn ensure_welcome_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window("welcome") {
        return Ok(existing);
    }

    tauri::WebviewWindowBuilder::new(app, "welcome", WebviewUrl::App("welcome.html".into()))
        .title("QuickPaste Welcome")
        .inner_size(1200.0, 900.0)
        .min_inner_size(900.0, 700.0)
        .center()
        .resizable(true)
        .decorations(false)
        .transparent(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())
}

fn show_welcome_window(app: &AppHandle, fullscreen: bool) -> Result<(), String> {
    let win = ensure_welcome_window(app)?;
    let _ = win.show();
    let _ = win.set_fullscreen(fullscreen);
    let _ = win.set_focus();
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    Ok(())
}

fn hide_welcome_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("welcome") {
        let _ = win.set_fullscreen(false);
        let _ = win.hide();
    }
}

/// Dynamically reconciles all registered global shortcuts:
/// unregisters all existing, then registers the app hotkey and all snippet hotkeys.
fn reregister_all_shortcuts(app: &AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    global_shortcut
        .unregister_all()
        .map_err(|e| format!("Could not clear existing shortcuts: {e}"))?;

    let settings = data_store::load_settings();
    let app_hotkey = format_hotkey(settings.hotkey.trim());
    let app_shortcut = Shortcut::from_str(&app_hotkey)
        .map_err(|e| format!("Invalid app shortcut '{app_hotkey}': {e}"))?;
    global_shortcut
        .register(app_shortcut)
        .map_err(|e| format!("Could not register app shortcut '{app_hotkey}': {e}"))?;

    let snippets = data_store::load_snippets();
    for snippet in &snippets {
        if let Some(sc) = snippet.shortcut.as_deref().filter(|value| !value.trim().is_empty()) {
            let formatted = format_hotkey(sc);
            let shortcut = Shortcut::from_str(&formatted)
                .map_err(|e| format!("Invalid shortcut '{formatted}' for '{}': {e}", snippet.title))?;
            global_shortcut
                .register(shortcut)
                .map_err(|e| format!("Shortcut '{formatted}' for '{}' is unavailable: {e}", snippet.title))?;
        }
    }

    for snippet in &snippets {
        if let Some(slot @ 1..=9) = snippet.slot {
            let formatted = format!("Alt+{slot}");
            let shortcut = Shortcut::from_str(&formatted)
                .map_err(|e| format!("Invalid favorite shortcut '{formatted}': {e}"))?;
            global_shortcut
                .register(shortcut)
                .map_err(|e| format!("Favorite shortcut '{formatted}' is unavailable: {e}"))?;
        }
    }

    Ok(())
}

// ──────────────────────────────────────────────────────────────────────────────
// IPC Commands
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_settings() -> Settings {
    data_store::load_settings()
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let previous = data_store::load_settings();
    data_store::save_settings(&settings)?;
    if let Err(error) = reregister_all_shortcuts(&app) {
        data_store::save_settings(&previous)?;
        let _ = reregister_all_shortcuts(&app);
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
fn load_snippets() -> Vec<Snippet> {
    data_store::load_snippets()
}

#[tauri::command]
fn save_snippets(app: AppHandle, snippets: Vec<Snippet>) -> Result<(), String> {
    let previous = data_store::load_snippets();
    let previous_expansions = text_expansion::current_snapshot();
    let next_expansions = text_expansion::reconcile_snippets(
        &previous_expansions,
        &previous,
        &snippets,
    )?;

    data_store::save_snippets(&snippets)?;
    if let Err(error) = text_expansion::save_text_expansions(&next_expansions) {
        data_store::save_snippets(&previous)?;
        return Err(error);
    }
    if let Err(error) = reregister_all_shortcuts(&app) {
        data_store::save_snippets(&previous)?;
        text_expansion::save_text_expansions(&previous_expansions)?;
        let _ = reregister_all_shortcuts(&app);
        return Err(error);
    }
    app.emit("snippets-updated", ())
        .map_err(|e| format!("Snippets were saved but the UI could not be notified: {e}"))?;
    app.emit("text-expansions-updated", ())
        .map_err(|e| format!("Snippet was saved but expansion UI could not be notified: {e}"))?;
    Ok(())
}

#[tauri::command]
fn get_storage_path() -> String {
    data_store::get_snippets_path()
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

#[tauri::command]
fn get_active_process_name() -> String {
    clipboard_manager::get_active_process_name()
}

#[tauri::command]
fn load_text_expansions() -> Vec<TextExpansion> {
    text_expansion::load_text_expansions()
}

#[tauri::command]
fn load_text_expansion_catalog(locale: Option<String>) -> text_expansion::TextExpansionCatalog {
    text_expansion::load_text_expansion_catalog(locale)
}

#[tauri::command]
fn save_text_expansions(app: AppHandle, items: Vec<TextExpansion>) -> Result<Vec<TextExpansion>, String> {
    let saved = text_expansion::save_text_expansions(&items)?;
    app.emit("text-expansions-updated", ())
        .map_err(|e| format!("Expansions saved but UI could not be notified: {e}"))?;
    Ok(saved)
}

#[tauri::command]
fn export_text_expansions(locale: Option<String>) -> Result<bool, String> {
    use std::fs;

    let export_title = if is_turkish_locale(locale.as_deref()) {
        "Metin Genişletmeleri Dışa Aktar"
    } else {
        "Export Text Expansions"
    };

    let Some(path) = rfd::FileDialog::new()
        .set_title(export_title)
        .set_file_name("text_expansions.json")
        .add_filter("JSON Backup", &["json"])
        .save_file()
    else {
        return Ok(false);
    };

    let items = text_expansion::current_snapshot();
    let out = text_expansion::export_payload(&items)?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, out).map_err(|e| e.to_string())?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    fs::rename(&temporary, &path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn import_text_expansions(app: AppHandle, locale: Option<String>) -> Result<Option<Vec<TextExpansion>>, String> {
    use std::fs;

    let import_title = if is_turkish_locale(locale.as_deref()) {
        "Metin Genişletmeleri İçe Aktar"
    } else {
        "Import Text Expansions"
    };

    let Some(path) = rfd::FileDialog::new()
        .set_title(import_title)
        .add_filter("JSON Backup", &["json"])
        .pick_file()
    else {
        return Ok(None);
    };

    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    if metadata.len() > 50 * 1024 * 1024 {
        return Err("Text expansion import is larger than 50 MB".to_string());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let imported = text_expansion::parse_import_payload(&raw)?;
    let snippets = data_store::load_snippets();
    let reconciled = text_expansion::reconcile_snippets(&imported, &snippets, &snippets)?;
    let saved = text_expansion::save_text_expansions(&reconciled)?;
    app.emit("text-expansions-updated", ())
        .map_err(|e| format!("Expansions imported but UI could not be notified: {e}"))?;
    Ok(Some(saved))
}

#[tauri::command]
fn reset_text_expansions(app: AppHandle) -> Result<Vec<TextExpansion>, String> {
    let items = text_expansion::reset_text_expansions()?;
    app.emit("text-expansions-updated", ())
        .map_err(|e| format!("Expansions reset but UI could not be notified: {e}"))?;
    Ok(items)
}

fn is_turkish_locale(locale: Option<&str>) -> bool {
    locale
        .map(|value| value.to_lowercase().starts_with("tr"))
        .unwrap_or(false)
}

#[tauri::command]
fn capture_foreground_window(state: State<'_, AppState>) -> isize {
    let hwnd = clipboard_manager::get_foreground_window();
    let own = *state.own_hwnd.lock().unwrap_or_else(|e| e.into_inner());
    if hwnd != 0 && hwnd != own && !clipboard_manager::is_system_window(hwnd) {
        let mut prev = state.previous_window.lock().unwrap_or_else(|e| e.into_inner());
        *prev = hwnd;
    }
    *state.previous_window.lock().unwrap_or_else(|e| e.into_inner())
}

#[tauri::command]
fn copy_and_paste(state: State<'_, AppState>, content: String, hwnd: Option<isize>, skip_copy: bool) -> bool {
    let content_len = content.len();
    #[cfg(target_os = "windows")]
    let clipboard_snapshot = if skip_copy {
        None
    } else {
        clipboard_manager::capture_clipboard_snapshot()
    };
    #[cfg(not(target_os = "windows"))]
    let clipboard_snapshot = None;

    let mut success = false;
    let mut last_attempt = 0;
    let mut wait_ms = 10u64;

    if !skip_copy {
        #[cfg(target_os = "windows")]
        clipboard_monitor::suppress_updates_for(Duration::from_millis(1500));

        // Retry writing to clipboard multiple times with exponential backoff
        for attempt in 1..=6 {
            last_attempt = attempt;
            match arboard::Clipboard::new() {
                Ok(mut ctx) => match ctx.set_text(content.clone()) {
                    Ok(_) => {
                        success = true;
                        println!("[QuickPaste] Clipboard write succeeded ({} bytes) on attempt {}", content_len, attempt);
                        break;
                    }
                    Err(e) => {
                        eprintln!("[QuickPaste] Clipboard set_text failed (attempt {}): {}", attempt, e);
                    }
                },
                Err(e) => {
                    eprintln!("[QuickPaste] Clipboard init failed (attempt {}): {}", attempt, e);
                }
            }

            thread::sleep(Duration::from_millis(wait_ms));
            wait_ms = (wait_ms * 2).min(500);
        }

        if !success {
            eprintln!("[QuickPaste] Error: Failed to write {} bytes to clipboard after {} attempts", content_len, last_attempt);
            return false;
        }
    } else {
        println!("[QuickPaste] Skipping clipboard write as requested (content_len={})", content_len);
    }

    let target = resolve_paste_target(&state, hwnd);
    let mut paste_success = false;

    if target != 0 {
        // Sleep slightly to let the clipboard register before activating focus and pasting
        thread::sleep(Duration::from_millis(80));
        println!("[QuickPaste] Pasting to target hwnd={} (content_len={})", target, content_len);
        paste_success = clipboard_manager::restore_focus_and_paste(target);
        if !paste_success {
            eprintln!("[QuickPaste] copy_and_paste: paste injection failed for target hwnd={}", target);
        }
    } else {
        eprintln!("[QuickPaste] copy_and_paste: no valid paste target found (content_len={})", content_len);
    }

    #[cfg(target_os = "windows")]
    if let Some(snapshot) = clipboard_snapshot {
        // Give the target app enough time to read the temporary clipboard contents.
        thread::sleep(Duration::from_millis(180));
        clipboard_monitor::suppress_updates_for(Duration::from_millis(1500));
        if let Err(err) = clipboard_manager::restore_clipboard_snapshot(&snapshot) {
            eprintln!("[QuickPaste] copy_and_paste: failed to restore clipboard snapshot: {}", err);
        }
    }

    if skip_copy {
        paste_success
    } else {
        success && paste_success
    }
}

#[tauri::command]
fn copy_only(content: String) -> bool {
    let content_len = content.len();
    let mut success = false;
    let mut wait_ms = 10u64;
    for attempt in 1..=6 {
        match arboard::Clipboard::new() {
            Ok(mut ctx) => match ctx.set_text(content.clone()) {
                Ok(_) => {
                    success = true;
                    println!("[QuickPaste] copy_only: wrote {} bytes on attempt {}", content_len, attempt);
                    break;
                }
                Err(e) => {
                    eprintln!("[QuickPaste] copy_only: set_text failed (attempt {}): {}", attempt, e);
                }
            },
            Err(e) => {
                eprintln!("[QuickPaste] copy_only: Clipboard init failed (attempt {}): {}", attempt, e);
            }
        }
        thread::sleep(Duration::from_millis(wait_ms));
        wait_ms = (wait_ms * 2).min(500);
    }
    if !success {
        eprintln!("[QuickPaste] copy_only: failed to write {} bytes after attempts", content_len);
    } else {
        println!("[QuickPaste] copy_only: succeeded ({} bytes)", content_len);
    }
    success
}

#[tauri::command]
fn toggle_clipboard_monitor(app_handle: AppHandle, state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    let monitor = state.monitor.lock().unwrap_or_else(|e| e.into_inner());
    if enabled {
        monitor.start(app_handle.clone());
    } else {
        monitor.stop();
    }
    let mut settings = data_store::load_settings();
    settings.clipboard_history_enabled = enabled;
    if let Err(error) = data_store::save_settings(&settings) {
        if enabled { monitor.stop(); } else { monitor.start(app_handle); }
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
fn set_pinned(state: State<'_, AppState>, value: bool) {
    let mut pinned = state.pinned.lock().unwrap_or_else(|e| e.into_inner());
    *pinned = value;
}

#[tauri::command]
fn get_pinned(state: State<'_, AppState>) -> bool {
    *state.pinned.lock().unwrap_or_else(|e| e.into_inner())
}

#[tauri::command]
fn export_data() -> Result<(), String> {
    use std::fs;
    let snippets_src = data_store::get_snippets_path();
    let settings_src = data_store::get_settings_path();
    let text_expansions = text_expansion::current_snapshot();

    let Some(path) = rfd::FileDialog::new()
        .set_title("Export QuickPaste Backup")
        .set_file_name("quickpaste_backup.json")
        .add_filter("JSON Backup", &["json"])
        .save_file()
    else {
        return Ok(());
    };

    let snippets_raw = fs::read_to_string(&snippets_src).unwrap_or_else(|_| "[]".to_string());
    let settings_raw = fs::read_to_string(&settings_src).unwrap_or_else(|_| "{}".to_string());

    let snippets_json: serde_json::Value = serde_json::from_str(&snippets_raw)
        .unwrap_or(serde_json::Value::Array(vec![]));
    let settings_json: serde_json::Value = serde_json::from_str(&settings_raw)
        .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
    let text_expansions_json = serde_json::to_value(text_expansions)
        .unwrap_or(serde_json::Value::Array(vec![]));

    let bundle = serde_json::json!({
        "version": 2,
        "snippets": snippets_json,
        "settings": settings_json,
        "text_expansions": text_expansions_json,
    });

    let out = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;
    fs::write(&path, out).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn import_data(app: AppHandle) -> Result<Option<ImportedData>, String> {
    use std::fs;

    let Some(path) = rfd::FileDialog::new()
        .set_title("Import QuickPaste Backup")
        .add_filter("JSON Backup", &["json"])
        .pick_file()
    else {
        return Ok(None);
    };

    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    if metadata.len() > 50 * 1024 * 1024 {
        return Err("Backup file is larger than 50 MB".to_string());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let bundle: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let version = bundle.get("version").and_then(|value| value.as_u64()).unwrap_or(1);
    if !(1..=2).contains(&version) {
        return Err(format!("Unsupported backup version: {version}"));
    }

    let snippets_value = bundle.get("snippets")
        .ok_or_else(|| "Backup does not contain snippets".to_string())?;
    let snippets: Vec<Snippet> = serde_json::from_value(snippets_value.clone())
        .map_err(|e| format!("Invalid snippets in backup: {e}"))?;
    data_store::validate_snippets(&snippets)?;

    let settings_value = bundle.get("settings")
        .ok_or_else(|| "Backup does not contain settings".to_string())?;
    let settings: Settings = serde_json::from_value(settings_value.clone())
        .map_err(|e| format!("Invalid settings in backup: {e}"))?;

    let text_expansions_from_bundle: Option<Vec<TextExpansion>> = bundle
        .get("text_expansions")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .or_else(|| {
            bundle
                .get("textExpansions")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
        });

    data_store::save_snippets(&snippets)?;
    data_store::save_settings(&settings)?;

    let imported_expansions = match text_expansions_from_bundle {
        Some(items) => text_expansion::replace_runtime(items)?,
        None => {
            let seeded = text_expansion::build_seeded_text_expansions(&snippets);
            text_expansion::replace_runtime(seeded)?
        }
    };

    reregister_all_shortcuts(&app)?;
    app.emit("snippets-updated", ())
        .map_err(|e| format!("Imported data, but could not notify snippets UI: {e}"))?;
    app.emit("text-expansions-updated", ())
        .map_err(|e| format!("Imported data, but could not notify expansion UI: {e}"))?;

    Ok(Some(ImportedData {
        snippets,
        settings,
        text_expansions: imported_expansions,
    }))
}

#[derive(serde::Serialize)]
struct ImportedData {
    snippets: Vec<Snippet>,
    settings: Settings,
    text_expansions: Vec<TextExpansion>,
}

#[tauri::command]
fn clear_all_data(app: AppHandle) -> Result<(), String> {
    data_store::save_snippets(&[])?;
    data_store::save_settings(&Settings::default())?;
    text_expansion::reset_text_expansions()?;
    reregister_all_shortcuts(&app)?;
    app.emit("snippets-updated", ())
        .map_err(|e| format!("Data cleared, but could not notify snippets UI: {e}"))?;
    app.emit("text-expansions-updated", ())
        .map_err(|e| format!("Data cleared, but could not notify expansion UI: {e}"))?;
    Ok(())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags(
                "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                KEY_SET_VALUE,
            )
            .map_err(|e| e.to_string())?;

        if enabled {
            // Get the path to the current executable
            let exe_path = std::env::current_exe()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();
            run_key
                .set_value("QuickPaste", &exe_path)
                .map_err(|e| e.to_string())?;
        } else {
            // Remove if exists (ignore error if not present)
            let _ = run_key.delete_value("QuickPaste");
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
    }

    // Persist setting
    let mut settings = data_store::load_settings();
    settings.startup_with_os = enabled;
    data_store::save_settings(&settings)?;
    reregister_all_shortcuts(&app)?;
    Ok(())
}

#[tauri::command]
fn set_window_opacity(app: AppHandle, opacity: f64) {
    if let Some(win) = app.get_webview_window("main") {
        let clamped = opacity.clamp(0.3, 1.0) as f32;
        // Tauri v2: set_shadow false, apply opacity via window effects not directly supported.
        // We store opacity in settings and apply via JS webview style instead.
        // Fallback: use JS-side body opacity set via emit.
        let _ = win.emit("set-opacity", clamped);
    }
}

/// Called from JS on the window `focus` event to record our own HWND,
/// so we never treat it as a paste target.
#[tauri::command]
fn store_own_hwnd(state: State<'_, AppState>) {
    // Get the *current* foreground window — which is ours, since JS calls this
    // right after the window receives focus.
    let hwnd = clipboard_manager::get_foreground_window();
    if hwnd != 0 {
        let mut own = state.own_hwnd.lock().unwrap();
        *own = hwnd;
    }
}

#[tauri::command]
fn open_launcher_window(app: AppHandle, state: State<'_, AppState>) {
    if let Some(win) = app.get_webview_window("launcher") {
        show_window(&win, &state);
        let _ = win.emit("focus-search", ());
    }
}

#[tauri::command]
fn open_main_window(app: AppHandle, state: State<'_, AppState>) {
    hide_welcome_window(&app);
    if let Some(win) = app.get_webview_window("main") {
        show_window(&win, &state);
    }
}

#[tauri::command]
fn open_welcome_window(app: AppHandle, fullscreen: Option<bool>) -> Result<(), String> {
    show_welcome_window(&app, fullscreen.unwrap_or(true))
}

#[tauri::command]
fn close_welcome_window(app: AppHandle, state: State<'_, AppState>) {
    hide_welcome_window(&app);
    if let Some(main) = app.get_webview_window("main") {
        show_window(&main, &state);
    }
}

#[tauri::command]
fn apply_text_expansion_trigger(trigger: String, delete_graphemes: usize) -> Result<(), String> {
    keyboard_hook::apply_text_expansion_trigger(trigger, delete_graphemes)
}

// ──────────────────────────────────────────────────────────────────────────────
// App Entry
// ──────────────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let state = app.state::<AppState>();
                        
                        // Check Alt+Q (Main window toggle — previously Alt+W)
                        if let Ok(alt_q_shortcut) = Shortcut::from_str("Alt+Q") {
                            if shortcut == &alt_q_shortcut {
                                if let Some(win) = app.get_webview_window("main") {
                                    let is_visible = win.is_visible().unwrap_or(false);
                                    if is_visible {
                                        let _ = win.hide();
                                    } else {
                                        show_window(&win, &state);
                                    }
                                }
                                return;
                            }
                        }

                        // Launcher overlay shortcuts disabled (Alt+Q/Ctrl+Q removed)
                        // The app now uses Alt+Q to toggle the main window (previously Alt+W).

                        // Check if one of the snippet custom hotkeys is pressed
                        let snippets = data_store::load_snippets();
                        for snippet in &snippets {
                            if let Some(ref sc) = snippet.shortcut {
                                if !sc.trim().is_empty() {
                                    let formatted = format_hotkey(sc);
                                    if let Ok(snippet_shortcut) = Shortcut::from_str(&formatted) {
                                        if shortcut == &snippet_shortcut {
                                            let state = app.state::<AppState>();
                                            let ok = copy_and_paste(state, snippet.content.clone(), None, false);
                                            if !ok {
                                                eprintln!("[QuickPaste] GlobalShortcut: paste failed for snippet hotkey");
                                            }
                                            return;
                                        }
                                    }
                                }
                            }
                        }

                        // Check if one of the snippet favorite slot Alt+1..9 hotkeys is pressed
                        for snippet in &snippets {
                            if let Some(slot) = snippet.slot {
                                if (1..=9).contains(&slot) {
                                    let formatted = format!("Alt+{}", slot);
                                    if let Ok(slot_shortcut) = Shortcut::from_str(&formatted) {
                                        if shortcut == &slot_shortcut {
                                            let state = app.state::<AppState>();
                                            let ok = copy_and_paste(state, snippet.content.clone(), None, false);
                                            if !ok {
                                                eprintln!("[QuickPaste] GlobalShortcut: paste failed for favorite slot hotkey");
                                            }
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(AppState {
            own_hwnd: Mutex::new(0),
            previous_window: Mutex::new(0),
            monitor: Mutex::new(clipboard_monitor::ClipboardMonitor::new()),
            pinned: Mutex::new(false),
        })
        .setup(|app| {
            // own_hwnd is populated by store_own_hwnd IPC called from JS on first focus.

            // Start clipboard monitor if enabled
            let settings = data_store::load_settings();
            let should_show_welcome = !settings.text_expansion_onboarding_completed;

            let _ = ensure_welcome_window(&app.handle());
            if should_show_welcome {
                let _ = show_welcome_window(&app.handle(), true);
            } else {
                hide_welcome_window(&app.handle());
            }

            if settings.clipboard_history_enabled {
                let state = app.state::<AppState>();
                let monitor = state.monitor.lock().unwrap_or_else(|e| e.into_inner());
                monitor.start(app.handle().clone());
            }

            // Sync triggers and start low-level keyboard hook on Windows
            let snippets = data_store::load_snippets();
            let _ = text_expansion::bootstrap_runtime(&snippets);
            #[cfg(target_os = "windows")]
            keyboard_hook::start_keyboard_hook_with_app(Some(app.handle().clone()));

            // Register all global shortcuts (main toggle + snippet shortcuts)
            let _ = reregister_all_shortcuts(app.handle());

            // System tray: create menu items safely to avoid panics on failure
            let quit_i = match tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>) {
                Ok(mi) => mi,
                Err(e) => {
                    eprintln!("[QuickPaste] Failed to create tray menu item 'quit': {}", e);
                    return Ok(());
                }
            };
            let show_i = match tauri::menu::MenuItem::with_id(app, "show", "Show QuickPaste", true, None::<&str>) {
                Ok(mi) => mi,
                Err(e) => {
                    eprintln!("[QuickPaste] Failed to create tray menu item 'show': {}", e);
                    return Ok(());
                }
            };
            let menu = match tauri::menu::Menu::with_items(app, &[&show_i, &quit_i]) {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[QuickPaste] Failed to create tray menu: {}", e);
                    return Ok(());
                }
            };

            let mut tray_builder = tauri::tray::TrayIconBuilder::new();
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            } else {
                eprintln!("[QuickPaste] No default window icon available for tray; proceeding without icon.");
            }

            let tray_builder = tray_builder
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let state = app.state::<AppState>();
                                show_window(&win, &state);
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            if let Some(win) = app.get_webview_window("main") {
                                let is_visible = win.is_visible().unwrap_or(false);
                                let state = app.state::<AppState>();
                                if is_visible {
                                    let _ = win.hide();
                                } else {
                                    show_window(&win, &state);
                                }
                            }
                        }
                    }
                });

            let _tray = match tray_builder.build(app) {
                Ok(t) => t,
                Err(e) => {
                    eprintln!("[QuickPaste] Failed to build tray icon: {}", e);
                    return Ok(());
                }
            };

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            load_snippets,
            save_snippets,
            get_storage_path,
            get_active_process_name,
            load_text_expansions,
            load_text_expansion_catalog,
            save_text_expansions,
            export_text_expansions,
            import_text_expansions,
            reset_text_expansions,
            capture_foreground_window,
            copy_and_paste,
            copy_only,
            toggle_clipboard_monitor,
            set_pinned,
            get_pinned,
            export_data,
            import_data,
            clear_all_data,
            store_own_hwnd,
            set_autostart,
            set_window_opacity,
            open_launcher_window,
            open_main_window,
            open_welcome_window,
            close_welcome_window,
            apply_text_expansion_trigger,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn format_hotkey(hotkey: &str) -> String {
    hotkey
        .split('+')
        .map(|part| {
            let mut c = part.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join("+")
}

