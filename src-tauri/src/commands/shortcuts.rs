use crate::config::{self, ShortcutsConfig};
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

/// Get the optional shortcuts that are registered when window is visible
#[allow(dead_code)]
pub fn get_optional_shortcuts() -> [Shortcut; 2] {
    [
        Shortcut::new(Some(Modifiers::SUPER), Code::Enter),
        Shortcut::new(Some(Modifiers::SUPER), Code::KeyS),
    ]
}

/// Register optional shortcuts (called when window becomes visible)
pub fn register_optional_shortcuts(app: &AppHandle) {
    // Note: This logic might need to be adjusted if we want these to be dynamic too.
    // For now, let's keep the hardcoded logic for "optional" ones if they are strictly internal,
    // BUT the requirement is to customize "Ask AI" and "Screen Share".
    // So we should probably use the config values here too.

    let config = config::load_config(app);

    if let Ok(shortcut) = config.shortcuts.ask.parse::<Shortcut>() {
        let _ = app.global_shortcut().register(shortcut);
    }
    if let Ok(shortcut) = config.shortcuts.screen_share.parse::<Shortcut>() {
        let _ = app.global_shortcut().register(shortcut);
    }
}

/// Unregister optional shortcuts (called when window is hidden)
pub fn unregister_optional_shortcuts(app: &AppHandle) {
    let config = config::load_config(app);

    if let Ok(shortcut) = config.shortcuts.ask.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(shortcut);
    }
    if let Ok(shortcut) = config.shortcuts.screen_share.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(shortcut);
    }
}

#[tauri::command]
pub fn get_shortcuts(app: AppHandle) -> ShortcutsConfig {
    let config = config::load_config(&app);
    config.shortcuts
}

#[tauri::command]
pub fn set_shortcuts(app: AppHandle, new_shortcuts: ShortcutsConfig) -> Result<(), String> {
    let mut config = config::load_config(&app);
    let old_shortcuts = config.shortcuts.clone();

    // Validate all new shortcuts first
    let new_toggle = new_shortcuts
        .toggle
        .parse::<Shortcut>()
        .map_err(|e| e.to_string())?;
    let new_ask = new_shortcuts
        .ask
        .parse::<Shortcut>()
        .map_err(|e| e.to_string())?;
    let new_screen_share = new_shortcuts
        .screen_share
        .parse::<Shortcut>()
        .map_err(|e| e.to_string())?;

    // Unregister old shortcuts
    if let Ok(s) = old_shortcuts.toggle.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(s);
    }
    if let Ok(s) = old_shortcuts.ask.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(s);
    }
    if let Ok(s) = old_shortcuts.screen_share.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(s);
    }

    // Update config
    config.shortcuts = new_shortcuts;

    // Register new shortcuts
    // If any registration fails, we should probably attempt to revert?
    // For now, let's just try to register all and report error if any.
    let mut errors = Vec::new();

    if let Err(e) = app.global_shortcut().register(new_toggle) {
        errors.push(format!("Failed to register toggle: {}", e));
    }
    if let Err(e) = app.global_shortcut().register(new_ask) {
        errors.push(format!("Failed to register ask: {}", e));
    }
    if let Err(e) = app.global_shortcut().register(new_screen_share) {
        errors.push(format!("Failed to register screen share: {}", e));
    }

    if !errors.is_empty() {
        return Err(errors.join(", "));
    }

    config::save_config(&app, &config)?;

    // Notify frontend to update UI
    let _ = app.emit("shortcuts-changed", ());

    Ok(())
}

#[tauri::command]
pub fn update_shortcut(app: AppHandle, action: String, new_shortcut: String) -> Result<(), String> {
    // This function can be deprecated or kept for single updates if needed.
    // Reusing the same logic as before but maybe not emitting if we want strictly save-button only?
    // But the user said "ANY changes that happen in settings".
    // "Settings" implies the UI interaction.
    // If we call update_shortcut from UI immediately, it violates the requirement.
    // The UI should call set_shortcuts only on save.
    // So this function is effectively unused by the new UI flow, but kept for API completeness or backward compat.

    let mut config = config::load_config(&app);
    let old_shortcut_str = match action.as_str() {
        "toggle" => config.shortcuts.toggle.clone(),
        "ask" => config.shortcuts.ask.clone(),
        "screen_share" => config.shortcuts.screen_share.clone(),
        _ => return Err("Invalid action".to_string()),
    };

    // Validate new shortcut
    let new_parsed = new_shortcut
        .parse::<Shortcut>()
        .map_err(|e| e.to_string())?;

    // Check for conflicts
    if (action != "toggle" && config.shortcuts.toggle == new_shortcut)
        || (action != "ask" && config.shortcuts.ask == new_shortcut)
        || (action != "screen_share" && config.shortcuts.screen_share == new_shortcut)
    {
        return Err("Shortcut already in use".to_string());
    }

    // Unregister old shortcut
    if let Ok(old_parsed) = old_shortcut_str.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(old_parsed);
    }

    // Update config
    match action.as_str() {
        "toggle" => config.shortcuts.toggle = new_shortcut.clone(),
        "ask" => config.shortcuts.ask = new_shortcut.clone(),
        "screen_share" => config.shortcuts.screen_share = new_shortcut.clone(),
        _ => {}
    }

    // Register new shortcut
    if let Err(e) = app.global_shortcut().register(new_parsed) {
        return Err(format!("Failed to register shortcut: {}", e));
    }

    config::save_config(&app, &config)?;

    // Notify frontend to update UI
    let _ = app.emit("shortcuts-changed", ());

    Ok(())
}
