// Bridge between the React UI and the C# engine sidecar (localhost HTTP API),
// plus the Tauri native dialog shim. In a plain browser (no Tauri), we fall back
// to hidden <input type=file> for Open and a blob download for Export so the UI
// still works during `npm run dev`.

export const ENGINE_URL = "http://127.0.0.1:5180";

/** Human-readable reason a request never reached the engine. */
export function offlineMessage(what: string): string {
  return `${what} failed — the poolr engine is not reachable at ${ENGINE_URL}. Start the engine and try again.`;
}

// @ts-ignore - injected by Tauri at runtime
const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function engineHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${ENGINE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function postJson<T = any>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${ENGINE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    // Network-level failure (engine down, DNS, CORS, timeout) — fetch rejects
    // with an opaque TypeError, so translate it into something actionable.
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    throw new Error(timedOut ? `engine ${path} timed out after ${Math.round(timeoutMs / 1000)}s` : offlineMessage(`Request ${path}`));
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`engine ${path} failed (${r.status}): ${t}`);
  }
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await r.json()) as T;
  return (await r.text()) as unknown as T;
}

export async function getProject(path: string): Promise<unknown> {
  return postJson("/api/project/load", { path });
}

export async function saveProject(path: string, project: unknown): Promise<string> {
  const r = await postJson<{ saved: string }>("/api/project/save", { path, project });
  return r.saved;
}

export interface DialogResult {
  path: string | null;
  data: unknown | null;
}

// Open a poolr.json via Tauri dialog (or hidden file input in browser).
export async function openProjectDialog(): Promise<DialogResult> {
  if (hasTauri) {
    // @ts-ignore
    const f = await window.__TAURI__.dialog.open({
      filters: [{ name: "poolr project", extensions: ["json"] }],
      multiple: false,
    });
    if (!f) return { path: null, data: null };
    const data = await getProject(f as string);
    return { path: f as string, data };
  }
  return new Promise((resolve, reject) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.style.display = "none";
    document.body.appendChild(inp);

    let settled = false;
    const cleanup = () => {
      settled = true;
      window.removeEventListener("focus", onFocus);
      inp.remove();
    };
    const done = (res: DialogResult) => { if (!settled) { cleanup(); resolve(res); } };
    const fail = (e: Error) => { if (!settled) { cleanup(); reject(e); } };
    // If the user dismisses the OS picker, `change` never fires. Without this
    // the promise would hang forever and leave the shell stuck in `busy`.
    const onFocus = () => setTimeout(() => { if (!inp.files || inp.files.length === 0) done({ path: null, data: null }); }, 400);

    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return done({ path: null, data: null });
      let data: unknown = null;
      try {
        data = JSON.parse(await file.text());
      } catch {
        return fail(new Error(`${file.name} is not a valid poolr project (invalid JSON).`));
      }
      done({ path: file.name, data });
    };
    inp.oncancel = () => done({ path: null, data: null });
    window.addEventListener("focus", onFocus, { once: true });
    inp.click();
  });
}

export interface PickedFile {
  name: string;
  text: string;
}

/**
 * Read the contents of files chosen through a hidden <input type=file>.
 * Used for citation import (MEDLINE / RIS / .nbib / CSV / EndNote). Works
 * identically in Tauri and in a plain browser, so no native dialog is needed.
 */
export async function readTextFiles(files: FileList | File[] | null): Promise<PickedFile[]> {
  if (!files) return [];
  const list = Array.from(files as ArrayLike<File>);
  const out: PickedFile[] = [];
  for (const f of list) {
    try {
      out.push({ name: f.name, text: await f.text() });
    } catch {
      /* unreadable file — skip */
    }
  }
  return out;
}

export async function exportProject(
  project: unknown,
  format: "json" | "md" | "latex" | "docx"
): Promise<void> {
  let r: Response;
  try {
    r = await fetch(`${ENGINE_URL}/api/export?format=${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error(offlineMessage("Export"));
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`Export failed (${r.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ext = format === "latex" ? "tex" : format;
  a.href = url;
  a.download = `poolr_report.${ext}`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
}
