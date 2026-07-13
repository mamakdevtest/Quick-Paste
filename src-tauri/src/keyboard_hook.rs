use std::sync::atomic::{AtomicIsize, AtomicUsize, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl};
use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::Graphics::Gdi::ClientToScreen;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, GetKeyboardState, MapVirtualKeyW, SendInput, ToUnicode, INPUT, INPUT_KEYBOARD,
    KEYBDINPUT, MAPVK_VK_TO_VSC,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetGUIThreadInfo, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    GUITHREADINFO, WH_KEYBOARD_LL, KBDLLHOOKSTRUCT, MSG, WM_KEYDOWN, WM_SYSKEYDOWN,
};
use unicode_segmentation::UnicodeSegmentation;

use crate::{clipboard_monitor, clipboard_manager, text_expansion::{self, TerminatorKind}};

const VK_BACK: u32 = 0x08;
const VK_TAB: u32 = 0x09;
const VK_RETURN: u32 = 0x0D;
const VK_SHIFT: u32 = 0x10;
const VK_CONTROL: u32 = 0x11;
const VK_MENU: u32 = 0x12;
const VK_ESCAPE: u32 = 0x1B;
const VK_SPACE: u32 = 0x20;
const VK_LWIN: u32 = 0x5B;
const VK_RWIN: u32 = 0x5C;
const VK_LCONTROL: u32 = 0xA2;
const VK_RCONTROL: u32 = 0xA3;
const VK_LSHIFT: u32 = 0xA0;
const VK_RSHIFT: u32 = 0xA1;
const VK_LMENU: u32 = 0xA4;
const VK_RMENU: u32 = 0xA5;

const LLKHF_LOWER_IL_INJECTED: u32 = 0x02;
const LLKHF_INJECTED: u32 = 0x10;
const SUGGESTION_WIDTH: f64 = 340.0;
const SUGGESTION_MIN_HEIGHT: f64 = 152.0;
const SUGGESTION_MAX_HEIGHT: f64 = 420.0;
const SUGGESTION_GAP: f64 = 10.0;
const SCREEN_PADDING: f64 = 12.0;

static SUSPEND_COUNT: AtomicUsize = AtomicUsize::new(0);
static TYPED_BUFFER: Mutex<String> = Mutex::new(String::new());
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static LAST_TARGET_HWND: AtomicIsize = AtomicIsize::new(0);

struct SuspendGuard;

impl Drop for SuspendGuard {
    fn drop(&mut self) {
        SUSPEND_COUNT.fetch_sub(1, Ordering::SeqCst);
    }
}

#[allow(dead_code)]
pub fn start_keyboard_hook() {
    // compatibility shim
    start_keyboard_hook_with_app(None);
}

pub fn start_keyboard_hook_with_app(app: Option<AppHandle>) {
    if let Some(app) = app {
        let _ = APP_HANDLE.set(app);
    }
    thread::spawn(|| unsafe {
        let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), std::ptr::null_mut(), 0);
        if hook.is_null() {
            eprintln!("[QuickPaste] Low-level keyboard hook installation failed");
            return;
        }

        println!("[QuickPaste] Low-level keyboard hook installed");

        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {}

        UnhookWindowsHookEx(hook);
    });
}

fn app_handle() -> Option<&'static AppHandle> {
    APP_HANDLE.get()
}

fn normalize_query_key(value: &str) -> String {
    value.trim().trim_start_matches(':').to_lowercase()
}

fn active_suggestion_token(buffer: &str) -> Option<String> {
    let trimmed = buffer.trim_end_matches(|ch: char| ch.is_whitespace());
    if trimmed.is_empty() {
        return None;
    }

    let token = trimmed
        .rsplit(|ch: char| ch.is_whitespace())
        .next()
        .unwrap_or_default()
        .trim();

    if !token.starts_with(':') || token.graphemes(true).count() < 2 {
        return None;
    }

    Some(token.to_string())
}

fn current_target_window() -> isize {
    let hwnd = clipboard_manager::get_foreground_window();
    if hwnd != 0 && !clipboard_manager::is_system_window(hwnd) {
        LAST_TARGET_HWND.store(hwnd, Ordering::SeqCst);
    }
    LAST_TARGET_HWND.load(Ordering::SeqCst)
}

fn ensure_suggestion_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window("suggestions") {
        return Ok(existing);
    }

    tauri::WebviewWindowBuilder::new(app, "suggestions", WebviewUrl::App("suggestions.html".into()))
        .title("QuickPaste Suggestions")
        .inner_size(340.0, 172.0)
        .min_inner_size(320.0, 152.0)
        .resizable(false)
        .decorations(false)
        .transparent(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())
}

#[derive(Clone, Copy, Debug)]
struct AnchorRect {
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
}

#[derive(Clone, Copy, Debug)]
struct SuggestionPlacement {
    x: f64,
    y: f64,
    height: f64,
    inverted: bool,
}

#[cfg(target_os = "windows")]
fn caret_anchor_rect() -> Option<AnchorRect> {
    unsafe {
        let mut info: GUITHREADINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<GUITHREADINFO>() as u32;
        if GetGUIThreadInfo(0, &mut info) == 0 || info.hwndCaret.is_null() {
            return None;
        }

        let mut top_left = POINT {
            x: info.rcCaret.left,
            y: info.rcCaret.top,
        };
        let mut bottom_right = POINT {
            x: info.rcCaret.right,
            y: info.rcCaret.bottom,
        };
        if ClientToScreen(info.hwndCaret, &mut top_left) == 0 {
            return None;
        }
        if ClientToScreen(info.hwndCaret, &mut bottom_right) == 0 {
            return None;
        }

        Some(AnchorRect {
            left: top_left.x as f64,
            top: top_left.y as f64,
            right: bottom_right.x as f64,
            bottom: bottom_right.y as f64,
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn caret_anchor_rect() -> Option<AnchorRect> {
    None
}

fn cursor_anchor_rect(app: &AppHandle) -> Option<AnchorRect> {
    let cursor = app.cursor_position().ok()?;
    Some(AnchorRect {
        left: cursor.x,
        top: cursor.y,
        right: cursor.x,
        bottom: cursor.y,
    })
}

fn monitor_bounds_for_anchor(
    app: &AppHandle,
    win: &tauri::WebviewWindow,
    anchor: AnchorRect,
) -> Option<(f64, f64, f64, f64)> {
    let monitors = app.available_monitors().ok().unwrap_or_default();
    let anchor_x = (anchor.left + anchor.right) / 2.0;
    let anchor_y = (anchor.top + anchor.bottom) / 2.0;

    for monitor in monitors {
        let pos = monitor.position();
        let size = monitor.size();
        let left = pos.x as f64;
        let top = pos.y as f64;
        let right = left + size.width as f64;
        let bottom = top + size.height as f64;
        if anchor_x >= left && anchor_x <= right && anchor_y >= top && anchor_y <= bottom {
            return Some((left, top, right, bottom));
        }
    }

    let monitor = win
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    monitor.map(|monitor| {
        let pos = monitor.position();
        let size = monitor.size();
        (
            pos.x as f64,
            pos.y as f64,
            pos.x as f64 + size.width as f64,
            pos.y as f64 + size.height as f64,
        )
    })
}

fn calculate_suggestion_placement(
    app: &AppHandle,
    win: &tauri::WebviewWindow,
    anchor: AnchorRect,
) -> Option<SuggestionPlacement> {
    let (screen_left, screen_top, screen_right, screen_bottom) =
        monitor_bounds_for_anchor(app, win, anchor)?;
    let screen_mid_y = screen_top + ((screen_bottom - screen_top) / 2.0);
    let anchor_x = (anchor.left + anchor.right) / 2.0;
    let anchor_y = (anchor.top + anchor.bottom) / 2.0;
    let min_x = screen_left + SCREEN_PADDING;
    let max_x = (screen_right - SUGGESTION_WIDTH - SCREEN_PADDING).max(min_x);
    let x = (anchor_x - (SUGGESTION_WIDTH / 2.0)).clamp(min_x, max_x);

    if anchor_y >= screen_mid_y {
        let bottom_limit = anchor.top - SUGGESTION_GAP;
        let top_limit = screen_mid_y.max(screen_top + SCREEN_PADDING);
        let available = (bottom_limit - top_limit).max(SUGGESTION_MIN_HEIGHT);
        let height = available.clamp(SUGGESTION_MIN_HEIGHT, SUGGESTION_MAX_HEIGHT);
        let y = (bottom_limit - height).max(screen_top + SCREEN_PADDING);
        return Some(SuggestionPlacement {
            x,
            y,
            height,
            inverted: true,
        });
    }

    let top_limit = anchor.bottom + SUGGESTION_GAP;
    let upper_zone_limit = screen_top + ((screen_bottom - screen_top) * 0.33);
    let bottom_limit = if anchor_y <= upper_zone_limit {
        screen_mid_y
    } else {
        screen_bottom - SCREEN_PADDING
    };
    let available = (bottom_limit - top_limit).max(SUGGESTION_MIN_HEIGHT);
    let height = available.clamp(SUGGESTION_MIN_HEIGHT, SUGGESTION_MAX_HEIGHT);
    Some(SuggestionPlacement {
        x,
        y: top_limit.min(screen_bottom - height - SCREEN_PADDING),
        height,
        inverted: false,
    })
}

fn position_suggestion_window(win: &tauri::WebviewWindow, app: &AppHandle) -> bool {
    let anchor = caret_anchor_rect().or_else(|| cursor_anchor_rect(app));
    let Some(anchor) = anchor else {
        let _ = win.center();
        return false;
    };

    let Some(placement) = calculate_suggestion_placement(app, win, anchor) else {
        let _ = win.center();
        return false;
    };

    let _ = win.set_size(PhysicalSize::new(
        SUGGESTION_WIDTH.round() as u32,
        placement.height.round() as u32,
    ));
    let _ = win.set_position(PhysicalPosition::new(placement.x, placement.y));
    placement.inverted
}

fn emit_suggestion_payload(
    app: &AppHandle,
    win: &tauri::WebviewWindow,
    payload: serde_json::Value,
) {
    let _ = win.emit("text-expansion-suggestions", payload.clone());
    let _ = app.emit("text-expansion-suggestions", payload.clone());

    let delayed_window = win.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(60));
        let _ = delayed_window.emit("text-expansion-suggestions", payload);
    });
}

fn hide_suggestion_window() {
    if let Some(app) = app_handle() {
        if let Some(win) = app.get_webview_window("suggestions") {
            let _ = win.hide();
        }
    }
}

fn show_suggestion_window(
    raw_query: &str,
    normalized_query: &str,
    suggestions: Vec<text_expansion::TextExpansionSuggestion>,
) {
    let Some(app) = app_handle() else { return; };
    if suggestions.is_empty() {
        hide_suggestion_window();
        return;
    }

    let target = current_target_window();
    if target == 0 {
        hide_suggestion_window();
        return;
    }

    let win = match ensure_suggestion_window(app) {
        Ok(win) => win,
        Err(err) => {
            eprintln!("[QuickPaste] suggestion window failed: {}", err);
            return;
        }
    };

    let inverted = position_suggestion_window(&win, app);
    let payload = serde_json::json!({
        "query": raw_query,
        "normalizedQuery": normalized_query,
        "deleteGraphemes": raw_query.graphemes(true).count(),
        "targetWindow": target,
        "placement": if inverted { "above" } else { "below" },
        "suggestions": suggestions,
    });

    let _ = win.show();
    emit_suggestion_payload(app, &win, payload);
}

fn perform_trigger_expansion(trigger: &str, delete_graphemes: usize) -> Result<(), String> {
    let replacement = text_expansion::resolve_trigger_replacement(trigger)
        .ok_or_else(|| format!("No expansion found for trigger {}", trigger))?;
    let target = LAST_TARGET_HWND.load(Ordering::SeqCst);
    if target == 0 {
        return Err("No active target window available for expansion".to_string());
    }

    SUSPEND_COUNT.fetch_add(1, Ordering::SeqCst);
    thread::spawn(move || {
        let _guard = SuspendGuard;
        let _ = clipboard_manager::restore_focus(target);
        thread::sleep(Duration::from_millis(110));
        unsafe {
            send_backspaces(delete_graphemes);
            thread::sleep(Duration::from_millis(18));
            if needs_clipboard_fallback(&replacement) {
                if paste_via_clipboard(&replacement, None).is_err() {
                    send_unicode_text(&replacement);
                }
            } else {
                send_unicode_text(&replacement);
            }
        }
        hide_suggestion_window();
        if let Ok(mut buffer) = TYPED_BUFFER.try_lock() {
            text_expansion::clear_buffer(&mut buffer);
        }
    });

    Ok(())
}

fn refresh_suggestions(buffer: &str) {
    let Some(raw_query) = active_suggestion_token(buffer) else {
        hide_suggestion_window();
        return;
    };

    let query = normalize_query_key(&raw_query);
    if query.chars().count() < 1 {
        hide_suggestion_window();
        return;
    }

    let suggestions = text_expansion::suggest_matches(&query, 5);
    if suggestions.is_empty() {
        hide_suggestion_window();
        return;
    }

    show_suggestion_window(&raw_query, &query, suggestions);
}

pub fn apply_text_expansion_trigger(trigger: String, delete_graphemes: usize) -> Result<(), String> {
    hide_suggestion_window();
    perform_trigger_expansion(&trigger, delete_graphemes)
}

unsafe extern "system" fn keyboard_hook_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    if code < 0 || !(wparam == WM_KEYDOWN as usize || wparam == WM_SYSKEYDOWN as usize) {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    let info = *(lparam as *const KBDLLHOOKSTRUCT);
    if is_injected(info.flags) || SUSPEND_COUNT.load(Ordering::SeqCst) > 0 {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    let vk = info.vkCode;
    let foreground = clipboard_manager::get_foreground_window();
    if foreground != 0 && !clipboard_manager::is_system_window(foreground) {
        LAST_TARGET_HWND.store(foreground, Ordering::SeqCst);
    }
    let text = map_vk_to_text(vk);
    let ctrl = is_key_down(VK_CONTROL) || is_key_down(VK_LCONTROL) || is_key_down(VK_RCONTROL);
    let alt = is_key_down(VK_MENU) || is_key_down(VK_LMENU) || is_key_down(VK_RMENU);
    let shift = is_key_down(VK_SHIFT) || is_key_down(VK_LSHIFT) || is_key_down(VK_RSHIFT);
    let win = is_key_down(VK_LWIN) || is_key_down(VK_RWIN);

    if is_pure_modifier(vk) {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    let mut buffer = match TYPED_BUFFER.try_lock() {
        Ok(guard) => guard,
        Err(_) => return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam),
    };

    if vk == VK_BACK {
        text_expansion::backspace_buffer(&mut buffer);
        let snapshot = buffer.clone();
        drop(buffer);
        refresh_suggestions(&snapshot);
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    if ctrl || alt || win {
        text_expansion::clear_buffer(&mut buffer);
        drop(buffer);
        hide_suggestion_window();
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    if let Some(terminator) = classify_terminator(vk, text.as_deref()) {
        let buffer_snapshot = buffer.clone();
        let punctuation_text = match &terminator {
            TerminatorKind::Punctuation(value) => Some(value.clone()),
            _ => None,
        };
        drop(buffer);

        if let Some(matched) = text_expansion::evaluate_match(&buffer_snapshot, &terminator) {
            if let Ok(mut live_buffer) = TYPED_BUFFER.try_lock() {
                text_expansion::clear_buffer(&mut live_buffer);
            }
            hide_suggestion_window();
            trigger_expansion(matched);
            return 1;
        }

        if let Ok(mut live_buffer) = TYPED_BUFFER.try_lock() {
            if let Some(value) = punctuation_text.as_deref() {
                text_expansion::append_text(&mut live_buffer, value);
            } else {
                text_expansion::clear_buffer(&mut live_buffer);
            }
        }
        hide_suggestion_window();
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    if let Some(text) = text {
        if !text.is_empty() {
            text_expansion::append_text(&mut buffer, &text);
            let snapshot = buffer.clone();
            drop(buffer);
            refresh_suggestions(&snapshot);
            return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
        }
        drop(buffer);
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    if vk == VK_ESCAPE {
        text_expansion::clear_buffer(&mut buffer);
    } else if is_navigation_key(vk) {
        text_expansion::clear_buffer(&mut buffer);
    } else if shift {
        // Shift alone should not poison the trigger buffer.
    } else {
        text_expansion::clear_buffer(&mut buffer);
    }
    hide_suggestion_window();

    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

fn trigger_expansion(matched: text_expansion::ExpansionMatch) {
    SUSPEND_COUNT.fetch_add(1, Ordering::SeqCst);
    println!(
        "[QuickPaste] Text expansion matched trigger={} replacement_len={}",
        matched.trigger,
        matched.replacement.chars().count()
    );

    thread::spawn(move || {
        let _guard = SuspendGuard;
        thread::sleep(Duration::from_millis(18));

        unsafe {
            send_backspaces(matched.delete_graphemes);
            thread::sleep(Duration::from_millis(25));
        }

        if needs_clipboard_fallback(&matched.replacement) {
            if paste_via_clipboard(&matched.replacement, matched.suffix.as_deref()).is_err() {
                unsafe {
                    send_unicode_text(&matched.replacement);
                    if let Some(suffix) = matched.suffix.as_deref() {
                        send_unicode_text(suffix);
                    }
                }
            }
        } else {
            unsafe {
                send_unicode_text(&matched.replacement);
                if let Some(suffix) = matched.suffix.as_deref() {
                    send_unicode_text(suffix);
                }
            }
        }

    });
}

fn needs_clipboard_fallback(text: &str) -> bool {
    text.contains('\n') || text.contains('\r') || text.contains('\t') || text.chars().count() > 96
}

fn paste_via_clipboard(replacement: &str, suffix: Option<&str>) -> Result<(), String> {
    let previous_clipboard = match clipboard_manager::capture_clipboard_snapshot() {
        Some(snapshot) => snapshot,
        None => {
            return Err("failed to capture clipboard snapshot".to_string());
        }
    };
    clipboard_monitor::suppress_updates_for(Duration::from_millis(1500));
    set_clipboard_text_with_retry(replacement)?;

    unsafe {
        thread::sleep(Duration::from_millis(30));
        send_ctrl_v();
    }

    if let Some(suffix_text) = suffix {
        unsafe {
            thread::sleep(Duration::from_millis(15));
            send_unicode_text(suffix_text);
        }
    }

    // Give the target app time to consume the clipboard before restoring it.
    thread::sleep(Duration::from_millis(180));
    if let Err(err) = clipboard_manager::restore_clipboard_snapshot(&previous_clipboard) {
        eprintln!("[QuickPaste] clipboard restore failed after expansion: {}", err);
    }

    Ok(())
}

fn set_clipboard_text_with_retry(content: &str) -> Result<(), String> {
    let mut wait_ms = 10u64;
    for attempt in 1..=6 {
        match arboard::Clipboard::new() {
            Ok(mut ctx) => match ctx.set_text(content.to_string()) {
                Ok(_) => return Ok(()),
                Err(err) => {
                    eprintln!("[QuickPaste] set_clipboard_text_with_retry failed on attempt {}: {}", attempt, err);
                }
            },
            Err(err) => {
                eprintln!("[QuickPaste] clipboard init failed on attempt {}: {}", attempt, err);
            }
        }
        thread::sleep(Duration::from_millis(wait_ms));
        wait_ms = (wait_ms * 2).min(400);
    }
    Err("failed to write clipboard text".to_string())
}

fn classify_terminator(vk: u32, text: Option<&str>) -> Option<TerminatorKind> {
    match vk {
        VK_RETURN => Some(TerminatorKind::Enter),
        VK_TAB => Some(TerminatorKind::Tab),
        VK_SPACE => Some(TerminatorKind::Space),
        _ => {
            let text = text?;
            if text == " " {
                return Some(TerminatorKind::Space);
            }
            if text.chars().count() == 1 {
                let ch = text.chars().next().unwrap_or_default();
                if !ch.is_alphanumeric() && !ch.is_whitespace() {
                    return Some(TerminatorKind::Punctuation(text.to_string()));
                }
            }
            None
        }
    }
}

fn is_navigation_key(vk: u32) -> bool {
    matches!(
        vk,
        0x21 | // Page Up
        0x22 | // Page Down
        0x23 | // End
        0x24 | // Home
        0x25 | // Left
        0x26 | // Up
        0x27 | // Right
        0x28 | // Down
        0x2D | // Insert
        0x2E | // Delete
        0x5D    // Menu / context key
    )
}

fn is_pure_modifier(vk: u32) -> bool {
    matches!(vk, VK_SHIFT | VK_CONTROL | VK_MENU | VK_LSHIFT | VK_RSHIFT | VK_LCONTROL | VK_RCONTROL | VK_LMENU | VK_RMENU | VK_LWIN | VK_RWIN)
}

fn is_key_down(vk: u32) -> bool {
    unsafe { GetKeyState(vk as i32) < 0 }
}

fn is_injected(flags: u32) -> bool {
    flags & LLKHF_INJECTED != 0 || flags & LLKHF_LOWER_IL_INJECTED != 0
}

fn map_vk_to_text(vk: u32) -> Option<String> {
    if is_pure_modifier(vk) || vk == VK_BACK || vk == VK_ESCAPE {
        return None;
    }

    unsafe {
        let mut keyboard_state = [0u8; 256];
        if GetKeyboardState(keyboard_state.as_mut_ptr()) == 0 {
            return None;
        }

        if is_key_down(VK_SHIFT) {
            keyboard_state[VK_SHIFT as usize] = 0x80;
        }
        if is_key_down(VK_CONTROL) {
            keyboard_state[VK_CONTROL as usize] = 0x80;
        }
        if is_key_down(VK_MENU) {
            keyboard_state[VK_MENU as usize] = 0x80;
        }
        if is_key_down(0x14) {
            keyboard_state[0x14] = 0x01;
        }

        let scan_code = MapVirtualKeyW(vk, MAPVK_VK_TO_VSC);
        let mut buffer = [0u16; 8];
        let result = ToUnicode(
            vk,
            scan_code,
            keyboard_state.as_ptr(),
            buffer.as_mut_ptr(),
            buffer.len() as i32,
            0,
        );

        if result > 0 {
            Some(String::from_utf16_lossy(&buffer[..result as usize]))
        } else {
            None
        }
    }
}

unsafe fn make_keyboard_input(vk: u16, flags: u32) -> INPUT {
    let mut input = std::mem::zeroed::<INPUT>();
    input.r#type = INPUT_KEYBOARD;
    input.Anonymous.ki = KEYBDINPUT {
        wVk: vk,
        wScan: 0,
        dwFlags: flags,
        time: 0,
        dwExtraInfo: 0,
    };
    input
}

unsafe fn make_unicode_input(code_unit: u16, flags: u32) -> INPUT {
    let mut input = std::mem::zeroed::<INPUT>();
    input.r#type = INPUT_KEYBOARD;
    input.Anonymous.ki = KEYBDINPUT {
        wVk: 0,
        wScan: code_unit,
        dwFlags: flags,
        time: 0,
        dwExtraInfo: 0,
    };
    input
}

unsafe fn send_backspaces(count: usize) {
    for _ in 0..count {
        let down = make_keyboard_input(VK_BACK as u16, 0);
        let up = make_keyboard_input(VK_BACK as u16, 0x0002);
        let inputs = [down, up];
        let injected = SendInput(2, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
        if injected == 0 {
            eprintln!("[QuickPaste] send_backspaces: SendInput failed");
        }
        thread::sleep(Duration::from_millis(4));
    }
}

unsafe fn send_unicode_text(text: &str) {
    for unit in text.encode_utf16() {
        let down = make_unicode_input(unit, 0x0004);
        let up = make_unicode_input(unit, 0x0004 | 0x0002);
        let inputs = [down, up];
        let injected = SendInput(2, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
        if injected == 0 {
            eprintln!("[QuickPaste] send_unicode_text: SendInput failed");
        }
    }
}

unsafe fn send_ctrl_v() {
    let ctrl_down = make_keyboard_input(0x11, 0);
    let v_down = make_keyboard_input(0x56, 0);
    let inputs_down = [ctrl_down, v_down];
    let injected_down = SendInput(2, inputs_down.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    if injected_down == 0 {
        eprintln!("[QuickPaste] send_ctrl_v: SendInput failed (down)");
    }

    thread::sleep(Duration::from_millis(12));

    let v_up = make_keyboard_input(0x56, 0x0002);
    let ctrl_up = make_keyboard_input(0x11, 0x0002);
    let inputs_up = [v_up, ctrl_up];
    let injected_up = SendInput(2, inputs_up.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    if injected_up == 0 {
        eprintln!("[QuickPaste] send_ctrl_v: SendInput failed (up)");
    }
}
