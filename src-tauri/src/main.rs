#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

/* Brings the main window back (tray click, tray menu, second launch) and tells the page, so Today's Progress
   can pick a new line. WebView2 does not reliably raise visibilitychange for hide()/show() from the tray. */
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        // Only a window that was hidden or minimised counts as "shown again"; clicking the tray icon
        // while the window is already on screen must not change Today's Progress.
        let was_showing = window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        if !was_showing {
            let _ = app.emit("main-window-shown", ());
        }
    }
}

/* Windows toasts (v1.3.3).
   Windows shows a desktop app's toast only when the toast's AppUserModelID (AUMID) is registered by a Start Menu
   shortcut. The NSIS installer creates that shortcut ("Prayer Times.lnk" carrying the bundle identifier as its AUMID).
   The notification plugin tags every non-dev toast with the identifier and discards the result of show(), so when no
   such shortcut exists (portable copy of the EXE, installer run with /NS, shortcut deleted) Windows 10 drops the toast
   silently. These commands send the toast ourselves: with the app's own identity when the shortcut exists, otherwise
   with the PowerShell identity (always registered, shown under that name), and they return the real error. */
#[cfg(windows)]
fn start_menu_shortcut(product: &str) -> Option<std::path::PathBuf> {
    let file = format!("{product}.lnk");
    ["APPDATA", "ProgramData"]
        .iter()
        .filter_map(|variable| std::env::var_os(variable))
        .map(|base| {
            std::path::PathBuf::from(base)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
                .join(&file)
        })
        .find(|path| path.exists())
}

/// The AUMID to toast with (None = the PowerShell identity) and a human-readable description of the choice.
#[cfg(windows)]
fn toast_identity(app: &tauri::AppHandle) -> (Option<String>, String) {
    let config = app.config();
    let product = config.product_name.clone().unwrap_or_else(|| String::from("Prayer Times"));
    match start_menu_shortcut(&product) {
        Some(path) => (
            Some(config.identifier.clone()),
            format!("Start Menu shortcut found ({}): toasts use the app's own identity", path.display()),
        ),
        None => (
            None,
            String::from("No Start Menu shortcut named after the app was found: toasts use the PowerShell identity"),
        ),
    }
}

#[tauri::command]
async fn notify_native(app: tauri::AppHandle, title: String, body: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        let (app_id, how) = toast_identity(&app);
        let mut toast = notify_rust::Notification::new();
        toast.summary(&title).body(&body);
        if let Some(id) = &app_id {
            toast.app_id(id);
        }
        toast
            .show()
            .map_err(|error| format!("Windows could not show the notification: {error}"))?;
        Ok(how)
    }
    #[cfg(not(windows))]
    {
        use tauri_plugin_notification::NotificationExt;
        app.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|error| error.to_string())?;
        Ok(String::from("system notification"))
    }
}

#[tauri::command]
fn notification_diagnostics(app: tauri::AppHandle) -> Vec<String> {
    let mut lines = vec![format!("Application identifier: {}", app.config().identifier)];
    #[cfg(windows)]
    {
        lines.push(toast_identity(&app).1);
        if let Ok(exe) = std::env::current_exe() {
            lines.push(format!("Running from: {}", exe.display()));
        }
    }
    #[cfg(not(windows))]
    lines.push(String::from("Not Windows: system notifications"));
    lines
}

/* Fullscreen (v1.3.4). The window starts maximised; toggling fullscreen straight from the maximised state leaves WebView2
   with a stale pointer hit-test (the mouse acts offset or "stuck" after F11). So leave the maximised state first, remember
   it, restore it on exit, and refocus the window so it re-reads the pointer. The page has no native drag region. */
static WAS_MAXIMIZED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
fn set_window_fullscreen(app: tauri::AppHandle, fullscreen: bool) -> Result<(), String> {
    use std::sync::atomic::Ordering;
    let window = app.get_webview_window("main").ok_or_else(|| String::from("main window not found"))?;
    let is_fullscreen = window.is_fullscreen().map_err(|error| error.to_string())?;
    if fullscreen && !is_fullscreen {
        let maximized = window.is_maximized().unwrap_or(false);
        WAS_MAXIMIZED.store(maximized, Ordering::SeqCst);
        if maximized {
            let _ = window.unmaximize();
        }
        window.set_fullscreen(true).map_err(|error| error.to_string())?;
    } else if !fullscreen && is_fullscreen {
        window.set_fullscreen(false).map_err(|error| error.to_string())?;
        if WAS_MAXIMIZED.swap(false, Ordering::SeqCst) {
            let _ = window.maximize();
        }
    }
    let _ = window.set_focus();
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![notify_native, notification_diagnostics, set_window_fullscreen])
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--tray-start"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Open Prayer Times", true, None::<&str>)?;
            let exit = MenuItem::with_id(app, "exit", "Exit Prayer Times", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &exit])?;

            let icon = app.default_window_icon().expect("application icon is configured").clone();
            // The id lets the frontend update the tooltip with the next-prayer countdown
            // (TrayIcon.getById("main") + setTooltip, allowed by core:tray:default).
            let _tray = TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .tooltip("Prayer Times")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "exit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let launched_in_tray = std::env::args().any(|argument| argument == "--tray-start");
            if let Some(window) = app.get_webview_window("main") {
                if launched_in_tray {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                let _ = window.app_handle().emit("main-window-hidden", ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Prayer Times");
}

