// Citation import: turn bibliographic-database export files into ScreeningItem[].
//
// Supported formats (all plain text, parsed locally — the engine is not involved):
//   • PubMed MEDLINE  (.txt / .medline)  → "PMID- 1", "TI  - ...", "AB  - ..." (wrapped lines)
//   • RIS / PubMed .nbib (.ris / .nbib)  → "TY  - JOUR" … "ER  - ", TI/T1 + AB/N2
//   • CSV (.csv)                         → Title / Abstract columns (case-insensitive)
//   • EndNote export (.txt)              → "%T title", "%X abstract"
//
// Everything here is pure (no DOM), so it is trivially testable in node.

import type { ScreeningItem, ScreenDecision } from "./project";

export type CitationFormat =
  | "medline"
  | "ris"
  | "csv"
  | "endnote"
  | "pubmed_summary"
  | "pubmed_abstract"
  | "pmid_list"
  | "unknown";

export interface CitationRecord {
  title: string;
  abstract: string;
  pmid?: string;
  doi?: string;
  authors?: string;
  year?: string;
  journal?: string;
  url?: string;
  tags?: string[];
  keywords?: string[];
  decision?: ScreenDecision;
  exclusion_reason?: string;
  note?: string;
  source?: string;
  /** Detected source format, useful for diagnostics. */
  format: CitationFormat;
}

export interface ImportResult {
  items: ScreeningItem[];
  records: number;
  skipped: number;
  format: CitationFormat;
}

/** accept="" value for the hidden file input. */
export const CITATION_ACCEPT = ".txt,.csv,.ris,.nbib,.medline";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Collapse whitespace, drop HTML/XML markup, trim. */
function clean(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinLines(parts: string[]): string {
  return clean(parts.join(" "));
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// ── format detection ─────────────────────────────────────────────────────────

export function detectFormat(text: string, filename = ""): CitationFormat {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "ris" || ext === "nbib") return "ris";
  if (ext === "medline") return "medline";

  const head = stripBom(text).slice(0, 8000);
  if (/^%[A-Z0-9]\s/m.test(head)) return "endnote";
  if (/^TY\s{0,2}-\s/m.test(head) || /^ER\s{0,2}-\s*$/m.test(head)) return "ris";
  if (/^PMID\s*-\s/m.test(head) || /^(TI|AB|FAU|JT|SO|OWN|STAT)\s{1,3}-\s/m.test(head)) return "medline";

  // PubMed Summary text format: "1: Author..."
  if (/^\d+:\s+\S/m.test(head) && (head.includes("PMID:") || head.includes("doi:") || /^\d+:\s+/m.test(head))) {
    return "pubmed_summary";
  }

  // PubMed Abstract text format: "1. Journal...", blank line, Title...
  if (/^\d+\.\s+\S/m.test(head) && (head.includes("PMID:") || head.includes("Author information:") || head.includes("DOI:"))) {
    return "pubmed_abstract";
  }

  // Plain PMID list: multiple lines with only digits (6-10 digits)
  const nonBlank = head.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (nonBlank.length > 0 && nonBlank.slice(0, 5).every((l) => /^\d{6,10}$/.test(l))) {
    return "pmid_list";
  }

  // Header-ish first line with a delimiter and no tag syntax → treat as CSV.
  const firstLine = head.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  if (/[,;\t]/.test(firstLine) && !/^[A-Z%][A-Z0-9]{0,3}\s{0,2}-\s/.test(firstLine.trim())) return "csv";

  return "unknown";
}

// ── MEDLINE (PubMed .txt) ────────────────────────────────────────────────────

const MEDLINE_TAG = /^([A-Z][A-Z0-9]{0,3})\s*-\s?(.*)$/;

export function parseMedline(text: string): CitationRecord[] {
  const out: CitationRecord[] = [];
  // Split on 2+ consecutive newlines or a newline right before PMID-
  const blocks = stripBom(text).split(/(?:\r?\n){2,}|(?:\r?\n)(?=PMID\s*-\s*)/);

  for (const block of blocks) {
    if (!block.trim()) continue;
    const title: string[] = [];
    const abstract: string[] = [];
    const authors: string[] = [];
    const keywords: string[] = [];
    let year: string | undefined = undefined;
    let journal: string | undefined = undefined;
    let pmid: string | undefined = undefined;
    let doi: string | undefined = undefined;
    let current: "ti" | "ab" | null = null;
    let tagged = false;

    for (const raw of block.split(/\r?\n/)) {
      if (!raw.trim()) continue;
      const m = MEDLINE_TAG.exec(raw);
      if (m) {
        tagged = true;
        const tag = (m[1] ?? "").toUpperCase();
        const value = m[2] ?? "";
        if (tag === "TI" || tag === "BTI" || tag === "TT") {
          current = "ti";
          title.push(value);
        } else if (tag === "AB" || tag === "OAB") {
          current = "ab";
          abstract.push(value);
        } else if (tag === "FAU" || tag === "AU") {
          if (tag === "FAU" || authors.length === 0) authors.push(clean(value));
          current = null;
        } else if (tag === "DP" && !year) {
          const ym = value.match(/\b(19|20)\d{2}\b/);
          if (ym) year = ym[0];
          current = null;
        } else if ((tag === "JT" || tag === "TA") && !journal) {
          journal = clean(value);
          current = null;
        } else if (tag === "MH" || tag === "OT") {
          keywords.push(clean(value).replace(/^\*/, ""));
          current = null;
        } else if (tag === "PMID" && !pmid) {
          pmid = value.trim();
          current = null;
        } else if ((tag === "LID" || tag === "AID") && !doi) {
          const dm = value.match(/([^\s]+)\s+\[doi\]/i);
          if (dm) doi = dm[1];
          else if (/^10\.\d{4,9}\//.test(value.trim())) doi = value.trim();
          current = null;
        } else {
          current = null;
        }
        continue;
      }
      // Continuation line (MEDLINE wraps with six leading spaces).
      if (current === "ti") title.push(raw);
      else if (current === "ab") abstract.push(raw);
    }

    if (!tagged) continue;
    out.push({
      title: joinLines(title),
      abstract: joinLines(abstract),
      pmid,
      doi,
      ...(authors.length ? { authors: authors.join("; ") } : {}),
      ...(year ? { year } : {}),
      ...(journal ? { journal } : {}),
      ...(keywords.length ? { keywords } : {}),
      source: "MEDLINE",
      format: "medline",
    });
  }
  return out;
}

// ── PubMed Summary / Abstract / PMID list ───────────────────────────────────

export function parsePubmedSummary(text: string): CitationRecord[] {
  const out: CitationRecord[] = [];
  const blocks = stripBom(text).split(/(?:^|\r?\n\r?\n)(?=\d+:\s+)/).filter((b) => b.trim());
  for (const raw of blocks) {
    const s = clean(raw);
    const withoutNum = s.replace(/^\d+:\s*/, "");
    if (!withoutNum) continue;

    const pmidMatch = withoutNum.match(/PMID:\s*(\d+)/i);
    const pmid = pmidMatch ? pmidMatch[1] : undefined;

    const doiMatch = withoutNum.match(/doi:\s*([^\s;]+)/i);
    const doi = doiMatch ? doiMatch[1].replace(/\.$/, "") : undefined;

    const parts = withoutNum.split(/\.\s+/);
    let title = parts.length >= 2 ? parts[1] : parts[0];
    if (title.length < 5 && parts.length >= 3) title = parts[2];

    out.push({
      title: title.replace(/\.$/, "").trim(),
      abstract: withoutNum,
      pmid,
      doi,
      format: "pubmed_summary",
    });
  }
  return out;
}

export function parsePubmedAbstract(text: string): CitationRecord[] {
  const out: CitationRecord[] = [];
  const blocks = stripBom(text).split(/(?:^|\r?\n\r?\n)(?=\d+\.\s+)/).filter((b) => b.trim());
  for (const block of blocks) {
    const pmidMatch = block.match(/PMID:\s*(\d+)/i);
    const pmid = pmidMatch ? pmidMatch[1] : undefined;

    const doiMatch = block.match(/DOI:\s*([^\s;]+)/i) || block.match(/doi:\s*([^\s;]+)/i);
    const doi = doiMatch ? doiMatch[1].replace(/\.$/, "") : undefined;

    const paragraphs = block.split(/(?:\r?\n){2,}/).map((p) => clean(p)).filter(Boolean);
    if (paragraphs.length === 0) continue;

    let title = "";
    let abstract = "";

    if (paragraphs.length >= 2 && /^\d+\.\s+/.test(paragraphs[0])) {
      title = paragraphs[1];
      const abstractParts: string[] = [];
      for (let i = 2; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        if (/^Author information:/i.test(p)) continue;
        if (/^(DOI:|PMID:|PMCID:|Conflict of interest statement:)/i.test(p)) continue;
        if (/^Copyright\s+[©\d]/i.test(p)) continue;
        if (i === 2 && !/[.!?]$/.test(p) && paragraphs.length > 3) continue;
        abstractParts.push(p);
      }
      abstract = abstractParts.join("\n\n");
    } else {
      title = paragraphs[0].replace(/^\d+\.\s+/, "");
      abstract = paragraphs.slice(1).join("\n\n");
    }

    out.push({
      title: title.replace(/\.$/, "").trim(),
      abstract,
      pmid,
      doi,
      format: "pubmed_abstract",
    });
  }
  return out;
}

export function parsePmidList(text: string): CitationRecord[] {
  const lines = stripBom(text).split(/\r?\n/).map((l) => l.trim()).filter((l) => /^\d{6,10}$/.test(l));
  return lines.map((l) => ({
    title: `PMID ${l}`,
    abstract: "",
    pmid: l,
    format: "pmid_list",
  }));
}

// ── RIS / .nbib ──────────────────────────────────────────────────────────────

const RIS_TAG = /^([A-Z][A-Z0-9]{1,3})\s{0,2}-\s?(.*)$/;

export function parseRis(text: string): CitationRecord[] {
  const out: CitationRecord[] = [];
  const lines = stripBom(text).split(/\r?\n/);

  let ti: string[] = [];
  let t1: string[] = [];
  let ab: string[] = [];
  let authors: string[] = [];
  let keywords: string[] = [];
  let year: string | undefined = undefined;
  let journal: string | undefined = undefined;
  let url: string | undefined = undefined;
  let pmid: string | undefined = undefined;
  let doi: string | undefined = undefined;
  let current: "ti" | "t1" | "ab" | null = null;
  let touched = false;

  const flush = () => {
    if (!touched) return;
    out.push({
      title: joinLines(ti.length ? ti : t1),
      abstract: joinLines(ab),
      ...(pmid ? { pmid } : {}),
      ...(doi ? { doi } : {}),
      ...(authors.length ? { authors: authors.join("; ") } : {}),
      ...(year ? { year } : {}),
      ...(journal ? { journal } : {}),
      ...(url ? { url } : {}),
      ...(keywords.length ? { keywords } : {}),
      source: "RIS",
      format: "ris",
    });
    ti = []; t1 = []; ab = []; authors = []; keywords = []; year = undefined; journal = undefined; url = undefined; pmid = undefined; doi = undefined; current = null; touched = false;
  };

  for (const raw of lines) {
    const m = RIS_TAG.exec(raw);
    if (m) {
      const tag = (m[1] ?? "").toUpperCase();
      const value = m[2] ?? "";
      touched = true;
      if (tag === "ER") { flush(); continue; }
      if (tag === "TI") { current = "ti"; ti.push(value); continue; }
      if (tag === "T1") { current = "t1"; t1.push(value); continue; }
      if (tag === "AB" || tag === "N2") { current = "ab"; ab.push(value); continue; }
      if (tag === "AU" || tag === "A1") { authors.push(clean(value)); current = null; continue; }
      if ((tag === "PY" || tag === "Y1" || tag === "DA") && !year) {
        const ym = value.match(/\b(19|20)\d{2}\b/);
        if (ym) year = ym[0];
        current = null;
        continue;
      }
      if ((tag === "JO" || tag === "JF" || tag === "T2" || tag === "JA") && !journal) { journal = clean(value); current = null; continue; }
      if ((tag === "UR" || tag === "L2" || tag === "L1") && !url) { url = clean(value); current = null; continue; }
      if (tag === "KW") { keywords.push(clean(value)); current = null; continue; }
      if (tag === "DO" || tag === "DI") { if (!doi) doi = value.trim(); current = null; continue; }
      if (tag === "AN" || tag === "ID" || tag === "C1") {
        const pm = value.match(/\b\d{6,10}\b/);
        if (pm && !pmid) pmid = pm[0];
        current = null;
        continue;
      }
      current = null;
      continue;
    }
    if (!raw.trim()) continue;
    if (current === "ti") ti.push(raw);
    else if (current === "t1") t1.push(raw);
    else if (current === "ab") ab.push(raw);
  }
  flush(); // trailing record with no ER
  return out;
}

// ── EndNote (%T / %X) ────────────────────────────────────────────────────────

const ENDNOTE_TAG = /^%([A-Z0-9])\s?(.*)$/;

export function parseEndnote(text: string): CitationRecord[] {
  const out: CitationRecord[] = [];
  const blocks = stripBom(text).split(/(?:\r?\n){2,}/);

  for (const block of blocks) {
    if (!block.trim()) continue;
    const title: string[] = [];
    const abstract: string[] = [];
    const authors: string[] = [];
    const keywords: string[] = [];
    let year: string | undefined;
    let journal: string | undefined;
    let url: string | undefined;
    let current: "ti" | "ab" | null = null;
    let tagged = false;

    for (const raw of block.split(/\r?\n/)) {
      if (!raw.trim()) continue;
      const m = ENDNOTE_TAG.exec(raw);
      if (m) {
        tagged = true;
        const tag = m[1] ?? "";
        const value = m[2] ?? "";
        if (tag === "T") { current = "ti"; title.push(value); }
        else if (tag === "X") { current = "ab"; abstract.push(value); }
        else if (tag === "A") { authors.push(clean(value)); current = null; }
        else if (tag === "D" && !year) { const ym = value.match(/\b(19|20)\d{2}\b/); if (ym) year = ym[0]; current = null; }
        else if ((tag === "J" || tag === "B") && !journal) { journal = clean(value); current = null; }
        else if (tag === "U" && !url) { url = clean(value); current = null; }
        else if (tag === "K") { keywords.push(clean(value)); current = null; }
        else current = null;
        continue;
      }
      if (current === "ti") title.push(raw);
      else if (current === "ab") abstract.push(raw);
    }

    if (!tagged) continue;
    out.push({
      title: joinLines(title),
      abstract: joinLines(abstract),
      ...(authors.length ? { authors: authors.join("; ") } : {}),
      ...(year ? { year } : {}),
      ...(journal ? { journal } : {}),
      ...(url ? { url } : {}),
      ...(keywords.length ? { keywords } : {}),
      source: "EndNote",
      format: "endnote",
    });
  }
  return out;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** RFC4180-ish reader: handles quotes, escaped quotes, embedded newlines, CRLF. */
export function parseCsvRows(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = stripBom(text);

  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (src.charAt(i + 1) === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { row.push(field); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field); field = ""; rows.push(row); row = []; continue; }
    field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function sniffDelimiter(text: string): string {
  const line = stripBom(text).split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

const TITLE_KEYS = ["title", "ti", "article title", "document title", "primary title", "title of article", "publication title"];
const ABSTRACT_KEYS = ["abstract", "ab", "abstract note", "abstract text", "summary", "citation", "description"];
const PMID_KEYS = ["pmid", "pubmed id", "pubmed", "pmid_id"];
const DOI_KEYS = ["doi", "digital object identifier", "doi link"];
/** Common bibliographic column names — used to spot a header row that has no title/abstract column. */
const HEADER_KEYS = [
  ...TITLE_KEYS, ...ABSTRACT_KEYS, ...PMID_KEYS, ...DOI_KEYS,
  "author", "authors", "author names", "year", "publication year", "date", "journal",
  "source", "source title", "pmcid", "id", "volume", "issue", "pages", "url", "link",
  "keywords", "issn", "isbn", "language", "document type", "publication type",
];

const AUTHOR_KEYS = ["authors", "author", "author names", "first author"];
const YEAR_KEYS = ["year", "published year", "publication year", "pub year", "date"];
const JOURNAL_KEYS = ["journal", "source", "source title", "publication", "venue"];
const URL_KEYS = ["url", "link", "full text url", "pdf url"];
const KEYWORD_KEYS = ["keywords", "tags", "labels", "mesh"];
const DECISION_KEYS = ["decision", "status", "screening decision", "final decision", "included"];
const REASON_KEYS = ["exclusion reason", "exclusion_reason", "reason", "reasons"];
const NOTE_KEYS = ["notes", "note", "comments"];

function parseRayyanNotes(rawNotes: string): { decision?: ScreenDecision; exclusion_reason?: string; tags?: string[]; note?: string } {
  const result: { decision?: ScreenDecision; exclusion_reason?: string; tags?: string[]; note?: string } = {};
  const inc = rawNotes.match(/RAYYAN-INCLUSION:\s*\{([^}]*)\}/i);
  if (inc) {
    const lower = inc[1].toLowerCase();
    if (lower.includes("included")) result.decision = "include";
    else if (lower.includes("excluded")) result.decision = "exclude";
    else if (lower.includes("maybe")) result.decision = "unsure";
  }
  const ex = rawNotes.match(/RAYYAN-EXCLUSION-REASONS:\s*([^|;\n]+)/i);
  if (ex) result.exclusion_reason = clean(ex[1]);
  const labels = rawNotes.match(/RAYYAN-LABELS:\s*([^|;\n]+)/i);
  if (labels) result.tags = labels[1].split(/[,;]/).map((s) => clean(s)).filter(Boolean);
  const cleaned = clean(rawNotes.replace(/RAYYAN-[A-Z-]+:\s*(?:\{[^}]*\}|[^|\n]*)\|?/gi, ""));
  if (cleaned) result.note = cleaned;
  return result;
}

function parseDecisionCell(raw: string): ScreenDecision | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (s === "include" || s === "included" || s === "yes" || s === "accept") return "include";
  if (s === "exclude" || s === "excluded" || s === "no" || s === "reject") return "exclude";
  if (s === "unsure" || s === "maybe" || s === "conflict") return "unsure";
  return undefined;
}

export function parseCsv(text: string): CitationRecord[] {
  const rows = parseCsvRows(text, sniffDelimiter(text));
  if (rows.length === 0) return [];

  const header = (rows[0] ?? []).map((h) => clean(h).toLowerCase().replace(/^"|"$/g, ""));
  // Exact key match first; a fuzzy "contains title/abstract" fallback only for
  // short, header-like cells (≤40 chars) so a long abstract that merely
  // mentions the word "abstract" is never mistaken for a header row.
  const headerLike = (h: string) => h.length > 0 && h.length <= 40;
  let titleIdx = header.findIndex((h) => TITLE_KEYS.includes(h));
  let abstractIdx = header.findIndex((h) => ABSTRACT_KEYS.includes(h));
  const pmidIdx = header.findIndex((h) => PMID_KEYS.includes(h));
  const doiIdx = header.findIndex((h) => DOI_KEYS.includes(h));
  const authorIdx = header.findIndex((h) => AUTHOR_KEYS.includes(h));
  const yearIdx = header.findIndex((h) => YEAR_KEYS.includes(h));
  const journalIdx = header.findIndex((h) => JOURNAL_KEYS.includes(h));
  const urlIdx = header.findIndex((h) => URL_KEYS.includes(h));
  const kwIdx = header.findIndex((h) => KEYWORD_KEYS.includes(h));
  const decIdx = header.findIndex((h) => DECISION_KEYS.includes(h));
  const reasonIdx = header.findIndex((h) => REASON_KEYS.includes(h));
  const noteIdx = header.findIndex((h) => NOTE_KEYS.includes(h));

  if (titleIdx < 0) titleIdx = header.findIndex((h) => headerLike(h) && h.includes("title"));
  if (abstractIdx < 0) abstractIdx = header.findIndex((h) => headerLike(h) && (h.includes("abstract") || h.includes("summary")));

  // Row 0 is a header only if it names a title/abstract column or looks
  // bibliographic; otherwise it is data and must be kept.
  const hasHeader = titleIdx >= 0 || abstractIdx >= 0 || pmidIdx >= 0 || header.some((h) => HEADER_KEYS.includes(h));
  // No recognisable title column → fall back to the first two columns.
  const ti = titleIdx >= 0 ? titleIdx : 0;
  const ab = abstractIdx >= 0 ? abstractIdx : titleIdx >= 0 ? -1 : 1;
  const body = hasHeader ? rows.slice(1) : rows;
  const isCovidence = header.includes("covidence #") || header.includes("published year");

  const out: CitationRecord[] = [];
  for (const row of body) {
    const rawPmid = pmidIdx >= 0 ? clean(row[pmidIdx] ?? "") : "";
    const rawDoi = doiIdx >= 0 ? clean(row[doiIdx] ?? "") : "";
    const rawAuthors = authorIdx >= 0 ? clean(row[authorIdx] ?? "") : "";
    const rawYearCell = yearIdx >= 0 ? clean(row[yearIdx] ?? "") : "";
    const ym = rawYearCell.match(/\b(19|20)\d{2}\b/);
    const rawJournal = journalIdx >= 0 ? clean(row[journalIdx] ?? "") : "";
    const rawUrl = urlIdx >= 0 ? clean(row[urlIdx] ?? "") : "";
    const rawKw = kwIdx >= 0 ? clean(row[kwIdx] ?? "") : "";
    const rawNote = noteIdx >= 0 ? String(row[noteIdx] ?? "") : "";
    const rayyan = /RAYYAN-/i.test(rawNote) ? parseRayyanNotes(rawNote) : null;
    const rawDecision = (decIdx >= 0 ? parseDecisionCell(clean(row[decIdx] ?? "")) : undefined) ?? rayyan?.decision;
    const rawReason = (reasonIdx >= 0 ? clean(row[reasonIdx] ?? "") : "") || rayyan?.exclusion_reason || "";
    const tags = rayyan?.tags ?? (rawKw ? rawKw.split(/[;,]/).map((s) => clean(s)).filter(Boolean) : undefined);

    out.push({
      title: clean(row[ti] ?? ""),
      abstract: ab >= 0 ? clean(row[ab] ?? "") : "",
      ...(rawPmid ? { pmid: rawPmid } : {}),
      ...(rawDoi ? { doi: rawDoi } : {}),
      ...(rawAuthors ? { authors: rawAuthors } : {}),
      ...(ym ? { year: ym[0] } : {}),
      ...(rawJournal ? { journal: rawJournal } : {}),
      ...(rawUrl ? { url: rawUrl } : {}),
      ...(tags && tags.length ? { tags } : {}),
      ...(rawDecision ? { decision: rawDecision } : {}),
      ...(rawReason ? { exclusion_reason: rawReason } : {}),
      ...(rayyan?.note ? { note: rayyan.note } : !rayyan && rawNote.trim() ? { note: clean(rawNote) } : {}),
      source: rayyan ? "Rayyan CSV" : isCovidence ? "Covidence CSV" : "CSV",
      format: "csv",
    });
  }
  return out;
}

// ── dispatch ─────────────────────────────────────────────────────────────────

export function parseCitations(text: string, filename = ""): CitationRecord[] {
  const format = detectFormat(text, filename);
  switch (format) {
    case "csv": return parseCsv(text);
    case "ris": return parseRis(text);
    case "endnote": return parseEndnote(text);
    case "medline": return parseMedline(text);
    case "pubmed_summary": return parsePubmedSummary(text);
    case "pubmed_abstract": return parsePubmedAbstract(text);
    case "pmid_list": return parsePmidList(text);
    default: {
      // Unknown extension/content: try the structured parsers first, CSV last.
      for (const attempt of [
        parsePubmedSummary(text),
        parsePubmedAbstract(text),
        parsePmidList(text),
        parseRis(text),
        parseMedline(text),
        parseEndnote(text),
        parseCsv(text),
      ]) {
        if (attempt.length > 0) return attempt;
      }
      return [];
    }
  }
}

// ── ScreeningItem construction ───────────────────────────────────────────────

function uniqueId(seq: number): string {
  const rand =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `imp${Date.now().toString(36)}_${seq}_${rand}`;
}

function deriveTitle(rec: CitationRecord, ordinal: number): string {
  if (rec.title) return rec.title;
  if (rec.abstract) {
    const head = rec.abstract.slice(0, 60).trim();
    return rec.abstract.length > 60 ? `${head}…` : head;
  }
  return `Untitled record #${ordinal}`;
}

export function citationsToScreeningItems(
  records: CitationRecord[],
  stage: ScreeningItem["stage"] = "title_abstract",
  startOrdinal = 1
): ScreeningItem[] {
  const defaultDecision: ScreenDecision = "unset";
  return records.map((rec, i) => ({
    id: uniqueId(startOrdinal + i),
    title: deriveTitle(rec, startOrdinal + i),
    abstract: rec.abstract,
    decision: rec.decision ?? defaultDecision,
    stage,
    ...(rec.pmid ? { pmid: rec.pmid } : {}),
    ...(rec.doi ? { doi: rec.doi } : {}),
    ...(rec.authors ? { authors: rec.authors } : {}),
    ...(rec.year ? { year: rec.year } : {}),
    ...(rec.journal ? { journal: rec.journal } : {}),
    ...(rec.url ? { url: rec.url } : {}),
    ...(rec.tags?.length ? { tags: rec.tags } : {}),
    ...(rec.source ? { source: rec.source } : {}),
    ...(rec.exclusion_reason ? { exclusion_reason: rec.exclusion_reason } : {}),
    ...(rec.note ? { note: rec.note } : {}),
  }));
}

/** One-shot: file text → ScreeningItem[] plus a small report. */
export function importCitationText(
  text: string,
  filename = "",
  stage: ScreeningItem["stage"] = "title_abstract",
  startOrdinal = 1
): ImportResult {
  const format = detectFormat(text, filename);
  const records = parseCitations(text, filename);
  return {
    items: citationsToScreeningItems(records, stage, startOrdinal),
    records: records.length,
    // Records that carried neither a title nor an abstract; they are still
    // imported, labelled "Untitled record #n".
    skipped: records.filter((r) => r.title === "" && r.abstract === "").length,
    format,
  };
}

// ── Citation Manager exports, duplicate clustering & active learning ────────

function escapeCsvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Export ScreeningItem[] or Citation-like records as BibTeX, RIS, or Covidence/Rayyan-friendly CSV. */
export function exportCitationsText(
  items: Pick<
    ScreeningItem,
    "id" | "title" | "abstract" | "authors" | "year" | "journal" | "doi" | "pmid" | "url" | "tags" | "decision" | "stage" | "exclusion_reason" | "note"
  >[],
  format: "bibtex" | "ris" | "csv"
): string {
  if (format === "csv") {
    const header = ["Title", "Authors", "Year", "Journal", "DOI", "PMID", "URL", "Stage", "Decision", "Exclusion Reason", "Tags", "Notes", "Abstract"];
    const rows = items.map((it) =>
      [
        it.title, it.authors ?? "", it.year ?? "", it.journal ?? "", it.doi ?? "", it.pmid ?? "",
        it.url ?? "", it.stage, it.decision, it.exclusion_reason ?? "", (it.tags ?? []).join("; "),
        it.note ?? "", it.abstract,
      ].map((c) => escapeCsvCell(String(c ?? ""))).join(",")
    );
    return [header.join(","), ...rows].join("\n");
  }

  if (format === "ris") {
    return items.map((it) => {
      const lines = ["TY  - JOUR", `TI  - ${it.title}`];
      if (it.authors) {
        for (const a of it.authors.split(/;\s*/).filter(Boolean)) lines.push(`AU  - ${a}`);
      }
      if (it.year) lines.push(`PY  - ${it.year}`);
      if (it.journal) lines.push(`JO  - ${it.journal}`);
      if (it.doi) lines.push(`DO  - ${it.doi}`);
      if (it.pmid) lines.push(`AN  - ${it.pmid}`);
      if (it.url) lines.push(`UR  - ${it.url}`);
      if (it.abstract) lines.push(`AB  - ${it.abstract}`);
      for (const t of it.tags ?? []) lines.push(`KW  - ${t}`);
      lines.push("ER  - ");
      return lines.join("\n");
    }).join("\n\n");
  }

  return items.map((it, idx) => {
    const firstAuthor = (it.authors ?? "study").split(/[;,]/)[0].trim().replace(/[^a-zA-Z0-9]/g, "") || "study";
    const key = `${firstAuthor}${it.year ?? idx + 1}_${idx + 1}`;
    const fields: string[] = [`  title = {${it.title}}`];
    if (it.authors) fields.push(`  author = {${it.authors.replace(/;\s*/g, " and ")}}`);
    if (it.year) fields.push(`  year = {${it.year}}`);
    if (it.journal) fields.push(`  journal = {${it.journal}}`);
    if (it.doi) fields.push(`  doi = {${it.doi}}`);
    if (it.url) fields.push(`  url = {${it.url}}`);
    if (it.abstract) fields.push(`  abstract = {${it.abstract}}`);
    if (it.pmid) fields.push(`  note = {PMID: ${it.pmid}}`);
    return `@article{${key},\n${fields.join(",\n")}\n}`;
  }).join("\n\n");
}

function normTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 72);
}

export interface DuplicateCluster {
  key: string;
  reason: "doi" | "pmid" | "title";
  items: ScreeningItem[];
}

/** Find potential duplicate clusters across records for interactive review & merge. */
export function findDuplicateClusters(items: ScreeningItem[]): DuplicateCluster[] {
  const byDoi = new Map<string, ScreeningItem[]>();
  const byPmid = new Map<string, ScreeningItem[]>();
  const byTitle = new Map<string, ScreeningItem[]>();
  const claimed = new Set<string>();
  const clusters: DuplicateCluster[] = [];

  for (const it of items) {
    const doi = it.doi?.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    if (doi) {
      const arr = byDoi.get(doi) ?? [];
      arr.push(it);
      byDoi.set(doi, arr);
    }
    const pmid = it.pmid?.trim();
    if (pmid) {
      const arr = byPmid.get(pmid) ?? [];
      arr.push(it);
      byPmid.set(pmid, arr);
    }
    const tk = normTitleKey(it.title);
    if (tk.length >= 16) {
      const arr = byTitle.get(tk) ?? [];
      arr.push(it);
      byTitle.set(tk, arr);
    }
  }

  for (const [k, group] of byDoi) {
    if (group.length > 1) {
      clusters.push({ key: `doi:${k}`, reason: "doi", items: group });
      group.forEach((g) => claimed.add(g.id));
    }
  }
  for (const [k, group] of byPmid) {
    const rem = group.filter((g) => !claimed.has(g.id));
    if (rem.length > 1) {
      clusters.push({ key: `pmid:${k}`, reason: "pmid", items: rem });
      rem.forEach((g) => claimed.add(g.id));
    }
  }
  for (const [k, group] of byTitle) {
    const rem = group.filter((g) => !claimed.has(g.id));
    if (rem.length > 1) clusters.push({ key: `title:${k}`, reason: "title", items: rem });
  }
  return clusters;
}

const STOPWORDS = new Set(["the", "and", "for", "with", "from", "that", "this", "were", "was", "are", "into", "using", "study", "patients"]);

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Local ASReview-style active-learning relevance score (PICO + included/excluded decisions). */
export function priorityScoreItem(
  item: Pick<ScreeningItem, "title" | "abstract">,
  includedTexts: string[],
  excludedTexts: string[],
  picoText: string
): number {
  const weights = new Map<string, number>();
  for (const w of tokenize(picoText)) weights.set(w, (weights.get(w) ?? 0) + 1.5);
  for (const doc of includedTexts) {
    for (const w of new Set(tokenize(doc))) weights.set(w, (weights.get(w) ?? 0) + 1.0);
  }
  for (const doc of excludedTexts) {
    for (const w of new Set(tokenize(doc))) weights.set(w, (weights.get(w) ?? 0) - 0.65);
  }
  const tokens = new Set(tokenize(`${item.title} ${item.abstract}`));
  let score = 0;
  for (const t of tokens) score += weights.get(t) ?? 0;
  return score / Math.max(4, Math.sqrt(tokens.size));
}
