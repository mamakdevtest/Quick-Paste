use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::thread;
use std::time::Duration;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, UnhookWindowsHookEx, CallNextHookEx, WH_KEYBOARD_LL, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_SYSKEYDOWN
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT,
    GetKeyboardState, ToUnicode, MapVirtualKeyW, MAPVK_VK_TO_VSC
};

// Global list of active triggers: (trigger_phrase, snippet_content)
static ACTIVE_TRIGGERS: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());

// Suspend counter to allow nested suspends during injection
static SUSPEND_COUNT: AtomicUsize = AtomicUsize::new(0);

enum HookEvent {
    KeyDown { vk: u32, shift: bool },
}

static EVENT_SENDER: Mutex<Option<Sender<HookEvent>>> = Mutex::new(None);

pub fn update_triggers(list: Vec<(String, String)>) {
    if let Ok(mut active) = ACTIVE_TRIGGERS.lock() {
        *active = list;
    }
}

pub fn start_keyboard_hook() {
    let (tx, rx) = channel::<HookEvent>();
    if let Ok(mut sender_guard) = EVENT_SENDER.lock() {
        *sender_guard = Some(tx);
    }

    // Spawn the worker thread that processes hook events asynchronously
    thread::spawn(move || {
        let mut typed_buffer = String::new();
        while let Ok(event) = rx.recv() {
            match event {
                HookEvent::KeyDown { vk, shift } => {
                    let c = map_vk_to_char(vk, shift);
                    if let Some(ch) = c {
                        typed_buffer.push(ch);
                        
                        // Limit buffer length
                        if typed_buffer.len() > 30 {
                            typed_buffer.remove(0);
                        }
                        
                        let mut matched_trigger = None;
                        let mut matched_content = String::new();
                        
                        if let Ok(triggers) = ACTIVE_TRIGGERS.lock() {
                            for (trigger, content) in triggers.iter() {
                                if typed_buffer.ends_with(trigger) {
                                    matched_trigger = Some(trigger.clone());
                                    matched_content = content.clone();
                                    break;
                                }
                            }
                        }
                        
                        if let Some(trigger) = matched_trigger {
                                                    SUSPEND_COUNT.fetch_add(1, Ordering::SeqCst);
                            typed_buffer.clear();
                            
                            let trigger_len = trigger.len();
                            let matched_content_clone = matched_content;
                            
                            thread::spawn(move || {
                                thread::sleep(Duration::from_millis(15));
                                unsafe {
                                    // 1. Send backspaces to delete trigger phrase
                                    send_backspaces(trigger_len);
                                    thread::sleep(Duration::from_millis(50));
                                    
                                    // 2. Write to clipboard and paste
                                    let mut success = false;
                                    for _ in 0..5 {
                                        if let Ok(mut ctx) = arboard::Clipboard::new() {
                                            if ctx.set_text(matched_content_clone.clone()).is_ok() {
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
                                                            SUSPEND_COUNT.fetch_sub(1, Ordering::SeqCst);
                                }
                            });
                        }
                    } else {
                        // Buffer clearing logic on separator/control keys
                        if vk == 0x08 { // VK_BACK (Backspace)
                            typed_buffer.pop();
                        } else if vk == 0x0D || vk == 0x1B || vk == 0x09 { // Enter, Escape, Tab
                            typed_buffer.clear();
                        } else if (0x10..=0x12).contains(&vk) { // Shift, Ctrl, Alt
                            // ignore modifier keys alone
                        } else {
                            typed_buffer.clear();
                        }
                    }
                }
            }
        }
    });

    // Spawn the low-level hook Win32 message loop thread
    thread::spawn(|| {
        unsafe {
            let hook = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(keyboard_hook_proc),
                std::ptr::null_mut(),
                0
            );
            if hook.is_null() {
                println!("[QuickPaste] Hook installation failed");
                return;
            }
            
            println!("[QuickPaste] Low-level keyboard hook installed");
            
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
    if code >= 0 && SUSPEND_COUNT.load(Ordering::SeqCst) == 0
        && (wparam == WM_KEYDOWN as usize || wparam == WM_SYSKEYDOWN as usize) {
        let info = *(lparam as *const KBDLLHOOKSTRUCT);
        let vk = info.vkCode;
        let shift = GetKeyState(0x10) < 0;
        
        if let Ok(sender_guard) = EVENT_SENDER.lock() {
            if let Some(ref sender) = *sender_guard {
                let _ = sender.send(HookEvent::KeyDown { vk, shift });
            }
        }
    }
    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

fn map_vk_to_char(vk: u32, _shift: bool) -> Option<char> {
    // Filter out known non-printable/control keys to avoid unnecessary ToUnicode calls
    const CONTROL_KEYS: [u32; 7] = [0x08, 0x09, 0x0D, 0x10, 0x11, 0x12, 0x1B];
    if CONTROL_KEYS.contains(&vk) {
        return None;
    }

    unsafe {
        let mut keyboard_state = [0u8; 256];
        GetKeyboardState(keyboard_state.as_mut_ptr());

        // Low-level hooks run before keyboard state is updated, so manually query Shift/Caps
        if GetKeyState(0x10) < 0 { // VK_SHIFT
            keyboard_state[0x10] = 0x80;
        }
        if GetKeyState(0x14) & 1 != 0 { // VK_CAPITAL (Caps Lock)
            keyboard_state[0x14] = 0x01;
        }

        let scan_code = MapVirtualKeyW(vk, MAPVK_VK_TO_VSC);
        let mut buffer = [0u16; 4];
        
        let result = ToUnicode(
            vk,
            scan_code,
            keyboard_state.as_ptr(),
            buffer.as_mut_ptr(),
            buffer.len() as i32,
            0
        );

        if result > 0 {
            std::char::decode_utf16(buffer[..result as usize].iter().copied())
                .next()
                .and_then(|r| r.ok())
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

unsafe fn send_backspaces(count: usize) {
    for _ in 0..count {
        let bs_down = make_keyboard_input(0x08, 0); // VK_BACK
        let bs_up = make_keyboard_input(0x08, 0x0002); // KEYEVENTF_KEYUP
        let inputs = [bs_down, bs_up];
        let injected = SendInput(2, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
        if injected == 0 {
            eprintln!("[QuickPaste] send_backspaces: SendInput failed for VK_BACK");
        }
        thread::sleep(Duration::from_millis(5));
    }
}

unsafe fn send_ctrl_v() {
    let ctrl_down = make_keyboard_input(0x11, 0); // VK_CONTROL
    let v_down = make_keyboard_input(0x56, 0);    // V key
    let inputs_down = [ctrl_down, v_down];
    let injected_down = SendInput(2, inputs_down.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    if injected_down == 0 {
        eprintln!("[QuickPaste] send_ctrl_v: SendInput failed to inject ctrl+v down");
    }

    thread::sleep(Duration::from_millis(15));

    let v_up = make_keyboard_input(0x56, 0x0002); // KEYEVENTF_KEYUP
    let ctrl_up = make_keyboard_input(0x11, 0x0002); // KEYEVENTF_KEYUP
    let inputs_up = [v_up, ctrl_up];
    let injected_up = SendInput(2, inputs_up.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    if injected_up == 0 {
        eprintln!("[QuickPaste] send_ctrl_v: SendInput failed to inject ctrl+v up");
    }
}
