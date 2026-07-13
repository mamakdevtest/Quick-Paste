use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(serde::Serialize, Clone)]
struct ClipboardPayload {
    text: String,
    source_app: String,
}

static MONITOR_SUPPRESS_UNTIL_MS: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn clipboard_updates_suppressed() -> bool {
    now_ms() < MONITOR_SUPPRESS_UNTIL_MS.load(Ordering::SeqCst)
}

pub fn suppress_updates_for(duration: Duration) {
    let until = now_ms().saturating_add(duration.as_millis() as u64);
    MONITOR_SUPPRESS_UNTIL_MS.store(until, Ordering::SeqCst);
}

fn is_password_manager(proc_name: &str) -> bool {
    let lower = proc_name.to_lowercase();
    lower.contains("1password")
        || lower.contains("bitwarden")
        || lower.contains("keepass")
        || lower.contains("dashlane")
        || lower.contains("enpass")
        || lower.contains("keeper")
}

fn process_new_clipboard_text(app_handle: &AppHandle, last_text: &Mutex<String>) {
    if clipboard_updates_suppressed() {
        return;
    }

    if let Some(current) = crate::clipboard_manager::read_clipboard_text_with_retry(5, 12) {
        let trimmed = current.trim();
        if !trimmed.is_empty() {
            if let Ok(mut last) = last_text.lock() {
                if current != *last {
                    let proc_name = crate::clipboard_manager::get_active_process_name();
                    if !is_password_manager(&proc_name) {
                        *last = current.clone();
                        let payload = ClipboardPayload {
                            text: current,
                            source_app: proc_name,
                        };
                        let _ = app_handle.emit("new-clipboard-entry", payload);
                    }
                }
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Windows Specific native clipboard listener using AddClipboardFormatListener
// ──────────────────────────────────────────────────────────────────────────────
#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn AddClipboardFormatListener(hwnd: isize) -> i32;
    fn RemoveClipboardFormatListener(hwnd: isize) -> i32;
}

#[cfg(target_os = "windows")]
static MONITOR_APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);
#[cfg(target_os = "windows")]
static MONITOR_HWND: Mutex<isize> = Mutex::new(0);
#[cfg(target_os = "windows")]
static MONITOR_LAST_TEXT: Mutex<String> = Mutex::new(String::new());

#[cfg(target_os = "windows")]
unsafe extern "system" fn clipboard_wnd_proc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: usize,
    lparam: isize,
) -> isize {
    const WM_CLIPBOARDUPDATE: u32 = 0x031D;
    const WM_CLOSE: u32 = 0x0010;
    const WM_DESTROY: u32 = 0x0002;

    use windows_sys::Win32::UI::WindowsAndMessaging::{DefWindowProcW, DestroyWindow, PostQuitMessage};

    match msg {
        WM_CLIPBOARDUPDATE => {
            if let Ok(guard) = MONITOR_APP_HANDLE.lock() {
                if let Some(ref app) = *guard {
                    let app = app.clone();
                    thread::spawn(move || {
                        process_new_clipboard_text(&app, &MONITOR_LAST_TEXT);
                    });
                }
            }
            0
        }
        WM_CLOSE => {
            RemoveClipboardFormatListener(hwnd as isize);
            DestroyWindow(hwnd);
            0
        }
        WM_DESTROY => {
            if let Ok(mut handle) = MONITOR_HWND.lock() {
                *handle = 0;
            }
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
}

impl ClipboardMonitor {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    #[cfg(target_os = "windows")]
    pub fn start(&self, app_handle: AppHandle) {
        if self.running.load(Ordering::SeqCst) {
            return;
        }

        self.running.store(true, Ordering::SeqCst);
        
        if let Ok(mut guard) = MONITOR_APP_HANDLE.lock() {
            *guard = Some(app_handle);
        }

        // Initialize last text
        if let Some(txt) = crate::clipboard_manager::read_clipboard_text_with_retry(5, 12) {
            if let Ok(mut last) = MONITOR_LAST_TEXT.lock() {
                *last = txt;
            }
        }

        let running = Arc::clone(&self.running);
        thread::spawn(move || {
            use windows_sys::Win32::UI::WindowsAndMessaging::{
                RegisterClassW, CreateWindowExW, DestroyWindow, GetMessageW, MSG, WNDCLASSW
            };

            unsafe {
                if !running.load(Ordering::SeqCst) {
                    return;
                }
                let class_name: Vec<u16> = "QuickPasteClipboardMonitorClass\0".encode_utf16().collect();
                let wnd_class = WNDCLASSW {
                    style: 0,
                    lpfnWndProc: Some(clipboard_wnd_proc),
                    cbClsExtra: 0,
                    cbWndExtra: 0,
                    hInstance: std::ptr::null_mut(),
                    hIcon: std::ptr::null_mut(),
                    hCursor: std::ptr::null_mut(),
                    hbrBackground: std::ptr::null_mut(),
                    lpszMenuName: std::ptr::null(),
                    lpszClassName: class_name.as_ptr(),
                };
                
                RegisterClassW(&wnd_class);

                // Create a HWND_MESSAGE (-3 as isize) parent to make it a message-only window
                let hwnd = CreateWindowExW(
                    0,
                    class_name.as_ptr(),
                    std::ptr::null(),
                    0,
                    0, 0, 0, 0,
                    -3_isize as _, // HWND_MESSAGE
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null(),
                );

                if !hwnd.is_null() {
                    if let Ok(mut hw_guard) = MONITOR_HWND.lock() {
                        *hw_guard = hwnd as isize;
                    }
                    if !running.load(Ordering::SeqCst) {
                        DestroyWindow(hwnd);
                        return;
                    }
                    if AddClipboardFormatListener(hwnd as isize) == 0 {
                        running.store(false, Ordering::SeqCst);
                        DestroyWindow(hwnd);
                        return;
                    }
                    
                    let mut msg: MSG = std::mem::zeroed();
                    while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                        // Keep processing messages for the listener
                    }
                }
            }
        });
    }

    #[cfg(not(target_os = "windows"))]
    pub fn start(&self, app_handle: AppHandle) {
        if self.running.load(Ordering::SeqCst) {
            return;
        }

        self.running.store(true, Ordering::SeqCst);
        let running = Arc::clone(&self.running);

        thread::spawn(move || {
            let last_text = Mutex::new(String::new());

            // Initialize last_text
            if let Some(txt) = crate::clipboard_manager::read_clipboard_text_with_retry(5, 12) {
                if let Ok(mut last) = last_text.lock() {
                    *last = txt;
                }
            }

        while running.load(Ordering::SeqCst) {
            process_new_clipboard_text(&app_handle, &last_text);
            thread::sleep(Duration::from_millis(500));
        }
        });
    }

    #[cfg(target_os = "windows")]
    pub fn stop(&self) {
        if !self.running.load(Ordering::SeqCst) {
            return;
        }
        self.running.store(false, Ordering::SeqCst);
        
        let hwnd = *MONITOR_HWND.lock().unwrap_or_else(|e| e.into_inner());
        if hwnd != 0 {
            use windows_sys::Win32::UI::WindowsAndMessaging::PostMessageW;
            unsafe {
                PostMessageW(hwnd as _, 0x0010, 0, 0); // WM_CLOSE
            }
        }
        if let Ok(mut guard) = MONITOR_APP_HANDLE.lock() {
            *guard = None;
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
