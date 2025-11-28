use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Code, Shortcut, Modifiers};

/// Get the optional shortcuts that are registered when window is visible
pub fn get_optional_shortcuts() -> [Shortcut; 2] {
    [
        Shortcut::new(Some(Modifiers::SUPER), Code::Enter),
        Shortcut::new(Some(Modifiers::SUPER), Code::KeyS),
    ]
}

/// Register optional shortcuts (called when window becomes visible)
pub fn register_optional_shortcuts(app: &AppHandle) {
    for shortcut in get_optional_shortcuts() {
        let _ = app.global_shortcut().register(shortcut);
    }
}

/// Unregister optional shortcuts (called when window is hidden)
pub fn unregister_optional_shortcuts(app: &AppHandle) {
    for shortcut in get_optional_shortcuts() {
        let _ = app.global_shortcut().unregister(shortcut);
    }
}
