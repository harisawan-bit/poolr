// Updater state: holds the last check timestamp for rate-limiting.
use std::sync::Mutex;
use std::time::SystemTime;

#[derive(Default)]
pub struct UpdaterState {
    pub last_check: Mutex<Option<SystemTime>>,
}

// Manual check command — frontend drives download/install via JS API.
#[tauri::command]
pub fn check_for_updates(state: tauri::State<UpdaterState>) -> Result<bool, String> {
    let mut last = state.last_check.lock().map_err(|e| e.to_string())?;
    let now = SystemTime::now();
    if let Some(t) = *last {
        if now.duration_since(t).unwrap_or_default().as_secs() < 86400 {
            return Ok(false); // Already checked today
        }
    }
    *last = Some(now);
    Ok(true)
}
