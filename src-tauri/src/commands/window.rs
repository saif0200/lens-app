use tauri::{AppHandle, Emitter, Manager};
use super::shortcuts::{register_optional_shortcuts, unregister_optional_shortcuts};

/// Toggle main window visibility
#[tauri::command]
pub fn toggle_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.is_visible().map(|visible| {
            if visible {
                let _ = window.hide();
                unregister_optional_shortcuts(&app);
                let _ = app.emit("window-hidden", ());
            } else {
                let _ = window.show();
                register_optional_shortcuts(&app);
                let _ = app.emit("window-shown", ());
            }
        });
    }
}

/// Resize the main window while maintaining top-left anchor
#[tauri::command]
pub fn resize_window(app: AppHandle, width: f64, height: f64) {
    if let Some(window) = app.get_webview_window("main") {
        use tauri::LogicalSize;
        // Store current position to anchor the window
        let current_pos = window.outer_position().ok();

        let size = LogicalSize::new(width, height);
        let _ = window.set_size(size);

        // Restore position to ensure top-left anchor
        if let Some(pos) = current_pos {
            let _ = window.set_position(pos);
        }
    }
}

/// Enable or disable content protection on all windows
#[tauri::command]
pub fn set_content_protection(app: AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_content_protected(enabled);
    }
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.set_content_protected(enabled);
    }
}
