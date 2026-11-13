import { searchLiterature } from "./literature";
// External database search functions (PubMed, OpenAlex, Crossref, ClinicalTrials.gov, etc.)
import { postJson } from "./client";


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
  const page = await searchLiterature("pubmed", query, "relevance", AbortSignal.timeout(55000), { key: apiKey });
  return { query, database: "PubMed", totalResults: page.total, results: page.records.map(record => ({
    ...record, authors: record.citation, year: Number(record.date?.match(/\d{4}/)?.[0]) || 0,
    source: "PubMed", database: "PubMed",
  })) };
}

export async function openalexSearch(query: string): Promise<SearchResponse> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=20`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenAlex error: ${res.statusText}`);
    const data = await res.json();
    const works = data.results || [];
    const results: SearchResult[] = works.map((w: any) => {
      let abstract = "";
      if (w.abstract_inverted_index) {
        const words: [number, string][] = [];
        for (const [word, positions] of Object.entries(w.abstract_inverted_index as Record<string, number[]>)) {
          for (const pos of positions) words.push([pos, word]);
        }
        words.sort((a, b) => a[0] - b[0]);
        abstract = words.map((x) => x[1]).join(" ");
      }
      return {
        id: w.id || `openalex-${w.doi}`, title: w.title || "Untitled",
        authors: (w.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean).join(", ") || "Unknown",
        year: w.publication_year || 0,
        source: w.primary_location?.source?.display_name || "OpenAlex",
        abstract, doi: w.doi ? w.doi.replace("https://doi.org/", "") : undefined,
        url: w.doi || w.id, database: "OpenAlex",
      };
    });
    return { query, database: "OpenAlex", totalResults: data.meta?.count || results.length, results };
  } catch (e: any) {
    throw new Error(`OpenAlex search failed: ${e.message}`);
  }
}

export async function crossrefSearch(query: string): Promise<SearchResponse> {
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
      year: w.published?.["date-parts"]?.[0]?.[0] || 0,
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

// ── Priority Screening ML ────────────────────────────────────────────

export async function runPriorityScreening(req: {
  items: Array<{ id: string; title: string; abstract: string; decision: string }>;
  picoTerms: string[];
}): Promise<Array<{ id: string; title: string; abstract: string; decision: string; score?: number }>> {
  return await postJson<any>("/api/living/priority", req);
}
