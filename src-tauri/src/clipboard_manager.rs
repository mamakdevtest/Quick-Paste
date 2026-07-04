use std::thread;
use std::time::Duration;

#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Threading::{GetCurrentThreadId, AttachThreadInput};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetWindowThreadProcessId, SetForegroundWindow, BringWindowToTop, GetForegroundWindow,
    ShowWindow, SW_RESTORE, IsIconic, GetClassNameW
};

#[cfg(target_os = "windows")]
pub fn get_foreground_window() -> isize {
    unsafe {
        GetForegroundWindow() as isize
    }
}

#[cfg(target_os = "windows")]
pub fn is_system_window(hwnd_val: isize) -> bool {
    if hwnd_val == 0 {
        return true;
    }
    let hwnd = hwnd_val as windows_sys::Win32::Foundation::HWND;
    let mut class_name = [0u16; 256];
    let len = unsafe {
        GetClassNameW(hwnd, class_name.as_mut_ptr(), 256)
    };
    if len > 0 {
        let name = String::from_utf16_lossy(&class_name[..len as usize]);
        if name == "Shell_TrayWnd" || name == "NotifyIconOverflowWindow" || name == "WorkerW" || name == "Progman" {
            return true;
        }
    }
    false
}

#[cfg(target_os = "windows")]
pub fn get_active_process_name() -> String {
    use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows_sys::Win32::Foundation::CloseHandle;

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return "Unknown".to_string();
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return "Unknown".to_string();
        }
        
        let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process_handle.is_null() {
            return "Unknown".to_string();
        }
        
        let mut buffer = [0u16; 512];
        let mut size = buffer.len() as u32;
        let success = QueryFullProcessImageNameW(process_handle, 0, buffer.as_mut_ptr(), &mut size);
        CloseHandle(process_handle);
        
        if success != 0 {
            let path = String::from_utf16_lossy(&buffer[..size as usize]);
            if let Some(filename) = path.split('\\').next_back() {
                return filename.to_string();
            }
        }
        "Unknown".to_string()
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_foreground_window() -> isize {
    let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok() || 
                     std::env::var("XDG_SESSION_TYPE").map(|v| v.to_lowercase()).unwrap_or_default() == "wayland";
    if is_wayland {
        return 1; // dummy window handle to bypass target != 0 checks
    }

    // Linux active window capture via xdotool
    use std::process::Command;
    if let Ok(output) = Command::new("xdotool").arg("getactivewindow").output() {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return s.parse::<isize>().unwrap_or(0);
        }
    }
    0
}

#[cfg(not(target_os = "windows"))]
pub fn is_system_window(_hwnd_val: isize) -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
pub fn get_active_process_name() -> String {
    "Unknown".to_string()
}

#[cfg(target_os = "windows")]
pub fn restore_focus_and_paste(hwnd_val: isize) -> bool {
    if hwnd_val == 0 {
        return false;
    }
    let hwnd = hwnd_val as windows_sys::Win32::Foundation::HWND;
    unsafe {
        // Step 1: Release stuck modifiers first
        release_all_modifiers();
        thread::sleep(Duration::from_millis(50));

        // Step 2: Attach thread inputs to allow SetFocus and synchronised inputs
        let current_thread = GetCurrentThreadId();
        let target_thread = GetWindowThreadProcessId(hwnd, std::ptr::null_mut());

        let mut attached = false;
        if current_thread != target_thread {
            if AttachThreadInput(current_thread, target_thread, 1) == 0 {
                eprintln!("[QuickPaste] restore_focus_and_paste: AttachThreadInput failed");
            } else {
                attached = true;
            }
        }

        // Restore window if minimized
        if IsIconic(hwnd) != 0 {
            ShowWindow(hwnd, SW_RESTORE);
            thread::sleep(Duration::from_millis(50));
        }

        // Try to bring to foreground with retries
        let mut success_fg = false;
        for _ in 0..3 {
            SetForegroundWindow(hwnd);
            BringWindowToTop(hwnd);
            thread::sleep(Duration::from_millis(100));
            if GetForegroundWindow() == hwnd {
                success_fg = true;
                break;
            }
        }

        if !success_fg {
            eprintln!("[QuickPaste] restore_focus_and_paste: couldn't bring hwnd to foreground");
        }

        // Step 3: Wait for focus to settle while attached
        thread::sleep(Duration::from_millis(150));

        // Step 4: Inject Ctrl+V
        let paste_ok = send_ctrl_v();

        // Step 5: Clean up and detach thread input
        if attached {
            AttachThreadInput(current_thread, target_thread, 0);
        }

        paste_ok
    }
}

#[cfg(not(target_os = "windows"))]
pub fn restore_focus_and_paste(window_id_val: isize) -> bool {
    use std::process::Command;
    let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok() || 
                     std::env::var("XDG_SESSION_TYPE").map(|v| v.to_lowercase()).unwrap_or_default() == "wayland";

    if is_wayland {
        // Under Wayland, we sleep briefly to let the focus return to the target window
        thread::sleep(Duration::from_millis(150));
        // Use wtype to simulate Ctrl+V
        if let Ok(status) = Command::new("wtype").args(&["-M", "ctrl", "v", "-m", "ctrl"]).status() {
            if status.success() { return true; }
        }
        // Try ydotool as fallback (29 is Ctrl, 47 is V)
        if let Ok(status) = Command::new("ydotool").args(&["key", "29:1", "47:1", "47:0", "29:0"]).status() {
            return status.success();
        }
        return false;
    } else {
        if window_id_val == 0 {
            return false;
        }
        let _ = Command::new("xdotool")
            .args(&["keyup", "alt", "ctrl", "shift"])
            .status();
        thread::sleep(Duration::from_millis(50));

        let window_str = window_id_val.to_string();
        if let Ok(status) = Command::new("xdotool")
            .args(&["windowactivate", "--sync", &window_str])
            .status() {
            thread::sleep(Duration::from_millis(120));
            if let Ok(status2) = Command::new("xdotool")
                .args(&["key", "ctrl+v"]) 
                .status() {
                return status2.success();
            }
        }
        false
    }
}

#[cfg(target_os = "windows")]
unsafe fn release_all_modifiers() {
    let keys = vec![
        0x12, // VK_MENU
        0xA4, // VK_LMENU
        0xA5, // VK_RMENU
        0x11, // VK_CONTROL
        0xA2, // VK_LCONTROL
        0xA3, // VK_RCONTROL
        0x10, // VK_SHIFT
        0xA0, // VK_LSHIFT
        0xA1, // VK_RSHIFT
    ];

    for vk in keys {
        let mut input = std::mem::zeroed::<INPUT>();
        input.r#type = INPUT_KEYBOARD;
        input.Anonymous.ki = KEYBDINPUT {
            wVk: vk,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };
        let injected = SendInput(1, &input, std::mem::size_of::<INPUT>() as i32);
        if injected == 0 {
            eprintln!("[QuickPaste] release_all_modifiers: SendInput failed for vk=0x{:X}", vk);
        }
    }
}

#[cfg(target_os = "windows")]
unsafe fn send_ctrl_v() -> bool {
    let ctrl_down = make_keyboard_input(0x11, 0); // VK_CONTROL
    let v_down = make_keyboard_input(0x56, 0);    // V key
    let inputs_down = [ctrl_down, v_down];
    let injected_down = SendInput(2, inputs_down.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    let mut ok = true;
    if injected_down == 0 {
        eprintln!("[QuickPaste] clipboard_manager::send_ctrl_v: SendInput failed (down)");
        ok = false;
    }

    thread::sleep(Duration::from_millis(15));

    let v_up = make_keyboard_input(0x56, KEYEVENTF_KEYUP);
    let ctrl_up = make_keyboard_input(0x11, KEYEVENTF_KEYUP);
    let inputs_up = [v_up, ctrl_up];
    let injected_up = SendInput(2, inputs_up.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    if injected_up == 0 {
        eprintln!("[QuickPaste] clipboard_manager::send_ctrl_v: SendInput failed (up)");
        ok = false;
    }
    ok
}

#[cfg(target_os = "windows")]
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
