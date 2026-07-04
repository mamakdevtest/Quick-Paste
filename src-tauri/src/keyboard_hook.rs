use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, GetKeyboardState, MapVirtualKeyW, SendInput, ToUnicode, INPUT, INPUT_KEYBOARD,
    KEYBDINPUT, MAPVK_VK_TO_VSC,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, WH_KEYBOARD_LL,
    KBDLLHOOKSTRUCT, MSG, WM_KEYDOWN, WM_SYSKEYDOWN,
};

use crate::text_expansion::{self, TerminatorKind};

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

static SUSPEND_COUNT: AtomicUsize = AtomicUsize::new(0);
static TYPED_BUFFER: Mutex<String> = Mutex::new(String::new());

struct SuspendGuard;

impl Drop for SuspendGuard {
    fn drop(&mut self) {
        SUSPEND_COUNT.fetch_sub(1, Ordering::SeqCst);
    }
}

pub fn start_keyboard_hook() {
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

unsafe extern "system" fn keyboard_hook_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    if code < 0 || !(wparam == WM_KEYDOWN as usize || wparam == WM_SYSKEYDOWN as usize) {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    let info = *(lparam as *const KBDLLHOOKSTRUCT);
    if is_injected(info.flags) || SUSPEND_COUNT.load(Ordering::SeqCst) > 0 {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    let vk = info.vkCode;
    let text = map_vk_to_text(vk);
    let ctrl = is_key_down(VK_CONTROL) || is_key_down(VK_LCONTROL) || is_key_down(VK_RCONTROL);
    let alt = is_key_down(VK_MENU) || is_key_down(VK_LMENU) || is_key_down(VK_RMENU);
    let shift = is_key_down(VK_SHIFT) || is_key_down(VK_LSHIFT) || is_key_down(VK_RSHIFT);
    let win = is_key_down(VK_LWIN) || is_key_down(VK_RWIN);

    if is_pure_modifier(vk) {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    let mut buffer = TYPED_BUFFER.lock().unwrap_or_else(|e| e.into_inner());

    if vk == VK_BACK {
        text_expansion::backspace_buffer(&mut buffer);
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    if ctrl || alt || win {
        text_expansion::clear_buffer(&mut buffer);
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
            if let Ok(mut live_buffer) = TYPED_BUFFER.lock() {
                text_expansion::clear_buffer(&mut live_buffer);
            }
            trigger_expansion(matched);
            return 1;
        }

        if let Ok(mut live_buffer) = TYPED_BUFFER.lock() {
            if let Some(value) = punctuation_text.as_deref() {
                text_expansion::append_text(&mut live_buffer, value);
            } else {
                text_expansion::clear_buffer(&mut live_buffer);
            }
        }
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    if let Some(text) = text {
        if !text.is_empty() {
            text_expansion::append_text(&mut buffer, &text);
        }
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
    let previous_clipboard = read_clipboard_text();
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

    thread::sleep(Duration::from_millis(70));
    if let Some(previous) = previous_clipboard {
        let _ = set_clipboard_text_with_retry(&previous);
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

fn read_clipboard_text() -> Option<String> {
    let mut ctx = arboard::Clipboard::new().ok()?;
    ctx.get_text().ok()
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
