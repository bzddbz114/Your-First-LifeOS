mod accounts;
mod calendar;
mod deepseek;

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
        .invoke_handler(tauri::generate_handler![
            calendar::calendar_access_status,
            calendar::calendar_request_access,
            calendar::calendar_events,
            calendar::calendar_list,
            calendar::calendar_save_event,
            calendar::calendar_delete_event,
            deepseek::deepseek_chat,
            accounts::delete_account_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
