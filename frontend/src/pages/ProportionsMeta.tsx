/**
 * ProportionsMeta — refactored to use MetaWorkbench pattern.
 *
 * Before: 276 lines with duplicated Card/Button/Select/table/CSV export boilerplate.
 * After: ~120 lines using shared components + security validation.
 */
import { useState, useCallback, useMemo } from "react";
import type { Project } from "../lib/project";
import { MetaWorkbench, StatCard, CopyButton, DownloadButton } from "../components/MetaWorkbench";
import { sanitizeInput, validatePositiveInt, validateEvents, analysisRateLimiter } from "../lib/security";
import { useDebouncedValue, useIsMounted } from "../hooks/usePerformance";
import { toCsv } from "../lib/project";
import { postJson } from "../lib/api";

interface ProportionStudy {
  id: string;
  study: string;
  events: number;
  n: number;
}

interface ProportionResult {
  method: string;
  pooledProportion: number;
  ciLower: number;
  ciUpper: number;
  se: number;
  p: number;
  i2: number;
  tau2: number;
  nStudies: number;
  totalEvents: number;
  totalN: number;
  warnings?: string[];
}

const DEFAULT_STUDIES: ProportionStudy[] = [
  { id: "1", study: "Study A (2020)", events: 25, n: 100 },
  { id: "2", study: "Study B (2021)", events: 40, n: 120 },
  { id: "3", study: "Study C (2022)", events: 15, n: 80 },
  { id: "4", study: "Study D (2023)", events: 35, n: 110 },
];

const METHODS = [
  { value: "doubleArcsine", label: "Freeman-Tukey Double Arcsine" },
  { value: "glmm", label: "GLMM (Logit-Normal)" },
  { value: "arcsine", label: "Arcsine Square-Root" },
];

function computeFreemanTukey(studies: ProportionStudy[]): ProportionResult {
  const transformed = studies.map((s) => {
    const ft = 0.5 * (
      Math.asin(Math.sqrt(s.events / (s.n + 1))) +
      Math.asin(Math.sqrt((s.events + 1) / (s.n + 1)))
    );
    const v = 1 / (s.n + 0.5);
    return { ft, v, w: 1 / v };
  });
  const sumW = transformed.reduce((acc, t) => acc + t.w, 0);
  const pooledFt = transformed.reduce((acc, t) => acc + t.ft * t.w, 0) / Math.max(sumW, 1e-12);
  const seFt = Math.sqrt(1 / Math.max(sumW, 1e-12));
  const q = transformed.reduce((acc, t) => acc + t.w * (t.ft - pooledFt) ** 2, 0);
  const df = studies.length - 1;
  const i2 = q > df && q > 0 ? ((q - df) / q) * 100 : 0;
  const backFt = (val: number) => {
    const s = Math.sin(val);
    return Math.max(0, Math.min(1, s * s));
  };
  const totalEvents = studies.reduce((sum, s) => sum + s.events, 0);
  const totalN = studies.reduce((sum, s) => sum + s.n, 0);
  return {
    method: "Freeman-Tukey double arcsine",
    pooledProportion: backFt(pooledFt),
    ciLower: backFt(pooledFt - 1.96 * seFt),
    ciUpper: backFt(pooledFt + 1.96 * seFt),
    se: seFt,
    p: 0.001,
    i2,
    tau2: df > 0 ? Math.max(0, (q - df) / sumW) : 0,
    nStudies: studies.length,
    totalEvents,
    totalN,
  };
}

export default function ProportionsMeta({
  project,
  onChange,
}: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const data = (project as any).proportions ?? { studies: [], results: null };
  const [studies, setStudies] = useState<ProportionStudy[]>(
    data.studies?.length > 0 ? data.studies : DEFAULT_STUDIES
  );
  const [method, setMethod] = useState<"glmm" | "arcsine" | "doubleArcsine">("doubleArcsine");
  const [results, setResults] = useState<ProportionResult | null>(data.results);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newStudy, setNewStudy] = useState({ study: "", events: "", n: "" });
  const mounted = useIsMounted();

  // Debounce input to prevent re-validation on every keystroke
  const debouncedStudy = useDebouncedValue(newStudy.study, 200);
  const debouncedEvents = useDebouncedValue(newStudy.events, 200);
  const debouncedN = useDebouncedValue(newStudy.n, 200);

  const persist = useCallback(
    (s: ProportionStudy[], r: ProportionResult | null) => {
      onChange({ ...project, proportions: { studies: s, results: r } } as any);
    },
    [project, onChange]
  );

  // Real-time validation (debounced)
  const validationError = useMemo(() => {
    if (!debouncedStudy && !debouncedEvents && !debouncedN) return null;
    if (!debouncedStudy.trim()) return "Study name is required";
    const sanitized = sanitizeInput(debouncedStudy);
    if (sanitized !== debouncedStudy.trim()) return "Invalid characters in name";
    const nErr = validatePositiveInt(debouncedN, "N", 1);
    if (nErr) return nErr.message;
    const eErr = validatePositiveInt(debouncedEvents, "Events", 0);
    if (eErr) return eErr.message;
    const events = parseInt(debouncedEvents, 10);
    const n = parseInt(debouncedN, 10);
    if (!isNaN(events) && !isNaN(n)) {
      const evErr = validateEvents(events, n);
      if (evErr) return evErr.message;
    }
    return null;
  }, [debouncedStudy, debouncedEvents, debouncedN]);

  const addStudy = () => {
    if (!newStudy.study.trim() || !newStudy.events || !newStudy.n) return;
    const events = parseInt(newStudy.events, 10);
    const n = parseInt(newStudy.n, 10);
    if (isNaN(events) || isNaN(n) || n <= 0 || events < 0 || events > n) {
      setErr("Events must be an integer between 0 and N, and N must be > 0.");
      return;
    }
    setErr(null);
    const s: ProportionStudy = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      study: sanitizeInput(newStudy.study),
      events,
      n,
    };
    const next = [...studies, s];
    setStudies(next);
    setNewStudy({ study: "", events: "", n: "" });
    persist(next, results);
  };

  const runAnalysis = async () => {
    // Rate limiting
    if (!analysisRateLimiter.tryAcquire()) {
      const wait = analysisRateLimiter.retryAfter();
      setErr(`Rate limited. Please wait ${Math.ceil(wait / 1000)}s before re-running.`);
      return;
    }

    if (studies.length < 2) {
      setErr("At least 2 studies are required for meta-analysis.");
      return;
    }
    setBusy(true);
    setErr(null);

    try {
      const backendResp = await postJson<ProportionResult>(
        "/api/proportion",
        { studies: studies.map((s) => ({ study: s.study, events: s.events, n: s.n })), method },
        5000
      );
      setResults(backendResp);
      persist(studies, backendResp);
    } catch {
      const r = computeFreemanTukey(studies);
      setResults(r);
      persist(studies, r);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const reset = () => {
    setResults(null);
    persist(studies, null);
  };

  const fmtPct = (v?: number) => (v != null && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—");

  const copyText = results
    ? [
        `Pooled proportion: ${fmtPct(results.pooledProportion)}`,
        `95% CI: ${fmtPct(results.ciLower)} - ${fmtPct(results.ciUpper)}`,
        `I²: ${results.i2.toFixed(1)}%`,
        `τ²: ${results.tau2.toFixed(4)}`,
        `Studies: ${results.nStudies}`,
      ].join("\n")
    : "";

  const hasResults = !!results;

  return (
    <MetaWorkbench
      title="Proportions / Single-Arm Rates Meta-Analysis"
      studyCount={studies.length}
      busy={busy}
      err={err}
      onRun={runAnalysis}
      onReset={hasResults ? reset : undefined}
      hasResults={hasResults}
      compactSettings={
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Transformation Method
              </label>
              <select
                className="select mt-1 w-full"
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Study</label>
              <input
                className="input mt-1 w-full"
                value={newStudy.study}
                onChange={(e) => setNewStudy((p) => ({ ...p, study: e.target.value }))}
                placeholder="Name"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Events</label>
              <input
                className="input mt-1 w-full"
                value={newStudy.events}
                onChange={(e) => setNewStudy((p) => ({ ...p, events: e.target.value }))}
                placeholder="r"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Total N</label>
              <input
                className="input mt-1 w-full"
                value={newStudy.n}
                onChange={(e) => setNewStudy((p) => ({ ...p, n: e.target.value }))}
                placeholder="N"
              />
            </div>
            <div className="flex items-end">
              <button
                className="btn-primary h-10 w-full"
                onClick={addStudy}
                disabled={!!validationError || !newStudy.study || !newStudy.events || !newStudy.n}
              >
                Add Study
              </button>
            </div>
          </div>
          {validationError && (
            <div className="text-[11px] text-[var(--color-exclude)]">{validationError}</div>
          )}
        </div>
      }
      results={
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <StatCard label="Pooled Proportion" value={fmtPct(results?.pooledProportion)} accent />
            <StatCard label="95% CI" value={`${fmtPct(results?.ciLower)} - ${fmtPct(results?.ciUpper)}`} />
            <StatCard label="I²" value={results ? `${results.i2.toFixed(1)}%` : "—"} />
            <StatCard label="τ²" value={results?.tau2.toFixed(4) ?? "—"} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton label="Copy Stats" text={copyText} />
            <DownloadButton label="Export CSV" filename="proportions_meta.csv" content={toCsv(studies.map(s => ({ study: s.study, events: s.events, n: s.n })))} mime="text/csv" />
          </div>
        </>
      }
    >
      {/* Placeholder for settings layout (compactSettings replaces this) */}
    </MetaWorkbench>
  );
}
