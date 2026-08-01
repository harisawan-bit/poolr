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
      spawn_engine_sidecar(app.handle());

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// Spawns the bundled C# engine sidecar.
// Packaged: <resources>/Poolr.Engine.Api.exe
// Dev:      engine/Poolr.Engine.Api/bin/Release/net8.0/Poolr.Engine.Api.exe
fn spawn_engine_sidecar(app: &tauri::AppHandle) {
  use std::process::Command;

  let mut candidates: Vec<std::path::PathBuf> = Vec::new();

  // Packaged: <resources>/Poolr.Engine.Api.exe
  if let Ok(res) = app.path().resource_dir() {
    candidates.push(res.join("Poolr.Engine.Api.exe"));
  }

  // Dev: engine/Poolr.Engine.Api/bin/Release/net8.0/Poolr.Engine.Api.exe
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

  for path in candidates {
    if path.exists() {
      let _ = Command::new(&path).spawn();
      break;
    }
  }
}
