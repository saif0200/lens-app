use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState, Code, Shortcut, Modifiers};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn register_optional_shortcuts(app: &AppHandle) {
    let shortcut_enter = Shortcut::new(Some(Modifiers::SUPER), Code::Enter);
    let shortcut_s = Shortcut::new(Some(Modifiers::SUPER), Code::KeyS);

    let _ = app.global_shortcut().register(shortcut_enter);
    let _ = app.global_shortcut().register(shortcut_s);
}

fn unregister_optional_shortcuts(app: &AppHandle) {
    let shortcut_enter = Shortcut::new(Some(Modifiers::SUPER), Code::Enter);
    let shortcut_s = Shortcut::new(Some(Modifiers::SUPER), Code::KeyS);

    let _ = app.global_shortcut().unregister(shortcut_enter);
    let _ = app.global_shortcut().unregister(shortcut_s);
}

#[tauri::command]
fn toggle_window(app: AppHandle) {
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

#[tauri::command]
fn resize_window(app: AppHandle, width: f64, height: f64) {
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

#[tauri::command]
fn set_content_protection(app: AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_content_protected(enabled);
    }
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.set_content_protected(enabled);
    }
}

#[cfg(target_os = "macos")]
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
        return Err(format!("Screen capture exited with status {}", status));
    }

    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    fs::remove_file(&path).map_err(|e| e.to_string())?;

    Ok(BASE64_STANDARD.encode(bytes))
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn capture_screen() -> Result<String, String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        GetDC, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, DIB_RGB_COLORS, SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};
    use std::io::Write;

    unsafe {
        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);

        if width <= 0 || height <= 0 {
            return Err("Failed to get screen dimensions".to_string());
        }

        let screen_dc = GetDC(HWND::default());
        let mem_dc = CreateCompatibleDC(screen_dc);
        let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
        let old_bitmap = SelectObject(mem_dc, bitmap);

        let blt_result = BitBlt(mem_dc, 0, 0, width, height, screen_dc, 0, 0, SRCCOPY);
        if blt_result.is_err() {
            SelectObject(mem_dc, old_bitmap);
            let _ = DeleteObject(bitmap);
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(HWND::default(), screen_dc);
            return Err("BitBlt failed".to_string());
        }

        // Prepare bitmap info for extraction
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // Negative for top-down DIB
                biPlanes: 1,
                biBitCount: 24,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [Default::default()],
        };

        // Calculate row size with padding (rows must be 4-byte aligned)
        let row_size = ((width * 3 + 3) / 4) * 4;
        let image_size = (row_size * height) as usize;
        let mut pixels: Vec<u8> = vec![0; image_size];

        GetDIBits(
            mem_dc,
            bitmap,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        // Clean up GDI objects
        SelectObject(mem_dc, old_bitmap);
        let _ = DeleteObject(bitmap);
        let _ = DeleteDC(mem_dc);
        let _ = ReleaseDC(HWND::default(), screen_dc);

        // Convert BGR to RGB
        for chunk in pixels.chunks_exact_mut(3) {
            chunk.swap(0, 2);
        }

        // Remove padding from rows
        let mut unpadded_pixels: Vec<u8> = Vec::with_capacity((width * 3 * height) as usize);
        for row in 0..height {
            let start = (row * row_size) as usize;
            let end = start + (width * 3) as usize;
            unpadded_pixels.extend_from_slice(&pixels[start..end]);
        }

        // Encode as PNG in memory
        let mut png_data: Vec<u8> = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut png_data, width as u32, height as u32);
            encoder.set_color(png::ColorType::Rgb);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
            writer.write_image_data(&unpadded_pixels).map_err(|e| e.to_string())?;
        }

        Ok(BASE64_STANDARD.encode(png_data))
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
fn capture_screen() -> Result<String, String> {
    Err("Screen capture is not supported on this platform".to_string())
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
                        if shortcut.key == Code::Backslash {
                            let _ = app.emit("toggle-window-triggered", ());
                        } else if shortcut.key == Code::Enter {
                            // Emit ask event (shortcut is only registered when window is visible)
                            if let Some(window) = app.get_webview_window("main") {
                                let is_focused = window.is_focused().unwrap_or(false);
                                let _ = window.set_focus();
                                let _ = app.emit("ask-triggered", !is_focused);
                            }
                        } else if shortcut.key == Code::KeyS {
                            // Emit screen-share-triggered event (shortcut is only registered when window is visible)
                            let _ = app.emit("screen-share-triggered", ());
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

            #[cfg(target_os = "windows")]
            {
                use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
                use tauri::menu::{Menu, MenuItem};

                let toggle_item = MenuItem::with_id(app, "toggle", "Toggle Window (Ctrl+\\)", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .tooltip("Lens App - Ctrl+\\ to toggle")
                    .on_menu_event(move |_app, event| {
                        match event.id().as_ref() {
                            "toggle" => {
                                let _ = _app.emit("toggle-window-triggered", ());
                            }
                            "quit" => {
                                std::process::exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let _ = tray.app_handle().emit("toggle-window-triggered", ());
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, toggle_window, resize_window, capture_screen, set_content_protection])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
