"use client";

/** 2.2 Import from Rayyan/Covidence — column mapping + preview. */

export interface RayyanRow {
  [key: string]: string;
}

export function parseRayyanCsv(text: string): RayyanRow[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(c => c.trim().replace(/"/g, ""));
    const row: RayyanRow = {};
    header.forEach((h, i) => { row[h] = cells[i] || ""; });
    return row;
  });
}

export function parseCovidenceCsv(text: string): RayyanRow[] {
  return parseRayyanCsv(text);
}

export function mapRayyanToItem(row: RayyanRow, idx: number): {
  id: string;
  title: string;
  abstract: string;
  decision: "include" | "exclude" | "unsure" | "unset";
  exclusion_reason?: string;
} | null {
  const title = row["Title"] || row["title"] || row["TI"] || "";
  if (!title) return null;

  const abstract = row["Abstract"] || row["abstract"] || row["AB"] || "";
  const decisionRaw = (row["Decision"] || row["decision"] || row["Include?"] || "").toLowerCase();
  const decision: "include" | "exclude" | "unset" =
    decisionRaw.includes("include") ? "include" :
    decisionRaw.includes("exclude") ? "exclude" : "unset";

  const exclusionReason = row["Exclusion Reason"] || row["reason"] || "";

  return {
    id: `rayyan_${idx}_${Date.now()}`,
    title,
    abstract,
    decision,
    exclusion_reason: exclusionReason || undefined,
  };
}

export interface ImportPreview {
  total: number;
  mapped: number;
  unmapped: string[];
  items: Array<ReturnType<typeof mapRayyanToItem>>;
}

export function generateImportPreview(text: string, source: "rayyan" | "covidence"): ImportPreview {
  const rows = source === "covidence" ? parseCovidenceCsv(text) : parseRayyanCsv(text);
  const items = rows.map((row, i) => mapRayyanToItem(row, i)).filter(Boolean);
  return {
    total: rows.length,
    mapped: items.length,
    unmapped: rows.filter((_, i) => !items[i]).map(r => r["Title"] || r["title"] || "?"),
    items: items as any,
  };
}
