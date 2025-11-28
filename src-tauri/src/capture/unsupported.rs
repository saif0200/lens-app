/// Fallback capture_screen for unsupported platforms
#[tauri::command]
pub fn capture_screen() -> Result<String, String> {
    Err("Screen capture is not supported on this platform".to_string())
}
