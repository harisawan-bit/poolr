// Export API calls: replication code, citations, project export
import { ENGINE_URL, postJson } from "./client";

// ── Replication & Manuscript Export Suite ────────────────────────────

export async function exportReplicationCode(
  type: "r" | "stata" | "python" | "methods" | "latex" | "html",
  data: any
): Promise<string> {
  let route = "/api/export/r_code";
  if (type === "stata") route = "/api/report/stata";
  else if (type === "python") route = "/api/report/python";
  else if (type === "methods") route = "/api/export/methods";
  else if (type === "latex") route = "/api/report/latex";
  else if (type === "html") route = "/api/report/html";
  return await postJson<string>(route, data);
}

export async function exportCitations(data: any[], format: "bibtex" | "ris"): Promise<string> {
  const r = await fetch(`${ENGINE_URL}/api/export/citations?format=${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!r.ok) throw new Error(`Citations export failed (${r.status})`);
  return await r.text();
}
