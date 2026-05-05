#![cfg_attr(not(debug_assertions), deny(warnings))]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![deny(clippy::all)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{
    api::dialog::blocking::FileDialogBuilder, Manager, SystemTray, SystemTrayEvent,
    SystemTrayMenu, SystemTrayMenuItem, WindowBuilder, WindowEvent, WindowUrl,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
fn window_url(page: &str) -> WindowUrl {
    WindowUrl::App(page.into())
}
use tokio::sync::RwLock;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const SETTINGS_VERSION: u32 = 4;

#[derive(Serialize, Deserialize, Clone, Debug)]
struct AppSettings {
    version: u32,
    work_interval: u32,    // minutes
    break_duration: u32,   // seconds
    snooze_duration: u32,  // seconds
    sound_enabled: bool,
    multi_monitor: bool,
    video_path: String,
    chroma_key_enabled: bool,
    chroma_key_color: String,
    #[serde(default = "default_language")]
    language: String,
}

fn default_language() -> String {
    "zh".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            work_interval: 50,
            break_duration: 300,
            snooze_duration: 300,
            sound_enabled: false,
            multi_monitor: true,
            video_path: String::new(),
            chroma_key_enabled: false,
            chroma_key_color: "#00FF00".to_string(),
            language: "zh".to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// Timer State
// ---------------------------------------------------------------------------
struct TimerState {
    work_seconds_remaining: Arc<RwLock<u32>>,
    break_seconds_remaining: Arc<RwLock<u32>>,
    break_seconds_total: Arc<RwLock<u32>>,
    is_break_active: Arc<AtomicBool>,
    is_paused: Arc<AtomicBool>,
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            work_seconds_remaining: Arc::new(RwLock::new(50 * 60)),
            break_seconds_remaining: Arc::new(RwLock::new(300)),
            break_seconds_total: Arc::new(RwLock::new(300)),
            is_break_active: Arc::new(AtomicBool::new(false)),
            is_paused: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Clone for TimerState {
    fn clone(&self) -> Self {
        Self {
            work_seconds_remaining: Arc::clone(&self.work_seconds_remaining),
            break_seconds_remaining: Arc::clone(&self.break_seconds_remaining),
            break_seconds_total: Arc::clone(&self.break_seconds_total),
            is_break_active: Arc::clone(&self.is_break_active),
            is_paused: Arc::clone(&self.is_paused),
        }
    }
}

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------
struct AppState {
    settings: Arc<RwLock<AppSettings>>,
    timer: TimerState,
    settings_path: PathBuf,
    i18n: Arc<RwLock<I18nManager>>,
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            settings: Arc::clone(&self.settings),
            timer: self.timer.clone(),
            settings_path: self.settings_path.clone(),
            i18n: Arc::clone(&self.i18n),
        }
    }
}

impl AppState {
    fn new(app_handle: &tauri::AppHandle) -> Self {
        let app_data_dir = app_handle
            .path_resolver()
            .app_data_dir()
            .expect("failed to resolve app data dir");
        fs::create_dir_all(&app_data_dir).ok();
        let settings_path = app_data_dir.join("settings.json");

        let settings = if settings_path.exists() {
            match fs::read_to_string(&settings_path) {
                Ok(content) => match serde_json::from_str::<AppSettings>(&content) {
                    Ok(mut s) => {
                        // Migration
                        if s.version < SETTINGS_VERSION {
                            s.version = SETTINGS_VERSION;
                            if s.snooze_duration == 0 {
                                s.snooze_duration = 300;
                            }
                        }
                        s
                    }
                    Err(_) => AppSettings::default(),
                },
                Err(_) => AppSettings::default(),
            }
        } else {
            AppSettings::default()
        };

        let work_seconds = settings.work_interval * 60;
        let language = settings.language.clone();

        Self {
            settings: Arc::new(RwLock::new(settings)),
            timer: TimerState {
                work_seconds_remaining: Arc::new(RwLock::new(work_seconds)),
                ..TimerState::default()
            },
            settings_path,
            i18n: Arc::new(RwLock::new(I18nManager::new(&language))),
        }
    }

    async fn save_settings(&self) {
        let settings = self.settings.read().await;
        if let Ok(json) = serde_json::to_string_pretty(&*settings) {
            fs::write(&self.settings_path, json).ok();
        }
    }

    async fn get_timer_status(&self) -> TimerStatus {
        TimerStatus {
            work_seconds_remaining: *self.timer.work_seconds_remaining.read().await,
            break_seconds_remaining: *self.timer.break_seconds_remaining.read().await,
            break_seconds_total: *self.timer.break_seconds_total.read().await,
            is_break_active: self.timer.is_break_active.load(Ordering::SeqCst),
            is_paused: self.timer.is_paused.load(Ordering::SeqCst),
        }
    }
}

#[derive(Serialize, Clone)]
struct TimerStatus {
    work_seconds_remaining: u32,
    break_seconds_remaining: u32,
    break_seconds_total: u32,
    is_break_active: bool,
    is_paused: bool,
}

// ---------------------------------------------------------------------------
// Simple I18n Manager
// ---------------------------------------------------------------------------
struct I18nManager {
    locale: String,
    translations: HashMap<String, serde_json::Value>,
}

impl I18nManager {
    fn new(locale: &str) -> Self {
        let locale = locale.to_string();
        let translations = Self::load_translations(&locale);
        Self { locale, translations }
    }

    fn set_locale(&mut self, locale: &str) {
        self.locale = locale.to_string();
    }

    fn load_translations(_locale: &str) -> HashMap<String, serde_json::Value> {
        let mut map = HashMap::new();

        // English translations
        let en = serde_json::json!({
            "window.settings.title": "Cat Gatekeeper Settings",
            "window.overlay.title": "Cat Gatekeeper",
            "tray.status.break": "Break ends at {0}:{1}",
            "tray.status.next": "Next break {0}:{1}",
            "tray.resume": "Resume",
            "tray.pause": "Pause",
            "tray.settings": "Settings",
            "tray.quit": "Quit",
            "dialog.video_files": "Video Files",
            "dialog.all_files": "All Files"
        });
        map.insert("en".to_string(), en);

        // Chinese translations
        let zh = serde_json::json!({
            "window.settings.title": "猫咪看门人设置",
            "window.overlay.title": "猫咪看门人",
            "tray.status.break": "休息还剩 {0}:{1}",
            "tray.status.next": "下次休息 {0}:{1}",
            "tray.resume": "继续",
            "tray.pause": "暂停",
            "tray.settings": "设置",
            "tray.quit": "退出",
            "dialog.video_files": "视频文件",
            "dialog.all_files": "所有文件"
        });
        map.insert("zh".to_string(), zh);

        map
    }

    fn t(&self, key: &str, default: &str) -> String {
        // Try current locale (flat dotted keys like "tray.pause")
        if let Some(translations) = self.translations.get(&self.locale) {
            if let Some(value) = translations.get(key) {
                if let Some(s) = value.as_str() {
                    return s.to_string();
                }
            }
        }
        // Fallback to English
        if self.locale != "en" {
            if let Some(translations) = self.translations.get("en") {
                if let Some(value) = translations.get(key) {
                    if let Some(s) = value.as_str() {
                        return s.to_string();
                    }
                }
            }
        }
        default.to_string()
    }
}

// ---------------------------------------------------------------------------
// Resource Paths
// ---------------------------------------------------------------------------
fn resolve_asset(app_handle: &tauri::AppHandle, filename: &str) -> PathBuf {
    // Production: use resource_dir (on Windows, returns exe directory)
    if let Some(resource_dir) = app_handle.path_resolver().resource_dir() {
        // Try 1: resource_dir/assets/filename
        let bundled = resource_dir.join("assets").join(filename);
        if bundled.exists() {
            return bundled;
        }
        // Try 2: resource_dir/_up_/assets/filename (NSIS sanitizes ../assets → _up_/assets)
        let up_assets = resource_dir.join("_up_").join("assets").join(filename);
        if up_assets.exists() {
            return up_assets;
        }
        // Try 3: resource_dir/filename (direct)
        let direct = resource_dir.join(filename);
        if direct.exists() {
            return direct;
        }
    }

    // Dev mode fallback
    if let Ok(cwd) = std::env::current_dir() {
        let dev_assets = cwd.join("..").join("assets").join(filename);
        if let Ok(canonical) = dev_assets.canonicalize() {
            return canonical;
        }
    }

    PathBuf::from("assets").join(filename)
}

fn get_video_path(settings: &AppSettings, app_handle: &tauri::AppHandle) -> PathBuf {
    if !settings.video_path.is_empty() {
        let path = PathBuf::from(&settings.video_path);
        if path.exists() {
            return path;
        }
    }
    resolve_asset(app_handle, "neko1.webm")
}

fn get_sleep_video_path(app_handle: &tauri::AppHandle) -> PathBuf {
    resolve_asset(app_handle, "neko2.webm")
}

fn get_fallback_image_path(app_handle: &tauri::AppHandle) -> PathBuf {
    resolve_asset(app_handle, "cat.png")
}

fn get_icon_path(app_handle: &tauri::AppHandle) -> PathBuf {
    resolve_asset(app_handle, "icon1.png")
}

fn get_sound_path(app_handle: &tauri::AppHandle) -> PathBuf {
    resolve_asset(app_handle, "meow.mp3")
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------
#[tauri::command]
async fn get_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.read().await.clone();
    Ok(settings)
}

#[tauri::command]
async fn save_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    {
        let mut current = state.settings.write().await;
        let old_interval = current.work_interval;
        current.work_interval = settings.work_interval;
        current.break_duration = settings.break_duration;
        current.snooze_duration = settings.snooze_duration;
        current.sound_enabled = settings.sound_enabled;
        current.multi_monitor = settings.multi_monitor;
        current.video_path = settings.video_path.clone();
        current.chroma_key_enabled = settings.chroma_key_enabled;
        current.chroma_key_color = settings.chroma_key_color.clone();
        current.language = settings.language.clone();

        // Reset timer if interval changed and not in break
        if old_interval != settings.work_interval
            && !state.timer.is_break_active.load(Ordering::SeqCst)
        {
            *state.timer.work_seconds_remaining.write().await = settings.work_interval * 60;
        }
    }

    state.save_settings().await;

    // Broadcast settings changed
    if let Some(window) = app.get_window("main") {
        let _ = window.emit("settings-changed", &*state.settings.read().await);
    }

    Ok(state.settings.read().await.clone())
}

#[tauri::command]
async fn get_timer_status(state: tauri::State<'_, AppState>) -> Result<TimerStatus, String> {
    Ok(state.get_timer_status().await)
}

#[tauri::command]
async fn pause_timer(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.timer.is_paused.store(true, Ordering::SeqCst);
    broadcast_timer_status(&app, &state).await;
    update_tray_menu(&app, &state).await;
    Ok(())
}

#[tauri::command]
async fn resume_timer(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.timer.is_paused.store(false, Ordering::SeqCst);
    broadcast_timer_status(&app, &state).await;
    update_tray_menu(&app, &state).await;
    Ok(())
}

#[tauri::command]
async fn dismiss_break(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    if state.timer.is_break_active.load(Ordering::SeqCst) {
        end_break(&app, &state).await;
    }
    Ok(())
}

#[tauri::command]
async fn snooze_break(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    if state.timer.is_break_active.load(Ordering::SeqCst) {
        let settings = state.settings.read().await;
        // Reset break timer to snooze duration, keep overlay windows open
        *state.timer.break_seconds_remaining.write().await = settings.snooze_duration;
        *state.timer.break_seconds_total.write().await = settings.snooze_duration;

        broadcast_timer_status(&app, &state).await;
        update_tray_menu(&app, &state).await;
    }
    Ok(())
}

#[tauri::command]
async fn select_video() -> Result<Option<String>, String> {
    let path = FileDialogBuilder::new()
        .add_filter("Video Files", &["mp4", "webm", "avi", "mov", "gif"])
        .add_filter("All Files", &["*"])
        .pick_file();

    Ok(path.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
async fn get_resource_path(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    resource: String,
) -> Result<Option<String>, String> {
    let settings = state.settings.read().await;

    let path = match resource.as_str() {
        "video" | "catVideoActive" => get_video_path(&settings, &app),
        "catVideoSleep" => get_sleep_video_path(&app),
        "fallback" => get_fallback_image_path(&app),
        "icon" => get_icon_path(&app),
        "sound" => get_sound_path(&app),
        _ => return Ok(None),
    };

    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
async fn set_language(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    language: String,
) -> Result<(), String> {
    {
        let mut i18n = state.i18n.write().await;
        i18n.set_locale(&language);
    }
    {
        let mut settings = state.settings.write().await;
        settings.language = language;
    }
    state.save_settings().await;

    // Update window titles with new locale
    let title = {
        let i18n = state.i18n.read().await;
        i18n.t("window.settings.title", "Cat Gatekeeper Settings")
    };
    if let Some(window) = app.get_window("main") {
        let _ = window.set_title(&title);
    }

    update_tray_menu(&app, &state).await;
    Ok(())
}

// ---------------------------------------------------------------------------
// Timer Logic
// ---------------------------------------------------------------------------
async fn broadcast_timer_status(app: &tauri::AppHandle, state: &AppState) {
    let status = state.get_timer_status().await;

    // Send to all overlay windows
    for window in app.windows().values() {
        if window.label().starts_with("overlay-") {
            let _ = window.emit("timer-tick", &status);
        }
    }

    // Send to settings window
    if let Some(window) = app.get_window("main") {
        let _ = window.emit("timer-tick", &status);
    }
}

async fn update_tray_menu(app: &tauri::AppHandle, state: &AppState) {
    let status = state.get_timer_status().await;
    let is_paused = status.is_paused;
    let is_break = status.is_break_active;

    let i18n = state.i18n.read().await;

    let time_display = if is_break {
        let m = status.break_seconds_remaining / 60;
        let s = status.break_seconds_remaining % 60;
        i18n.t("tray.status.break", "Break ends at {0}:{1}")
            .replace("{0}", &m.to_string())
            .replace("{1}", &s.to_string())
    } else {
        let m = status.work_seconds_remaining / 60;
        let s = status.work_seconds_remaining % 60;
        i18n.t("tray.status.next", "Next break {0}:{1}")
            .replace("{0}", &m.to_string())
            .replace("{1}", &s.to_string())
    };

    let pause_label = if is_paused { i18n.t("tray.resume", "Resume") } else { i18n.t("tray.pause", "Pause") };
    let settings_label = i18n.t("tray.settings", "Settings");
    let quit_label = i18n.t("tray.quit", "Quit");

    let menu = SystemTrayMenu::new()
        .add_item(tauri::CustomMenuItem::new("status", time_display).disabled())
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(tauri::CustomMenuItem::new("pause", pause_label))
        .add_item(tauri::CustomMenuItem::new("settings", settings_label))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(tauri::CustomMenuItem::new("quit", quit_label));

    app.tray_handle()
        .set_menu(menu)
        .expect("Failed to update tray menu");
}

async fn start_break(app: &tauri::AppHandle, state: &AppState) {
    let settings = state.settings.read().await;

    state.timer.is_break_active.store(true, Ordering::SeqCst);
    *state.timer.break_seconds_remaining.write().await = settings.break_duration;
    *state.timer.break_seconds_total.write().await = settings.break_duration;

    // Notify settings window
    if let Some(window) = app.get_window("main") {
        let _ = window.emit("break-start", settings.break_duration);
    }

    // Create overlay windows for all monitors
    create_overlay_windows(app, &settings, state).await;

    // Update tray
    update_tray_menu(app, state).await;
}

async fn create_overlay_windows(app: &tauri::AppHandle, settings: &AppSettings, state: &AppState) {
    // Close existing overlay windows
    let windows: Vec<_> = app
        .windows()
        .keys()
        .filter(|l| l.starts_with("overlay-"))
        .cloned()
        .collect();

    for label in windows {
        if let Some(window) = app.get_window(&label) {
            let _ = window.close();
        }
    }

    // Get monitors via any existing window
    let ref_monitor = app.get_window("main");
    let overlay_monitors = if let Some(window) = ref_monitor.as_ref() {
        if settings.multi_monitor {
            window.available_monitors().unwrap_or_default()
        } else {
            window.primary_monitor().ok().flatten().map(|m| vec![m]).unwrap_or_default()
        }
    } else {
        // No window exists yet, create overlay on primary monitor only
        Vec::new()
    };

    for (i, monitor) in overlay_monitors.into_iter().enumerate() {
        let position = monitor.position();
        let size = monitor.size();

        let label = format!("overlay-{}", i);

        let i18n = state.i18n.read().await;
        let title = i18n.t("window.overlay.title", "Cat Gatekeeper");

        let _ = WindowBuilder::new(app, &label, window_url("overlay.html"))
            .title(title)
            .position(position.x as f64, position.y as f64)
            .inner_size(size.width as f64, size.height as f64)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .visible(true)
            .build();
    }
}

async fn end_break(app: &tauri::AppHandle, state: &AppState) {
    state.timer.is_break_active.store(false, Ordering::SeqCst);

    // Close overlay windows
    let windows: Vec<_> = app
        .windows()
        .keys()
        .filter(|l| l.starts_with("overlay-"))
        .cloned()
        .collect();

    for label in windows {
        if let Some(window) = app.get_window(&label) {
            let _ = window.close();
        }
    }

    // Notify settings window
    if let Some(window) = app.get_window("main") {
        let _ = window.emit("break-end", ());
    }

    // Reset timer
    let settings = state.settings.read().await;
    *state.timer.work_seconds_remaining.write().await = settings.work_interval * 60;

    // Update tray
    update_tray_menu(app, state).await;
}

fn start_timer_thread(app: tauri::AppHandle, state: AppState) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;

            if state.timer.is_paused.load(Ordering::SeqCst) {
                continue;
            }

            if state.timer.is_break_active.load(Ordering::SeqCst) {
                let mut break_remaining = state.timer.break_seconds_remaining.write().await;
                if *break_remaining > 0 {
                    *break_remaining -= 1;
                }
                if *break_remaining == 0 {
                    drop(break_remaining);
                    end_break(&app, &state).await;
                }
            } else {
                let mut work_remaining = state.timer.work_seconds_remaining.write().await;
                if *work_remaining > 0 {
                    *work_remaining -= 1;
                }
                if *work_remaining == 0 {
                    drop(work_remaining);
                    start_break(&app, &state).await;
                }
            }

            broadcast_timer_status(&app, &state).await;
            update_tray_menu(&app, &state).await;
        }
    });
}

// ---------------------------------------------------------------------------
// System Tray
// ---------------------------------------------------------------------------
fn create_system_tray() -> SystemTray {
    let menu = SystemTrayMenu::new()
        .add_item(tauri::CustomMenuItem::new("status", "Loading...").disabled())
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(tauri::CustomMenuItem::new("pause", "Pause"))
        .add_item(tauri::CustomMenuItem::new("settings", "Settings"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(tauri::CustomMenuItem::new("quit", "Quit"));

    SystemTray::new().with_menu(menu)
}

fn handle_tray_event(app: &tauri::AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "pause" => {
                let state = app.state::<AppState>();
                let is_paused = state.timer.is_paused.load(Ordering::SeqCst);
                if is_paused {
                    state.timer.is_paused.store(false, Ordering::SeqCst);
                } else {
                    state.timer.is_paused.store(true, Ordering::SeqCst);
                }
                tauri::async_runtime::block_on(async {
                    broadcast_timer_status(app, &state).await;
                    update_tray_menu(app, &state).await;
                });
            }
            "settings" => {
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        },
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
fn main() {
    // Single instance check
    let _lock = single_instance::SingleInstance::new("com.catgatekeeper.app").unwrap();
    if !_lock.is_single() {
        println!("Another instance is already running");
        return;
    }

    tauri::Builder::default()
        .system_tray(create_system_tray())
        .on_system_tray_event(|app, event| {
            handle_tray_event(app, event);
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                // For the main settings window, prevent close and just hide
                if event.window().label() == "main" {
                    api.prevent_close();
                    let _ = event.window().hide();
                }
            }
        })
        .setup(|app| {
            let state = AppState::new(&app.handle());
            app.manage(state.clone());

            // Create settings window
            let title = tauri::async_runtime::block_on(async {
                let i18n = state.i18n.read().await;
                i18n.t("window.settings.title", "Cat Gatekeeper Settings")
            });

            let _ = WindowBuilder::new(
                app,
                "main",
                window_url("settings.html"),
            )
            .title(title)
            .inner_size(520.0, 620.0)
            .resizable(false)
            .build();

            // Start timer thread (clone needed since state is managed)
            start_timer_thread(app.handle(), state.clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_timer_status,
            pause_timer,
            resume_timer,
            dismiss_break,
            snooze_break,
            select_video,
            get_resource_path,
            set_language,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
