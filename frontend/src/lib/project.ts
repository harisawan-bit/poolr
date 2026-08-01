// Shared project model + engine client helpers for Phase D pages.

// ── Engine request/response types (mirror engine/Poolr.Engine.Api/Models.cs) ──
export interface Study {
  study?: string;
  type?: "binary" | "continuous" | "survival";
  int_events?: number | null;
  int_n?: number | null;
  ctrl_events?: number | null;
  ctrl_n?: number | null;
  int_mean?: number | null;
  int_sd?: number | null;
  ctrl_mean?: number | null;
  ctrl_sd?: number | null;
  hr?: number | null;
  hr_lower?: number | null;
  hr_upper?: number | null;
  subgroup?: string;
  design?: string;
  year?: number | null;
}

export interface MetaRequest {
  model?: "random" | "fixed";
  measure?: "OR" | "RR" | "RD" | "MD" | "SMD" | "HR";
  method?: "DL" | "REML" | "PM" | "HS" | "ML" | "EB";
  subgroup?: string;
  pub_bias?: "none" | "egger" | "begg" | "all";
  data?: Study[];
}

export interface StudyResult {
  study: string;
  effect: number;
  ci_lower: number;
  ci_upper: number;
  weight: number;
  subgroup: string;
}
export interface PooledResult {
  effect: number;
  ci_lower: number;
  ci_upper: number;
  se: number;
  z: number;
  p: number;
  model: string;
}
export interface Heterogeneity {
  q: number;
  df: number;
  q_p: number;
  i2: number;
  tau2: number;
  tau: number;
}
export interface SubgroupResult {
  name: string;
  measure: string;
  effect: number;
  ci_lower: number;
  ci_upper: number;
  k: number;
}
export interface EggerResult {
  intercept: number;
  p_value: number;
  significant: boolean;
  note?: string;
}
export interface BeggResult {
  tau: number;
  p_value: number;
  significant: boolean;
}
export interface PublicationBias {
  egger?: EggerResult | null;
  begg?: BeggResult | null;
  trimfill?: unknown | null;
}
export interface MetaResponse {
  model: string;
  measure: string;
  method: string;
  k: number;
  studies: StudyResult[];
  pooled: PooledResult;
  heterogeneity: Heterogeneity;
  subgroups?: SubgroupResult[] | null;
  publication_bias?: PublicationBias | null;
}

// ── GRADE ──
export interface GradeOutcomeInput {
  outcome?: string;
  studies?: number;
  design?: string;
  risk_of_bias?: string;
  inconsistency?: string;
  indirectness?: string;
  imprecision?: string;
  publication_bias?: string;
}
export interface GradeRow {
  outcome: string;
  studies: number;
  design: string;
  risk_of_bias: string;
  inconsistency: string;
  indirectness: string;
  imprecision: string;
  publication_bias: string;
  starting_certainty: string;
  final_certainty: string;
  downgrade_reasons: string;
}

// ── Domain project model ──
export type ScreenDecision = "include" | "exclude" | "unsure" | "unset";

export interface Pico {
  population: string;
  intervention: string;
  comparator: string;
  outcomes: string;
}
export interface ScreeningItem {
  id: string;
  title: string;
  abstract: string;
  decision: ScreenDecision;
  stage: "title_abstract" | "full_text";
  note?: string;
}
export interface ProtocolData {
  databases: string;
  registration: string;
  objective: string;
}
export interface ExtractedStudy {
  study: string;
  type: "binary" | "continuous" | "survival";
  int_events?: number | null;
  int_n?: number | null;
  ctrl_events?: number | null;
  ctrl_n?: number | null;
  int_mean?: number | null;
  int_sd?: number | null;
  ctrl_mean?: number | null;
  ctrl_sd?: number | null;
  hr?: number | null;
  hr_lower?: number | null;
  hr_upper?: number | null;
  subgroup?: string;
  design?: string;
  year?: number | null;
}
export interface RobAssessment {
  id: string;
  study: string;
  tool: "RoB2" | "NOS" | "PROBAST";
  overall: "Low" | "Some concerns" | "High" | "—";
  domains: Record<string, string>;
}
export interface SearchDb {
  name: string;
  query: string;
  results: number | null;
}
export interface PrismaFlow {
  identified: number | null;
  duplicates: number | null;
  screened: number | null;
  excludedTa: number | null;
  fullText: number | null;
  excludedFt: number | null;
  included: number | null;
}

export interface Project {
  metadata: { version: string; created: string; title?: string };
  pico: Pico;
  protocol: ProtocolData;
  screening: { title_abstract: ScreeningItem[]; full_text: ScreeningItem[] };
  extraction: { studies: ExtractedStudy[] };
  rob: { assessments: RobAssessment[] };
  meta: { results: MetaResponse | null; settings: MetaRequest };
  prisma: { flow: PrismaFlow; grade: GradeOutcomeInput[] };
  search?: { databases: SearchDb[] };
}

export function emptyProject(): Project {
  return {
    metadata: { version: "0.4.0", created: new Date().toISOString(), title: "Untitled review" },
    pico: { population: "", intervention: "", comparator: "", outcomes: "" },
    protocol: { databases: "PubMed, Embase, Cochrane CENTRAL, Scopus", registration: "Not registered", objective: "" },
    screening: { title_abstract: [], full_text: [] },
    extraction: { studies: [] },
    rob: { assessments: [] },
    meta: { results: null, settings: { model: "random", measure: "OR", method: "DL", subgroup: "none", pub_bias: "none", data: [] } },
    prisma: { flow: { identified: null, duplicates: null, screened: null, excludedTa: null, fullText: null, excludedFt: null, included: null }, grade: [] },
    search: { databases: [] },
  };
}

/**
 * Coerce anything that came off disk / the engine / a user-picked .json into a
 * Project that every page can render without optional-chaining every access.
 * Missing or wrong-typed branches fall back to emptyProject() defaults, so a
 * truncated or older-schema poolr.json can never white-screen the app.
 */
export function normalizeProject(raw: unknown): Project {
  const base = emptyProject();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, any>;
  const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
  const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const metadata = obj(r.metadata);
  const pico = obj(r.pico);
  const protocol = obj(r.protocol);
  const screening = obj(r.screening);
  const extraction = obj(r.extraction);
  const rob = obj(r.rob);
  const meta = obj(r.meta);
  const prisma = obj(r.prisma);
  const search = obj(r.search);
  const flow = obj(prisma.flow);

  const validDecision = (v: unknown): ScreenDecision =>
    v === "include" || v === "exclude" || v === "unsure" ? v : "unset";

  const items = (v: unknown, stage: ScreeningItem["stage"]): ScreeningItem[] =>
    arr<Record<string, any>>(v)
      .filter((i) => i && typeof i === "object")
      .map((i, idx) => ({
        id: str(i.id) || `x${idx}_${Math.random().toString(36).slice(2, 8)}`,
        title: str(i.title),
        abstract: str(i.abstract),
        decision: validDecision(i.decision),
        stage: i.stage === "full_text" || i.stage === "title_abstract" ? i.stage : stage,
        ...(typeof i.note === "string" ? { note: i.note } : {}),
      }));

  const validTool = (v: unknown): RobAssessment["tool"] => (v === "NOS" || v === "PROBAST" ? v : "RoB2");
  const validOverall = (v: unknown): RobAssessment["overall"] =>
    v === "Low" || v === "Some concerns" || v === "High" ? v : "—";

  return {
    metadata: {
      version: str(metadata.version, base.metadata.version),
      created: str(metadata.created, base.metadata.created),
      title: str(metadata.title, base.metadata.title),
    },
    pico: {
      population: str(pico.population),
      intervention: str(pico.intervention),
      comparator: str(pico.comparator),
      outcomes: str(pico.outcomes),
    },
    protocol: {
      databases: str(protocol.databases, base.protocol.databases),
      registration: str(protocol.registration, base.protocol.registration),
      objective: str(protocol.objective),
    },
    screening: {
      title_abstract: items(screening.title_abstract, "title_abstract"),
      full_text: items(screening.full_text, "full_text"),
    },
    extraction: {
      studies: arr<Record<string, any>>(extraction.studies)
        .filter((s) => s && typeof s === "object")
        .map((s) => ({
          ...(s as ExtractedStudy),
          study: str(s.study),
          type: s.type === "continuous" || s.type === "survival" ? s.type : "binary",
        })),
    },
    rob: {
      assessments: arr<Record<string, any>>(rob.assessments)
        .filter((a) => a && typeof a === "object")
        .map((a, idx) => ({
          id: str(a.id) || `r${idx}_${Math.random().toString(36).slice(2, 8)}`,
          study: str(a.study),
          tool: validTool(a.tool),
          overall: validOverall(a.overall),
          domains: obj(a.domains) as Record<string, string>,
        })),
    },
    meta: {
      results: meta.results && typeof meta.results === "object" ? (meta.results as MetaResponse) : null,
      settings: { ...base.meta.settings, ...obj(meta.settings), data: arr<Study>(obj(meta.settings).data) },
    },
    prisma: {
      flow: {
        identified: numOrNull(flow.identified),
        duplicates: numOrNull(flow.duplicates),
        screened: numOrNull(flow.screened),
        excludedTa: numOrNull(flow.excludedTa),
        fullText: numOrNull(flow.fullText),
        excludedFt: numOrNull(flow.excludedFt),
        included: numOrNull(flow.included),
      },
      grade: arr<GradeOutcomeInput>(prisma.grade),
    },
    search: { databases: arr<Record<string, any>>(search.databases).filter((d) => d && typeof d === "object").map((d) => ({ name: str(d.name), query: str(d.query), results: numOrNull(d.results) })) },
  };
}

// ── Engine client additions (extends api.ts) ──
import { ENGINE_URL, postJson } from "./api";

export async function runMeta(req: MetaRequest): Promise<MetaResponse> {
  return postJson<MetaResponse>("/api/meta", req);
}
export async function runGrade(req: { outcomes?: GradeOutcomeInput[]; meta?: MetaResponse | null; rob?: { overall?: string }[] }): Promise<GradeRow[]> {
  return postJson<GradeRow[]>("/api/grade", req);
}
export async function getFigure(kind: "forest" | "funnel", resp: MetaResponse): Promise<string> {
  let r: Response;
  try {
    r = await fetch(`${ENGINE_URL}/api/figure/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resp),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(`Engine offline — could not render the ${kind} plot (${ENGINE_URL}).`);
  }
  if (!r.ok) throw new Error(`figure ${kind} failed (${r.status})`);
  return r.text();
}

// ── Citation import (see lib/importScreening.ts) ──
export {
  CITATION_ACCEPT,
  citationsToScreeningItems,
  detectFormat,
  importCitationText,
  parseCitations,
  parseCsv,
  parseEndnote,
  parseMedline,
  parseRis,
} from "./importScreening";
export type { CitationFormat, CitationRecord, ImportResult } from "./importScreening";

/** Append screening items to a stage, returning a new Project (autosave-friendly). */
export function mergeScreeningItems(
  project: Project,
  stage: ScreeningItem["stage"],
  incoming: ScreeningItem[]
): Project {
  const existing = project.screening[stage] ?? [];
  const seen = new Set(existing.map((i) => i.id));
  const added = incoming
    .filter((i) => !seen.has(i.id))
    .map((i) => ({ ...i, stage }));
  return {
    ...project,
    screening: { ...project.screening, [stage]: [...existing, ...added] },
  };
}

// Tiny CSV builder helper.
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  // Firefox only fires the download for anchors attached to the document, and
  // revoking synchronously can cancel the transfer — defer the cleanup.
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
}
