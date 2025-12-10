mod capture;
mod commands;
mod config;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use capture::capture_screen;
use commands::{resize_window, set_content_protection, toggle_window};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let config = config::load_config(app);
                        let toggle_shortcut: tauri_plugin_global_shortcut::Shortcut =
                            config.shortcuts.toggle.parse().unwrap();
                        let ask_shortcut: tauri_plugin_global_shortcut::Shortcut =
                            config.shortcuts.ask.parse().unwrap();
                        let screen_share_shortcut: tauri_plugin_global_shortcut::Shortcut =
                            config.shortcuts.screen_share.parse().unwrap();

                        if shortcut == &toggle_shortcut {
                            let _ = app.emit("toggle-window-triggered", ());
                        } else if shortcut == &ask_shortcut {
                            // Emit ask event (shortcut is only registered when window is visible)
                            if let Some(window) = app.get_webview_window("main") {
                                let is_focused = window.is_focused().unwrap_or(false);
                                let _ = window.set_focus();
                                let _ = app.emit("ask-triggered", !is_focused);
                            }
                        } else if shortcut == &screen_share_shortcut {
                            let _ = app.emit("screen-share-triggered", ());
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                // Register shortcuts from config
                let config = config::load_config(app.handle());
                let global_shortcut = app.handle().global_shortcut();

                // Helper to safely register shortcuts
                let register_shortcut =
                    |shortcut_str: &str| match shortcut_str
                        .parse::<tauri_plugin_global_shortcut::Shortcut>()
                    {
                        Ok(shortcut) => {
                            if let Err(e) = global_shortcut.register(shortcut) {
                                eprintln!("Failed to register shortcut {}: {}", shortcut_str, e);
                            }
                        }
                        Err(e) => eprintln!("Failed to parse shortcut {}: {}", shortcut_str, e),
                    };

                register_shortcut(&config.shortcuts.toggle);
                register_shortcut(&config.shortcuts.ask);
                register_shortcut(&config.shortcuts.screen_share);

                // System Tray Setup
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder};

                let toggle_item =
                    MenuItem::with_id(app, "toggle", "Toggle Window", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

                let toggle_shortcut = config.shortcuts.toggle.clone();

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .tooltip(format!("Lens App - {} to toggle", toggle_shortcut))
                    .on_menu_event(move |_app, event| match event.id().as_ref() {
                        "toggle" => {
                            let _ = _app.emit("toggle-window-triggered", ());
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
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

            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::{
                    NSApplication, NSApplicationActivationPolicy, NSWindow,
                    NSWindowCollectionBehavior,
                };
                use cocoa::base::{id, nil};

                unsafe {
                    // Set app as accessory - no Dock icon, no Cmd+Tab, but can still take focus
                    let ns_app = NSApplication::sharedApplication(nil);
                    ns_app.setActivationPolicy_(
                        NSApplicationActivationPolicy::NSApplicationActivationPolicyAccessory,
                    );
                }

                if let Some(window) = app.get_webview_window("main") {
                    unsafe {
                        let ns_window = window.ns_window().unwrap() as id;

                        // Configure window behavior for overlay-style app
                        let mut collection_behavior = ns_window.collectionBehavior();
                        collection_behavior |=
                            NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces;
                        collection_behavior |=
                            NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary;
                        collection_behavior |=
                            NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle;
                        ns_window.setCollectionBehavior_(collection_behavior);
                    }
                }
            }

            #[cfg(target_os = "windows")]
            {
                // Windows specific setup if any left
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            toggle_window,
            resize_window,
            capture_screen,
            set_content_protection,
            commands::shortcuts::get_shortcuts,
            commands::shortcuts::update_shortcut,
            commands::shortcuts::set_shortcuts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
