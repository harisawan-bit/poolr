// Bridge between the React UI and the C# engine sidecar (localhost HTTP API),
// plus the Tauri native dialog shim. In a plain browser (no Tauri), we fall back
// to hidden <input type=file> for Open and a blob download for Export so the UI
// still works during `npm run dev`.

const ENGINE_URL = "http://127.0.0.1:5180";

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

export async function postJson<T = any>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${ENGINE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return resolve({ path: null, data: null });
      const text = await file.text();
      let data: unknown = null;
      try { data = JSON.parse(text); } catch { /* ignore */ }
      resolve({ path: file.name, data });
    };
    inp.click();
  });
}

export async function exportProject(
  project: unknown,
  format: "json" | "md" | "latex" | "docx"
): Promise<void> {
  const r = await fetch(`${ENGINE_URL}/api/export?format=${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!r.ok) throw new Error(`export failed (${r.status})`);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ext = format === "latex" ? "tex" : format;
  a.href = url;
  a.download = `poolr_report.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function newProject(): Record<string, unknown> {
  return {
    metadata: { version: "0.4.0", created: new Date().toISOString() },
    pico: { population: "", intervention: "", comparator: "", outcomes: "" },
    protocol: { databases: "PubMed, Embase, Cochrane CENTRAL, Scopus", registration: "Not registered" },
    screening: { title_abstract: [], full_text: [] },
    extraction: { studies: [] },
    rob: { assessments: [] },
    meta: { results: null },
    prisma: { flow: {} },
  };
}
