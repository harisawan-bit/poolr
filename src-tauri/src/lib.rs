use std::path::PathBuf;
use std::process::Child;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Spawn the bundled C# engine sidecar (serves localhost:5180).
      // Packaged: <resources>/engine/Poolr.Engine.Api.exe (self-contained, no .NET needed)
      // Dev:      engine/Poolr.Engine.Api/bin/Release/net8.0/Poolr.Engine.Api.exe
      spawn_engine_sidecar(app.handle());

      // Frontend → Rust dialogs (Open/Save project).
      let _ = app.handle().plugin(tauri_plugin_dialog::init());

      Ok(())
    })
    // Terminate the sidecar when the app exits so a force-close never leaves it running.
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::Destroyed = event {
        if let Some(mut child) = window.state::<EngineSidecar>().0.lock().unwrap().take() {
          let _ = child.kill();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

struct EngineSidecar(std::sync::Mutex<Option<Child>>);

// Spawns the C# engine sidecar as a plain child process and stores its handle so
// it can be killed on window destroy. In packaged builds the exe lives in
// <resources>/engine/; in `tauri dev` it lives in the engine project's Release
// build output. At least one must exist.
fn spawn_engine_sidecar(app: &tauri::AppHandle) {
  let mut candidates: Vec<PathBuf> = Vec::new();

  // Packaged layout: resourcesDir/engine/Poolr.Engine.Api.exe
  if let Ok(res) = app.path().resource_dir() {
    candidates.push(res.join("engine").join("Poolr.Engine.Api.exe"));
  }

  // Dev layout: <repo>/engine/Poolr.Engine.Api/bin/Release/net8.0/Poolr.Engine.Api.exe
  if let Ok(cwd) = std::env::current_dir() {
    candidates.push(
      cwd.join("engine")
        .join("Poolr.Engine.Api")
        .join("bin")
        .join("Release")
        .join("net8.0")
        .join("Poolr.Engine.Api.exe"),
    );
  }

  let exe = match candidates.into_iter().find(|p| p.exists()) {
    Some(p) => p,
    None => {
      log::warn!("engine sidecar not found; poolr will run with no C# engine");
      return;
    }
  };

  match std::process::Command::new(&exe).spawn() {
    Ok(child) => {
      app.manage(EngineSidecar(std::sync::Mutex::new(Some(child))));
    }
    Err(e) => log::error!("failed to spawn engine sidecar {exe:?}: {e}"),
  }
}
