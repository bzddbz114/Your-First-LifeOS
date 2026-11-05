//! Read and write access to the macOS Calendar database through EventKit.

use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    /// Unique per occurrence: recurring events share an event identifier, so the start time is appended.
    id: String,
    /// EventKit's eventIdentifier, shared by every occurrence of a recurring event.
    event_id: String,
    calendar_id: Option<String>,
    notes: Option<String>,
    /// False for read-only calendars (subscriptions, holidays, shared without write access).
    editable: bool,
    recurring: bool,
    title: String,
    start_ms: f64,
    end_ms: f64,
    all_day: bool,
    calendar: String,
    /// "#rrggbb" in sRGB, when the calendar has a color.
    color: Option<String>,
    location: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarInfo {
    id: String,
    title: String,
    color: Option<String>,
    is_default: bool,
}

/// A new event (no `event_id`) or changes to one occurrence of an existing event.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventInput {
    event_id: Option<String>,
    /// Start of the occurrence being edited, to pick it out of a recurring series.
    occurrence_start_ms: Option<f64>,
    title: String,
    start_ms: f64,
    end_ms: f64,
    all_day: bool,
    calendar_id: Option<String>,
    location: Option<String>,
    notes: Option<String>,
}

#[cfg(target_os = "macos")]
mod imp {
    use super::{CalendarEvent, CalendarInfo, EventInput};
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::Bool;
    use objc2_app_kit::{NSColor, NSColorSpace};
    use objc2_event_kit::{EKAuthorizationStatus, EKCalendar, EKEntityType, EKEvent, EKEventStore, EKSpan};
    use objc2_foundation::{NSDate, NSError, NSString};
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

    fn hex(color: &NSColor) -> Option<String> {
        let c = color.colorUsingColorSpace(&NSColorSpace::sRGBColorSpace())?;
        let ch = |v: f64| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
        Some(format!("#{:02x}{:02x}{:02x}", ch(c.redComponent()), ch(c.greenComponent()), ch(c.blueComponent())))
    }

    fn granted_store() -> Result<Retained<EKEventStore>, String> {
        if access_status() != "granted" {
            return Err("没有日历访问权限".into());
        }
        Ok(unsafe { EKEventStore::new() })
    }

    fn date(ms: f64) -> Retained<NSDate> {
        NSDate::dateWithTimeIntervalSince1970(ms / 1000.0)
    }

    fn non_empty(s: Option<Retained<NSString>>) -> Option<String> {
        s.map(|s| s.to_string()).filter(|s| !s.is_empty())
    }

    pub fn events(start_ms: f64, end_ms: f64) -> Result<Vec<CalendarEvent>, String> {
        let store = granted_store()?;
        let mut out = Vec::new();
        unsafe {
            let predicate = store.predicateForEventsWithStartDate_endDate_calendars(&date(start_ms), &date(end_ms), None);
            for event in store.eventsMatchingPredicate(&predicate).iter() {
                let start_ms = event.startDate().timeIntervalSince1970() * 1000.0;
                let event_id = event
                    .eventIdentifier()
                    .unwrap_or_else(|| event.calendarItemIdentifier())
                    .to_string();
                let calendar = event.calendar();
                out.push(CalendarEvent {
                    id: format!("{event_id}@{start_ms}"),
                    event_id,
                    calendar_id: calendar.as_ref().map(|c| c.calendarIdentifier().to_string()),
                    notes: non_empty(event.notes()),
                    editable: calendar.as_ref().is_some_and(|c| c.allowsContentModifications()),
                    recurring: event.hasRecurrenceRules() || event.isDetached(),
                    title: event.title().to_string(),
                    start_ms,
                    end_ms: event.endDate().timeIntervalSince1970() * 1000.0,
                    all_day: event.isAllDay(),
                    calendar: calendar.as_ref().map(|c| c.title().to_string()).unwrap_or_default(),
                    color: calendar.as_ref().and_then(|c| hex(&c.color())),
                    location: non_empty(event.location()),
                });
            }
        }
        out.sort_by(|a, b| a.start_ms.total_cmp(&b.start_ms));
        Ok(out)
    }

    /// Calendars that accept new events, default first.
    pub fn calendars() -> Result<Vec<CalendarInfo>, String> {
        let store = granted_store()?;
        unsafe {
            let default_id = store.defaultCalendarForNewEvents().map(|c| c.calendarIdentifier().to_string());
            let mut out: Vec<CalendarInfo> = store
                .calendarsForEntityType(EKEntityType::Event)
                .iter()
                .filter(|c| c.allowsContentModifications())
                .map(|c| {
                    let id = c.calendarIdentifier().to_string();
                    CalendarInfo {
                        is_default: default_id.as_deref() == Some(id.as_str()),
                        id,
                        title: c.title().to_string(),
                        color: hex(&c.color()),
                    }
                })
                .collect();
            out.sort_by_key(|c| !c.is_default);
            Ok(out)
        }
    }

    /// The specific occurrence of `event_id` starting at `occurrence_ms` (falls back to the first one).
    unsafe fn find(store: &EKEventStore, event_id: &str, occurrence_ms: Option<f64>) -> Option<Retained<EKEvent>> {
        unsafe {
            if let Some(ms) = occurrence_ms {
                let predicate = store.predicateForEventsWithStartDate_endDate_calendars(&date(ms - 1000.0), &date(ms + 86_400_000.0), None);
                let hit = store.eventsMatchingPredicate(&predicate).iter().find(|e| {
                    e.eventIdentifier().is_some_and(|id| id.to_string() == event_id)
                        && (e.startDate().timeIntervalSince1970() * 1000.0 - ms).abs() < 1000.0
                });
                if hit.is_some() {
                    return hit;
                }
            }
            store.eventWithIdentifier(&NSString::from_str(event_id))
        }
    }

    fn calendar_for(store: &EKEventStore, id: Option<&str>) -> Result<Retained<EKCalendar>, String> {
        unsafe {
            id.and_then(|id| store.calendarWithIdentifier(&NSString::from_str(id)))
                .or_else(|| store.defaultCalendarForNewEvents())
                .ok_or_else(|| "没有可写入的日历".to_string())
        }
    }

    fn ns_err(e: Retained<NSError>) -> String {
        e.localizedDescription().to_string()
    }

    /// Creates or updates an event; returns its eventIdentifier.
    pub fn save(input: EventInput) -> Result<String, String> {
        let store = granted_store()?;
        if input.end_ms < input.start_ms {
            return Err("结束时间早于开始时间".into());
        }
        unsafe {
            let event = match &input.event_id {
                Some(id) => find(&store, id, input.occurrence_start_ms).ok_or("找不到这个日程,它可能已被删除")?,
                None => EKEvent::eventWithEventStore(&store),
            };
            if input.event_id.is_none() || input.calendar_id.is_some() {
                let calendar = calendar_for(&store, input.calendar_id.as_deref())?;
                event.setCalendar(Some(&calendar));
            }
            event.setTitle(Some(&NSString::from_str(input.title.trim())));
            event.setAllDay(input.all_day);
            event.setStartDate(Some(&date(input.start_ms)));
            event.setEndDate(Some(&date(input.end_ms)));
            let opt = |s: &Option<String>| s.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(NSString::from_str);
            event.setLocation(opt(&input.location).as_deref());
            event.setNotes(opt(&input.notes).as_deref());
            store.saveEvent_span_commit_error(&event, EKSpan::ThisEvent, true).map_err(ns_err)?;
            Ok(event.eventIdentifier().map(|s| s.to_string()).unwrap_or_default())
        }
    }

    pub fn delete(event_id: &str, occurrence_ms: Option<f64>) -> Result<(), String> {
        let store = granted_store()?;
        unsafe {
            let event = find(&store, event_id, occurrence_ms).ok_or("找不到这个日程,它可能已被删除")?;
            store.removeEvent_span_commit_error(&event, EKSpan::ThisEvent, true).map_err(ns_err)
        }
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
    pub fn calendars() -> Result<Vec<super::CalendarInfo>, String> {
        Err("仅支持 macOS".into())
    }

    pub fn save(_input: super::EventInput) -> Result<String, String> {
        Err("仅支持 macOS".into())
    }

    pub fn delete(_event_id: &str, _occurrence_ms: Option<f64>) -> Result<(), String> {
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

#[tauri::command]
pub async fn calendar_list() -> Result<Vec<CalendarInfo>, String> {
    tauri::async_runtime::spawn_blocking(imp::calendars)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn calendar_save_event(input: EventInput) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || imp::save(input))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn calendar_delete_event(event_id: String, occurrence_start_ms: Option<f64>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || imp::delete(&event_id, occurrence_start_ms))
        .await
        .map_err(|e| e.to_string())?
}
