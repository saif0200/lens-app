use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_global_shortcut::Code;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn toggle_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.is_visible().map(|visible| {
            if visible {
                let _ = window.hide();
                let _ = app.emit("window-hidden", ());
            } else {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app.emit("window-shown", ());
            }
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["CommandOrControl+Backslash", "CommandOrControl+Enter"])
                .unwrap()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if shortcut.key == Code::Enter {
                            // Only emit ask event if window is visible
                            if let Some(window) = app.get_webview_window("main") {
                                if let Ok(visible) = window.is_visible() {
                                    if visible {
                                        // Ensure window has focus before emitting event
                                        let _ = window.set_focus();
                                        let _ = app.emit("ask-triggered", ());
                                    }
                                }
                            }
                        } else if shortcut.key == Code::Backslash {
                            toggle_window(app.clone());
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet, toggle_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
