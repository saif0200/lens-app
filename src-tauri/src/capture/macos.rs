use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

/// Capture screen on macOS using the native screencapture command
#[tauri::command]
pub fn capture_screen() -> Result<String, String> {
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
        return Err(format!("Screen capture exited with status {}", status));
    }

    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    fs::remove_file(&path).map_err(|e| e.to_string())?;

    Ok(BASE64_STANDARD.encode(bytes))
}
