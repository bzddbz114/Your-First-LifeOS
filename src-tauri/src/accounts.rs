//! File housekeeping for local accounts. Each account other than #1 keeps its data in
//! `lifeos-<id>.db` next to the main database (tauri-plugin-sql's app config dir).

use tauri::{AppHandle, Manager};

/// Deletes an account's database file and its SQLite sidecar files.
#[tauri::command]
pub fn delete_account_data(app: AppHandle, account_id: u32) -> Result<(), String> {
    if account_id <= 1 {
        return Err("主账号的数据不能删除".into());
    }
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    for suffix in ["", "-wal", "-shm", "-journal"] {
        let path = dir.join(format!("lifeos-{account_id}.db{suffix}"));
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(format!("无法删除 {}:{e}", path.display())),
        }
    }
    Ok(())
}
