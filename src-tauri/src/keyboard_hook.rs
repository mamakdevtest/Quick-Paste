use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, UnhookWindowsHookEx, CallNextHookEx, WH_KEYBOARD_LL, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_SYSKEYDOWN
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT
};

// Global list of active triggers: (trigger_phrase, snippet_content)
static ACTIVE_TRIGGERS: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());

// Buffer to store recently typed characters
static TYPED_BUFFER: Mutex<String> = Mutex::new(String::new());

// Flag to temporarily disable hook processing during backspacing/pasting
static SUSPEND_HOOK: AtomicBool = AtomicBool::new(false);

pub fn update_triggers(list: Vec<(String, String)>) {
    if let Ok(mut active) = ACTIVE_TRIGGERS.lock() {
        *active = list;
    }
}

pub fn start_keyboard_hook() {
    thread::spawn(|| {
        unsafe {
            let hook = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(keyboard_hook_proc),
                std::ptr::null_mut(),
                0
            );
            if hook == std::ptr::null_mut() {
                println!("[QuickPaste] Hook installation failed");
                return;
            }
            
            println!("[QuickPaste] Low-level keyboard hook installed");
            
            // Win32 message loop
            use windows_sys::Win32::UI::WindowsAndMessaging::{GetMessageW, MSG};
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                // message dispatch loop
            }
            
            UnhookWindowsHookEx(hook);
        }
    });
}

unsafe extern "system" fn keyboard_hook_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    if code >= 0 && !SUSPEND_HOOK.load(Ordering::SeqCst) {
        if wparam == WM_KEYDOWN as usize || wparam == WM_SYSKEYDOWN as usize {
            let info = *(lparam as *const KBDLLHOOKSTRUCT);
            let vk = info.vkCode;
            
            // Check shift state (VK_SHIFT = 0x10)
            let shift = GetKeyState(0x10) < 0;
            
            let c = map_vk_to_char(vk, shift);
            if let Some(ch) = c {
                let mut buf = TYPED_BUFFER.lock().unwrap();
                buf.push(ch);
                
                // Limit buffer length to prevent infinite growth
                if buf.len() > 30 {
                    buf.remove(0);
                }
                
                // Check if buffer ends with any trigger phrase
                let mut matched_trigger = None;
                let mut matched_content = String::new();
                
                if let Ok(triggers) = ACTIVE_TRIGGERS.lock() {
                    for (trigger, content) in triggers.iter() {
                        if buf.ends_with(trigger) {
                            matched_trigger = Some(trigger.clone());
                            matched_content = content.clone();
                            break;
                        }
                    }
                }
                
                if let Some(trigger) = matched_trigger {
                    // Suspend hook to prevent self-capturing simulated inputs
                    SUSPEND_HOOK.store(true, Ordering::SeqCst);
                    
                    // Clear buffer
                    buf.clear();
                    drop(buf); // unlock buffer before thread sleep and paste
                    
                    // Execute backspacing and pasting on a separate thread to prevent hook lagging
                    thread::spawn(move || {
                        thread::sleep(Duration::from_millis(15));
                        unsafe {
                            // 1. Send backspaces to delete trigger phrase
                            send_backspaces(trigger.len());
                            thread::sleep(Duration::from_millis(50));
                            
                            // 2. Write to clipboard and paste
                            let mut success = false;
                            for _ in 0..5 {
                                if let Ok(mut ctx) = arboard::Clipboard::new() {
                                    if ctx.set_text(matched_content.clone()).is_ok() {
                                        success = true;
                                        break;
                                    }
                                }
                                thread::sleep(Duration::from_millis(15));
                            }
                            
                            if success {
                                thread::sleep(Duration::from_millis(50));
                                send_ctrl_v();
                            }
                            
                            // 3. Resume hook
                            SUSPEND_HOOK.store(false, Ordering::SeqCst);
                        }
                    });
                    
                    return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
                }
            } else {
                // Buffer clearing logic on separator/control keys
                if vk == 0x08 { // VK_BACK (Backspace)
                    let mut buf = TYPED_BUFFER.lock().unwrap();
                    buf.pop();
                } else if vk == 0x0D || vk == 0x1B || vk == 0x09 { // Enter, Escape, Tab
                    TYPED_BUFFER.lock().unwrap().clear();
                } else if vk >= 0x10 && vk <= 0x12 { // Shift, Ctrl, Alt (modifier keys alone should be ignored)
                    // ignore
                } else {
                    // For other non-character control keys, clear the buffer
                    TYPED_BUFFER.lock().unwrap().clear();
                }
            }
        }
    }
    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

fn map_vk_to_char(vk: u32, shift: bool) -> Option<char> {
    match vk {
        // Numbers
        0x30 => Some(if shift { '=' } else { '0' }),
        0x31 => Some(if shift { '!' } else { '1' }),
        0x32 => Some(if shift { '\'' } else { '2' }),
        0x33 => Some(if shift { '^' } else { '3' }),
        0x34 => Some(if shift { '+' } else { '4' }),
        0x35 => Some(if shift { '%' } else { '5' }),
        0x36 => Some(if shift { '&' } else { '6' }),
        0x37 => Some(if shift { '/' } else { '7' }),
        0x38 => Some(if shift { '(' } else { '8' }),
        0x39 => Some(if shift { ')' } else { '9' }),
        
        // Letters (convert to lowercase for triggers)
        0x41..=0x5A => {
            let base = if shift { 'A' } else { 'a' };
            Some(std::char::from_u32((vk - 0x41) + (base as u32)).unwrap())
        }
        
        // Space
        0x20 => Some(' '),
        
        // Common Punctuation
        0xBE => Some(if shift { ':' } else { '.' }), // Period / Colon
        0xBC => Some(if shift { ';' } else { ',' }), // Comma / Semicolon
        0xBD => Some(if shift { '_' } else { '-' }), // Dash / Underscore
        0xBF => Some(if shift { '?' } else { '/' }), // Slash / Question Mark
        0xDC => Some(if shift { '|' } else { '\\' }), // Backslash / Pipe
        
        // Turkish Layout Specifics (Turkish Q)
        0xBA => Some(if shift { 'Ş' } else { 'ş' }), // Ş key
        0xDB => Some(if shift { 'Ğ' } else { 'ğ' }), // Ğ key
        0xDD => Some(if shift { 'İ' } else { 'ı' }), // İ/ı key
        0xDE => Some(if shift { 'Ç' } else { 'ç' }), // Ç key
        0xC0 => Some(if shift { 'Ü' } else { 'ü' }), // Ü key
        0xBB => Some(if shift { '*' } else { '+' }), // Plus key
        
        _ => None,
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

unsafe fn send_backspaces(count: usize) {
    for _ in 0..count {
        let bs_down = make_keyboard_input(0x08, 0); // VK_BACK
        let bs_up = make_keyboard_input(0x08, 0x0002); // KEYEVENTF_KEYUP
        let inputs = [bs_down, bs_up];
        SendInput(2, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
        thread::sleep(Duration::from_millis(5));
    }
}

unsafe fn send_ctrl_v() {
    let ctrl_down = make_keyboard_input(0x11, 0); // VK_CONTROL
    let v_down = make_keyboard_input(0x56, 0);    // V key
    let inputs_down = [ctrl_down, v_down];
    SendInput(2, inputs_down.as_ptr(), std::mem::size_of::<INPUT>() as i32);

    thread::sleep(Duration::from_millis(15));

    let v_up = make_keyboard_input(0x56, 0x0002); // KEYEVENTF_KEYUP
    let ctrl_up = make_keyboard_input(0x11, 0x0002); // KEYEVENTF_KEYUP
    let inputs_up = [v_up, ctrl_up];
    SendInput(2, inputs_up.as_ptr(), std::mem::size_of::<INPUT>() as i32);
}
