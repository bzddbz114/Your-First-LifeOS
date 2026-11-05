mod accounts;
mod calendar;
mod deepseek;
mod reminders;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_tasks_and_habits",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_finance_health_notes",
            sql: include_str!("../migrations/002_finance_health_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_projects",
            sql: include_str!("../migrations/003_projects.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_settings",
            sql: include_str!("../migrations/004_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "habit_reminders_and_day_plans",
            sql: include_str!("../migrations/005_reminders_plans.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:lifeos.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(reminders::ReminderState::default())
        .setup(|app| {
            reminders::start(app.handle().clone());
            Ok(())
        })
        // Closing the window hides it (reminders keep running); ⌘Q quits.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            calendar::calendar_access_status,
            calendar::calendar_request_access,
            calendar::calendar_events,
            calendar::calendar_list,
            calendar::calendar_save_event,
            calendar::calendar_delete_event,
            deepseek::deepseek_chat,
            accounts::delete_account_data,
            reminders::set_reminders,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Clicking the Dock icon brings the hidden window back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
