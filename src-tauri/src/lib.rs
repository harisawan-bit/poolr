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
    // Graceful close: window close / quit / Ctrl+C.
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      if let tauri::RunEvent::ExitRequested { .. } = event {
        kill_engine(app);
      }
    });
}

struct EngineSidecar(std::sync::Mutex<Option<Child>>);

fn kill_engine(app: &tauri::AppHandle) {
  if let Some(mut child) = app.state::<EngineSidecar>().0.lock().unwrap().take() {
    let _ = child.kill();
  }
}

// Spawns the C# engine sidecar as a plain child process and stores its handle so
// it can be killed on app exit. The child is placed in a Windows JobObject with
// KillOnJobClose, so it is reaped even if the app crashes or is SIGKILLed.
// In packaged builds the exe lives in <resources>/engine/; in `tauri dev` it
// lives in the engine project's Release build output. At least one must exist.
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
      // Attach to a KillOnJobClose job so a crash/force-kill can't orphan it.
      job_object::assign(child.id());
      app.manage(EngineSidecar(std::sync::Mutex::new(Some(child))));
    }
    Err(e) => log::error!("failed to spawn engine sidecar {exe:?}: {e}"),
  }
}

// Minimal Windows JobObject wrapper: a single job that closes (killing members)
// when the last handle to it is released — i.e. when this process exits.
#[cfg(windows)]
mod job_object {
  use std::os::windows::io::RawHandle;
  use winapi::um::jobapi2::{
    AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
  };
  use winapi::um::processthreadsapi::OpenProcess;
  use winapi::um::winnt::{JobObjectExtendedLimitInformation, HANDLE, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE};
  use winapi::um::handleapi::CloseHandle;
  use winapi::shared::minwindef::DWORD;

  // One job per app process; leak the handle intentionally — closing it would
  // kill the sidecar prematurely. The OS reaps the job (and child) on our exit.
  static mut JOB: Option<HANDLE> = None;

  pub fn assign(pid: u32) {
    unsafe {
      if JOB.is_none() {
        let job = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
        if job.is_null() {
          return;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = SetInformationJobObject(
          job,
          JobObjectExtendedLimitInformation,
          &info as *const _ as *mut winapi::ctypes::c_void,
          std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as DWORD,
        );
        if ok == 0 {
          CloseHandle(job);
          return;
        }
        JOB = Some(job);
      }
      let job = JOB.unwrap();
      let handle: HANDLE = OpenProcess(
        winapi::um::winnt::PROCESS_ALL_ACCESS,
        0,
        pid,
      );
      if !handle.is_null() {
        let _ = AssignProcessToJobObject(job, handle);
        CloseHandle(handle);
      }
    }
  }
}

#[cfg(not(windows))]
mod job_object {
  pub fn assign(_pid: u32) {}
}
