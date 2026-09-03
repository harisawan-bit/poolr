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

  // ── External database search functions (Phase B) ──

  export interface SearchResult {
    id: string;
    title: string;
    authors: string;
    year: number;
    source: string;
    abstract: string;
    doi?: string;
    pmid?: string;
    url?: string;
    database: string;
  }

  export interface SearchResponse {
    query: string;
    database: string;
    totalResults: number;
    results: SearchResult[];
  }

  export async function pubmedSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    try {
      return await postJson<SearchResponse>("/api/search/pubmed", { query, apiKey }, 5000);
    } catch {
      try {
        const eSearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=20${apiKey ? `&api_key=${apiKey}` : ""}`;
        const searchRes = await fetch(eSearchUrl);
        if (!searchRes.ok) throw new Error(`PubMed search error: ${searchRes.statusText}`);
        const searchData = await searchRes.json();
        const idList: string[] = searchData?.esearchresult?.idlist || [];
        const totalResults = parseInt(searchData?.esearchresult?.count || "0", 10);
        if (idList.length === 0) return { query, database: "PubMed", totalResults: 0, results: [] };

        const eSummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(",")}&retmode=json${apiKey ? `&api_key=${apiKey}` : ""}`;
        const sumRes = await fetch(eSummaryUrl);
        if (!sumRes.ok) throw new Error(`PubMed summary error: ${sumRes.statusText}`);
        const sumData = await sumRes.json();
        const uids: string[] = sumData?.result?.uids || [];

        const results: SearchResult[] = uids.map((pmid) => {
          const item = sumData.result[pmid] || {};
          const authors = (item.authors || []).map((a: any) => a.name).join(", ");
          const year = parseInt(item.pubdate?.slice(0, 4), 10) || new Date().getFullYear();
          const doiObj = (item.articleids || []).find((id: any) => id.idtype === "doi");
          return {
            id: `pubmed-${pmid}`,
            title: item.title?.replace(/<\/?b>/g, "") || "Untitled",
            authors: authors || "Unknown authors",
            year,
            source: item.source || "PubMed",
            abstract: item.sorttitle || "",
            doi: doiObj?.value,
            pmid,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            database: "PubMed",
          };
        });
        return { query, database: "PubMed", totalResults, results };
      } catch (e: any) {
        throw new Error(`PubMed search failed: ${e.message}`);
      }
    }
  }

  export async function openalexSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    try {
      return await postJson<SearchResponse>("/api/search/openalex", { query, apiKey }, 5000);
    } catch {
      try {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=20`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OpenAlex error: ${res.statusText}`);
        const data = await res.json();
        const works = data.results || [];
        const results: SearchResult[] = works.map((w: any) => ({
          id: w.id || `openalex-${w.doi}`,
          title: w.title || "Untitled",
          authors: (w.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean).join(", ") || "Unknown",
          year: w.publication_year || new Date().getFullYear(),
          source: w.primary_location?.source?.display_name || "OpenAlex",
          abstract: "",
          doi: w.doi ? w.doi.replace("https://doi.org/", "") : undefined,
          url: w.doi || w.id,
          database: "OpenAlex",
        }));
        return { query, database: "OpenAlex", totalResults: data.meta?.count || results.length, results };
      } catch (e: any) {
        throw new Error(`OpenAlex search failed: ${e.message}`);
      }
    }
  }

  export async function crossrefSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    try {
      return await postJson<SearchResponse>("/api/search/crossref", { query, apiKey }, 5000);
    } catch {
      try {
        const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=20`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Crossref error: ${res.statusText}`);
        const data = await res.json();
        const items = data.message?.items || [];
        const results: SearchResult[] = items.map((w: any) => ({
          id: `crossref-${w.DOI}`,
          title: Array.isArray(w.title) ? w.title[0] : (w.title || "Untitled"),
          authors: (w.author || []).map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean).join(", ") || "Unknown",
          year: w.created?.["date-parts"]?.[0]?.[0] || new Date().getFullYear(),
          source: Array.isArray(w["container-title"]) ? w["container-title"][0] : (w["container-title"] || "Crossref"),
          abstract: w.abstract?.replace(/<[^>]+>/g, "") || "",
          doi: w.DOI,
          url: w.URL || (w.DOI ? `https://doi.org/${w.DOI}` : undefined),
          database: "Crossref",
        }));
        return { query, database: "Crossref", totalResults: data.message?.["total-results"] || results.length, results };
      } catch (e: any) {
        throw new Error(`Crossref search failed: ${e.message}`);
      }
    }
  }

  export async function clinicaltrialsSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    try {
      return await postJson<SearchResponse>("/api/search/clinicaltrials", { query, apiKey }, 5000);
    } catch {
      try {
        const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=20`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ClinicalTrials.gov error: ${res.statusText}`);
        const data = await res.json();
        const studies = data.studies || [];
        const results: SearchResult[] = studies.map((s: any) => {
          const ps = s.protocolSection || {};
          const idModule = ps.identificationModule || {};
          const descModule = ps.descriptionModule || {};
          const sponsorModule = ps.sponsorCollaboratorsModule || {};
          const nctId = idModule.nctId || "NCT unknown";
          return {
            id: `ct-${nctId}`,
            title: idModule.briefTitle || "Untitled Trial",
            authors: sponsorModule.leadSponsor?.name || "ClinicalTrials.gov Sponsor",
            year: parseInt(idModule.startDateStruct?.date?.slice(0, 4), 10) || new Date().getFullYear(),
            source: "ClinicalTrials.gov",
            abstract: descModule.briefSummary || "",
            url: `https://clinicaltrials.gov/study/${nctId}`,
            database: "ClinicalTrials.gov",
          };
        });
        return { query, database: "ClinicalTrials.gov", totalResults: data.totalCount || results.length, results };
      } catch (e: any) {
        throw new Error(`ClinicalTrials.gov search failed: ${e.message}`);
      }
    }
  }

  export async function scopusSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    if (!apiKey) {
      throw new Error("Scopus requires an Elsevier API key. Please configure your API key in Settings.");
    }
    return await postJson<SearchResponse>("/api/search/scopus", { query, apiKey });
  }

  export async function wosSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    if (!apiKey) {
      throw new Error("Web of Science requires a Clarivate API key. Please configure your API key in Settings.");
    }
    return await postJson<SearchResponse>("/api/search/wos", { query, apiKey });
  }

  export async function embaseSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    if (!apiKey) {
      throw new Error("Embase requires an institutional API key. Please configure your API key in Settings.");
    }
    return await postJson<SearchResponse>("/api/search/embase", { query, apiKey });
  }

  export async function cochraneSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    return await postJson<SearchResponse>("/api/search/cochrane", { query, apiKey });
  }

  export async function prosperoSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    return await postJson<SearchResponse>("/api/search/prospero", { query, apiKey });
  }

  export async function googleScholarSearch(query: string, apiKey?: string): Promise<SearchResponse> {
    return await postJson<SearchResponse>("/api/search/google_scholar", { query, apiKey });
  }
