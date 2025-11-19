use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
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
                let _ = app.emit("window-shown", ());
            }
        });
    }
}

#[tauri::command]
fn resize_window(app: AppHandle, width: f64, height: f64) {
    if let Some(window) = app.get_webview_window("main") {
        use tauri::LogicalSize;
        let size = LogicalSize::new(width, height);
        let _ = window.set_size(size);
    }
}

#[tauri::command]
fn capture_screen() -> Result<String, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let filename = format!("lens_app_capture_{}.png", timestamp);
    let mut path = std::env::temp_dir();
    path.push(filename);

    let output_path = path.to_str().ok_or("Invalid temp path")?;

    let status = Command::new("screencapture")
        .args(["-x", output_path])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err(format!("screencapture exited with status {}", status));
    }

    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    fs::remove_file(&path).map_err(|e| e.to_string())?;

    Ok(BASE64_STANDARD.encode(bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["CommandOrControl+Backslash", "CommandOrControl+Enter", "CommandOrControl+S"])
                .unwrap()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if shortcut.key == Code::Enter {
                            // Only emit ask event if window is visible
                            if let Some(window) = app.get_webview_window("main") {
                                if let Ok(visible) = window.is_visible() {
                                    if visible {
                                        let is_focused = window.is_focused().unwrap_or(false);
                                        let _ = window.set_focus();
                                        let _ = app.emit("ask-triggered", !is_focused);
                                    }
                                }
                            }
                        } else if shortcut.key == Code::Backslash {
                            let _ = app.emit("toggle-window-triggered", ());
                        } else if shortcut.key == Code::KeyS {
                            // Emit screen-share-triggered event
                            if let Some(window) = app.get_webview_window("main") {
                                if let Ok(visible) = window.is_visible() {
                                    if visible {
                                        let _ = app.emit("screen-share-triggered", ());
                                    }
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::{NSApplication, NSApplicationActivationPolicy, NSWindow, NSWindowCollectionBehavior};
                use cocoa::base::{id, nil};

                unsafe {
                    // Set app as accessory - no Dock icon, no Cmd+Tab, but can still take focus
                    let ns_app = NSApplication::sharedApplication(nil);
                    ns_app.setActivationPolicy_(NSApplicationActivationPolicy::NSApplicationActivationPolicyAccessory);
                }

                if let Some(window) = app.get_webview_window("main") {
                    unsafe {
                        let ns_window = window.ns_window().unwrap() as id;

                        // Configure window behavior for overlay-style app
                        let mut collection_behavior = ns_window.collectionBehavior();
                        collection_behavior |= NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces;
                        collection_behavior |= NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary;
                        collection_behavior |= NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle;
                        ns_window.setCollectionBehavior_(collection_behavior);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, toggle_window, resize_window, capture_screen])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
