use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(serde::Serialize, Clone)]
struct ClipboardPayload {
    text: String,
    source_app: String,
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

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
}

impl ClipboardMonitor {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(&self, app_handle: AppHandle) {
        if self.running.load(Ordering::SeqCst) {
            return;
        }

        self.running.store(true, Ordering::SeqCst);
        let running = Arc::clone(&self.running);

        thread::spawn(move || {
            let mut last_text = String::new();

            // Try to initialize last_text
            if let Ok(mut clipboard) = arboard::Clipboard::new() {
                last_text = clipboard.get_text().unwrap_or_default();
            }

            while running.load(Ordering::SeqCst) {
                // Instantiating and dropping Clipboard inside the loop releases locks immediately on Windows
                if let Ok(mut clipboard) = arboard::Clipboard::new() {
                    if let Ok(current) = clipboard.get_text() {
                        let trimmed = current.trim();
                        if !trimmed.is_empty() && current != last_text {
                            let proc_name = crate::clipboard_manager::get_active_process_name();
                            if !is_password_manager(&proc_name) {
                                last_text = current.clone();
                                let payload = ClipboardPayload {
                                    text: current,
                                    source_app: proc_name,
                                };
                                // Emit to frontend (listens on app window)
                                let _ = app_handle.emit("new-clipboard-entry", payload);
                            }
                        }
                    }
                }
                thread::sleep(Duration::from_millis(500));
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

