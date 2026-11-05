//! Daily reminders (habit check-ins, evening planning) fired as system notifications.
//!
//! The frontend owns the rules and pushes the current list with `set_reminders` whenever
//! habits or plans change; a background thread here checks the clock, so reminders still
//! fire while the window is hidden.

use chrono::{Local, NaiveTime};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

/// How late a reminder may still fire, e.g. when the Mac wakes from sleep after its time.
const GRACE_MINUTES: i64 = 60;

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    /// Stable key such as "habit:3" or "plan"; one notification per key per day.
    key: String,
    /// "HH:MM", local time, every day.
    at: String,
    title: String,
    body: String,
    /// "YYYY-MM-DD" on which this reminder is already satisfied (habit checked, plan written).
    skip_on: Option<String>,
}

#[derive(Default)]
pub struct ReminderState {
    reminders: Mutex<Vec<Reminder>>,
    /// key → the day it last fired.
    fired: Mutex<HashMap<String, String>>,
}

#[tauri::command]
pub fn set_reminders(state: tauri::State<ReminderState>, reminders: Vec<Reminder>) {
    *state.reminders.lock().unwrap() = reminders;
}

fn due(r: &Reminder, today: &str, now: NaiveTime) -> bool {
    if r.skip_on.as_deref() == Some(today) {
        return false;
    }
    let Ok(at) = NaiveTime::parse_from_str(&r.at, "%H:%M") else {
        return false;
    };
    let late = now.signed_duration_since(at).num_minutes();
    (0..=GRACE_MINUTES).contains(&late)
}

/// Starts the checker thread; call once from `setup`.
pub fn start(app: AppHandle) {
    std::thread::spawn(move || loop {
        let now = Local::now();
        let today = now.format("%Y-%m-%d").to_string();
        let state = app.state::<ReminderState>();
        let to_fire: Vec<Reminder> = {
            let reminders = state.reminders.lock().unwrap();
            let fired = state.fired.lock().unwrap();
            reminders
                .iter()
                .filter(|r| fired.get(&r.key) != Some(&today) && due(r, &today, now.time()))
                .cloned()
                .collect()
        };
        for r in to_fire {
            let _ = app.notification().builder().title(&r.title).body(&r.body).show();
            state.fired.lock().unwrap().insert(r.key, today.clone());
        }
        std::thread::sleep(Duration::from_secs(20));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(at: &str, skip_on: Option<&str>) -> Reminder {
        Reminder { key: "k".into(), at: at.into(), title: String::new(), body: String::new(), skip_on: skip_on.map(Into::into) }
    }
    fn t(s: &str) -> NaiveTime {
        NaiveTime::parse_from_str(s, "%H:%M").unwrap()
    }

    #[test]
    fn fires_from_its_time_until_the_grace_period_ends() {
        assert!(!due(&r("22:00", None), "2026-11-05", t("21:59")));
        assert!(due(&r("22:00", None), "2026-11-05", t("22:00")));
        assert!(due(&r("22:00", None), "2026-11-05", t("23:00")));
        assert!(!due(&r("22:00", None), "2026-11-05", t("23:01")));
    }

    #[test]
    fn skipped_when_already_done_today_but_not_on_other_days() {
        assert!(!due(&r("07:30", Some("2026-11-05")), "2026-11-05", t("07:35")));
        assert!(due(&r("07:30", Some("2026-11-04")), "2026-11-05", t("07:35")));
    }

    #[test]
    fn ignores_malformed_times() {
        assert!(!due(&r("7.30", None), "2026-11-05", t("07:35")));
    }
}
