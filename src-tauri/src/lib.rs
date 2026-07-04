use std::sync::Mutex;
use std::str::FromStr;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

mod clipboard_manager;
mod clipboard_monitor;
mod data_store;

#[cfg(target_os = "windows")]
mod keyboard_hook;


use data_store::{Snippet, Settings};

struct AppState {
    own_hwnd: Mutex<isize>,
    previous_window: Mutex<isize>,
    monitor: Mutex<clipboard_monitor::ClipboardMonitor>,
    pinned: Mutex<bool>,
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/// Capture the currently-active foreground window but reject our own handle or system shell windows.
fn capture_target(state: &AppState) {
    let hwnd = clipboard_manager::get_foreground_window();
    let own = *state.own_hwnd.lock().unwrap();
    if hwnd != 0 && hwnd != own && !clipboard_manager::is_system_window(hwnd) {
        let mut prev = state.previous_window.lock().unwrap();
        *prev = hwnd;
    }
}

fn show_window(win: &tauri::WebviewWindow, state: &AppState) {
    capture_target(state);
    let _ = win.show();
    let _ = win.set_focus();
}

/// Dynamically reconciles all registered global shortcuts:
/// unregisters all existing, then registers the app hotkey and all snippet hotkeys.
fn reregister_all_shortcuts(app: &AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    let _ = global_shortcut.unregister_all();

    // Register Alt+W hotkey
    if let Ok(alt_w) = Shortcut::from_str("Alt+W") {
        let _ = global_shortcut.register(alt_w);
    }

    // Register Alt+Q hotkey
    if let Ok(alt_q) = Shortcut::from_str("Alt+Q") {
        let _ = global_shortcut.register(alt_q);
    }

    // Register all snippet custom shortcuts
    let snippets = data_store::load_snippets();
    for snippet in &snippets {
        if let Some(ref sc) = snippet.shortcut {
            if !sc.trim().is_empty() {
                let formatted = format_hotkey(sc);
                if let Ok(shortcut) = Shortcut::from_str(&formatted) {
                    let _ = global_shortcut.register(shortcut);
                }
            }
        }
    }

    // Register Alt+1..9 favorite slots
    for snippet in &snippets {
        if let Some(slot) = snippet.slot {
            if slot >= 1 && slot <= 9 {
                let formatted = format!("Alt+{}", slot);
                if let Ok(shortcut) = Shortcut::from_str(&formatted) {
                    let _ = global_shortcut.register(shortcut);
                }
            }
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
fn save_settings(app: AppHandle, settings: Settings) {
    data_store::save_settings(&settings);
    let _ = reregister_all_shortcuts(&app);
}

#[tauri::command]
fn load_snippets() -> Vec<Snippet> {
    data_store::load_snippets()
}

#[tauri::command]
fn save_snippets(app: AppHandle, snippets: Vec<Snippet>) {
    data_store::save_snippets(&snippets);
    sync_triggers(&snippets);
    let _ = reregister_all_shortcuts(&app);
    let _ = app.emit("snippets-updated", ());
}

#[tauri::command]
fn get_storage_path() -> String {
    data_store::get_snippets_path()
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

#[tauri::command]
fn capture_foreground_window(state: State<'_, AppState>) -> isize {
    let hwnd = clipboard_manager::get_foreground_window();
    let own = *state.own_hwnd.lock().unwrap();
    if hwnd != 0 && hwnd != own && !clipboard_manager::is_system_window(hwnd) {
        let mut prev = state.previous_window.lock().unwrap();
        *prev = hwnd;
    }
    *state.previous_window.lock().unwrap()
}

#[tauri::command]
fn copy_and_paste(state: State<'_, AppState>, content: String, hwnd: Option<isize>, skip_copy: bool) {
    if !skip_copy {
        // Retry writing to clipboard multiple times if locked
        let mut success = false;
        for _ in 0..5 {
            if let Ok(mut ctx) = arboard::Clipboard::new() {
                if ctx.set_text(content.clone()).is_ok() {
                    success = true;
                    break;
                }
            }
            thread::sleep(Duration::from_millis(30));
        }

        if !success {
            println!("[QuickPaste] Error: Failed to write content to clipboard");
        }
    }

    let target = hwnd.unwrap_or_else(|| *state.previous_window.lock().unwrap());
    if target != 0 {
        // Sleep slightly to let the clipboard register before activating focus and pasting
        thread::sleep(Duration::from_millis(60));
        clipboard_manager::restore_focus_and_paste(target);
    }
}

#[tauri::command]
fn copy_only(content: String) {
    for _ in 0..5 {
        if let Ok(mut ctx) = arboard::Clipboard::new() {
            if ctx.set_text(content.clone()).is_ok() {
                break;
            }
        }
        thread::sleep(Duration::from_millis(30));
    }
}

#[tauri::command]
fn toggle_clipboard_monitor(app_handle: AppHandle, state: State<'_, AppState>, enabled: bool) {
    let monitor = state.monitor.lock().unwrap();
    if enabled {
        monitor.start(app_handle);
    } else {
        monitor.stop();
    }
    let mut settings = data_store::load_settings();
    settings.clipboard_history_enabled = enabled;
    data_store::save_settings(&settings);
}

#[tauri::command]
fn set_pinned(state: State<'_, AppState>, value: bool) {
    let mut pinned = state.pinned.lock().unwrap();
    *pinned = value;
}

#[tauri::command]
fn get_pinned(state: State<'_, AppState>) -> bool {
    *state.pinned.lock().unwrap()
}

#[tauri::command]
fn export_data() -> Result<(), String> {
    use std::fs;
    let snippets_src = data_store::get_snippets_path();
    let settings_src = data_store::get_settings_path();

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

    let bundle = serde_json::json!({
        "snippets": snippets_json,
        "settings": settings_json
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

    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let bundle: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let snippets: Vec<Snippet> = bundle
        .get("snippets")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let settings: Settings = bundle
        .get("settings")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    data_store::save_snippets(&snippets);
    data_store::save_settings(&settings);
    sync_triggers(&snippets);

    let _ = reregister_all_shortcuts(&app);
    let _ = app.emit("snippets-updated", ());

    Ok(Some(ImportedData { snippets, settings }))
}

#[derive(serde::Serialize)]
struct ImportedData {
    snippets: Vec<Snippet>,
    settings: Settings,
}

#[tauri::command]
fn clear_all_data(app: AppHandle) {
    data_store::save_snippets(&[]);
    data_store::save_settings(&Settings::default());
    sync_triggers(&[]);
    let _ = reregister_all_shortcuts(&app);
    let _ = app.emit("snippets-updated", ());
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
    data_store::save_settings(&settings);
    let _ = reregister_all_shortcuts(&app);
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
    if let Some(win) = app.get_webview_window("main") {
        show_window(&win, &state);
    }
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
                        
                        // Check Alt+W (Normal Settings/Sidebar window)
                        if let Ok(alt_w_shortcut) = Shortcut::from_str("Alt+W") {
                            if shortcut == &alt_w_shortcut {
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

                        // Check Alt+Q (Launcher overlay window)
                        if let Ok(alt_q_shortcut) = Shortcut::from_str("Alt+Q") {
                            if shortcut == &alt_q_shortcut {
                                if let Some(win) = app.get_webview_window("launcher") {
                                    let is_visible = win.is_visible().unwrap_or(false);
                                    if is_visible {
                                        let _ = win.hide();
                                    } else {
                                        show_window(&win, &state);
                                        let _ = win.emit("focus-search", ());
                                    }
                                }
                                return;
                            }
                        }

                        // Check if one of the snippet custom hotkeys is pressed
                        let snippets = data_store::load_snippets();
                        for snippet in &snippets {
                            if let Some(ref sc) = snippet.shortcut {
                                if !sc.trim().is_empty() {
                                    let formatted = format_hotkey(sc);
                                    if let Ok(snippet_shortcut) = Shortcut::from_str(&formatted) {
                                        if shortcut == &snippet_shortcut {
                                            let state = app.state::<AppState>();
                                            copy_and_paste(state, snippet.content.clone(), None, false);
                                            return;
                                        }
                                    }
                                }
                            }
                        }

                        // Check if one of the snippet favorite slot Alt+1..9 hotkeys is pressed
                        for snippet in &snippets {
                            if let Some(slot) = snippet.slot {
                                if slot >= 1 && slot <= 9 {
                                    let formatted = format!("Alt+{}", slot);
                                    if let Ok(slot_shortcut) = Shortcut::from_str(&formatted) {
                                        if shortcut == &slot_shortcut {
                                            let state = app.state::<AppState>();
                                            copy_and_paste(state, snippet.content.clone(), None, false);
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
            if settings.clipboard_history_enabled {
                let state = app.state::<AppState>();
                let monitor = state.monitor.lock().unwrap();
                monitor.start(app.handle().clone());
            }

            // Sync triggers and start low-level keyboard hook on Windows
            let snippets = data_store::load_snippets();
            sync_triggers(&snippets);
            #[cfg(target_os = "windows")]
            keyboard_hook::start_keyboard_hook();

            // Register all global shortcuts (main toggle + snippet shortcuts)
            let _ = reregister_all_shortcuts(app.handle());

            // System tray
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
            let show_i = tauri::menu::MenuItem::with_id(app, "show", "Show QuickPaste", true, None::<&str>).unwrap();
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i]).unwrap();

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
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
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            load_snippets,
            save_snippets,
            get_storage_path,
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

fn sync_triggers(snippets: &[data_store::Snippet]) {
    #[cfg(target_os = "windows")]
    {
        let list: Vec<(String, String)> = snippets
            .iter()
            .filter_map(|s| {
                s.trigger.as_ref().and_then(|t| {
                    let trimmed = t.trim();
                    if !trimmed.is_empty() {
                        Some((trimmed.to_string(), s.content.clone()))
                    } else {
                        None
                    }
                })
            })
            .collect();
        keyboard_hook::update_triggers(list);
    }
}

