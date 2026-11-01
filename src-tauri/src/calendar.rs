//! Read-only access to the macOS Calendar database through EventKit.

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    /// Unique per occurrence: recurring events share an event identifier, so the start time is appended.
    id: String,
    title: String,
    start_ms: f64,
    end_ms: f64,
    all_day: bool,
    calendar: String,
    /// "#rrggbb" in sRGB, when the calendar has a color.
    color: Option<String>,
    location: Option<String>,
}

#[cfg(target_os = "macos")]
mod imp {
    use super::CalendarEvent;
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_app_kit::NSColorSpace;
    use objc2_event_kit::{EKAuthorizationStatus, EKEntityType, EKEventStore};
    use objc2_foundation::{NSDate, NSError};
    use std::sync::mpsc;
    use std::time::Duration;

    pub fn access_status() -> &'static str {
        let status = unsafe { EKEventStore::authorizationStatusForEntityType(EKEntityType::Event) };
        match status {
            EKAuthorizationStatus::FullAccess => "granted",
            EKAuthorizationStatus::NotDetermined => "notDetermined",
            EKAuthorizationStatus::WriteOnly => "writeOnly",
            EKAuthorizationStatus::Restricted => "restricted",
            _ => "denied",
        }
    }

    pub fn request_access() -> Result<bool, String> {
        let store = unsafe { EKEventStore::new() };
        let (tx, rx) = mpsc::channel();
        let block = RcBlock::new(move |granted: Bool, _err: *mut NSError| {
            let _ = tx.send(granted.as_bool());
        });
        unsafe { store.requestFullAccessToEventsWithCompletion(RcBlock::as_ptr(&block)) };
        // The system prompt waits for the user, so allow plenty of time.
        rx.recv_timeout(Duration::from_secs(300))
            .map_err(|_| "等待日历授权超时".to_string())
    }

    pub fn events(start_ms: f64, end_ms: f64) -> Result<Vec<CalendarEvent>, String> {
        if access_status() != "granted" {
            return Err("没有日历访问权限".into());
        }
        let store = unsafe { EKEventStore::new() };
        let start = NSDate::dateWithTimeIntervalSince1970(start_ms / 1000.0);
        let end = NSDate::dateWithTimeIntervalSince1970(end_ms / 1000.0);
        let srgb = NSColorSpace::sRGBColorSpace();

        let mut out = Vec::new();
        unsafe {
            let predicate = store.predicateForEventsWithStartDate_endDate_calendars(&start, &end, None);
            for event in store.eventsMatchingPredicate(&predicate).iter() {
                let start_ms = event.startDate().timeIntervalSince1970() * 1000.0;
                let base_id = event
                    .eventIdentifier()
                    .unwrap_or_else(|| event.calendarItemIdentifier())
                    .to_string();
                let calendar = event.calendar();
                let color = calendar
                    .as_ref()
                    .and_then(|c| c.color().colorUsingColorSpace(&srgb))
                    .map(|c| {
                        let ch = |v: f64| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
                        format!(
                            "#{:02x}{:02x}{:02x}",
                            ch(c.redComponent()),
                            ch(c.greenComponent()),
                            ch(c.blueComponent())
                        )
                    });
                out.push(CalendarEvent {
                    id: format!("{base_id}@{start_ms}"),
                    title: event.title().to_string(),
                    start_ms,
                    end_ms: event.endDate().timeIntervalSince1970() * 1000.0,
                    all_day: event.isAllDay(),
                    calendar: calendar.map(|c| c.title().to_string()).unwrap_or_default(),
                    color,
                    location: event.location().map(|l| l.to_string()).filter(|l| !l.is_empty()),
                });
            }
        }
        out.sort_by(|a, b| a.start_ms.total_cmp(&b.start_ms));
        Ok(out)
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    use super::CalendarEvent;

    pub fn access_status() -> &'static str {
        "unsupported"
    }

    pub fn request_access() -> Result<bool, String> {
        Err("仅支持 macOS".into())
    }

    pub fn events(_start_ms: f64, _end_ms: f64) -> Result<Vec<CalendarEvent>, String> {
        Err("仅支持 macOS".into())
    }
}

#[tauri::command]
pub fn calendar_access_status() -> &'static str {
    imp::access_status()
}

#[tauri::command]
pub async fn calendar_request_access() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(imp::request_access)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn calendar_events(start_ms: f64, end_ms: f64) -> Result<Vec<CalendarEvent>, String> {
    tauri::async_runtime::spawn_blocking(move || imp::events(start_ms, end_ms))
        .await
        .map_err(|e| e.to_string())?
}
