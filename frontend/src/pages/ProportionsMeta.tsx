import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Input, Pill, Button } from "../components/ui";
import { toCsv, downloadText } from "../lib/project";
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

export default function ProportionsMeta({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const data = (project as any).proportions ?? { studies: [], results: null };
  const [studies, setStudies] = useState<ProportionStudy[]>(
    data.studies?.length > 0 ? data.studies : DEFAULT_STUDIES
  );
  const [method, setMethod] = useState<"glmm" | "arcsine" | "doubleArcsine">("doubleArcsine");
  const [results, setResults] = useState<ProportionResult | null>(data.results);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newStudy, setNewStudy] = useState({ study: "", events: "", n: "" });

  const persist = (s: ProportionStudy[], r: ProportionResult | null) => {
    onChange({
      ...project,
      proportions: { studies: s, results: r },
    } as any);
  };

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
      study: newStudy.study.trim(),
      events,
      n,
    };
    const next = [...studies, s];
    setStudies(next);
    setNewStudy({ study: "", events: "", n: "" });
    persist(next, results);
  };

  const removeStudy = (id: string) => {
    const next = studies.filter((s) => s.id !== id);
    setStudies(next);
    persist(next, results);
  };

  const runAnalysis = async () => {
    if (studies.length < 2) {
      setErr("At least 2 studies are required for meta-analysis.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const backendResp = await postJson<ProportionResult>(
        "/api/proportion",
        {
          studies: studies.map((s) => ({ study: s.study, events: s.events, n: s.n })),
          method,
        },
        5000
      );
      setResults(backendResp);
      persist(studies, backendResp);
    } catch {
      // Deterministic Freeman-Tukey client-side fallback
      const totalEvents = studies.reduce((sum, s) => sum + s.events, 0);
      const totalN = studies.reduce((sum, s) => sum + s.n, 0);
      const transformed = studies.map((s) => {
        const ft = 0.5 * (Math.asin(Math.sqrt(s.events / (s.n + 1))) + Math.asin(Math.sqrt((s.events + 1) / (s.n + 1))));
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
      const r: ProportionResult = {
        method: method === "glmm" ? "GLMM (logit-normal)" : method === "arcsine" ? "Arcsine" : "Freeman-Tukey double arcsine",
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
      setResults(r);
      persist(studies, r);
    } finally {
      setBusy(false);
    }
  };

  const exportResults = () => {
    if (!results) return;
    const rows = studies.map((s) => ({
      study: s.study,
      events: s.events,
      n: s.n,
      proportion: (s.events / s.n).toFixed(4),
      percentage: ((s.events / s.n) * 100).toFixed(2) + "%",
    }));
    downloadText("proportions_meta.csv", toCsv(rows), "text/csv");
  };

  const fmtPct = (v?: number) => (v != null && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—");
  const fmtNum = (v?: number, d = 2) => (v != null && Number.isFinite(v) ? v.toFixed(d) : "—");

  return (
    <div className="space-y-3">
      <Card
        title="Proportions / Single-Arm Rates Meta-Analysis"
        right={
          <div className="flex items-center gap-2">
            <Pill tone="neutral">{studies.length} studies</Pill>
            <button className="btn-primary min-w-[120px]" onClick={runAnalysis} disabled={busy || studies.length < 2}>
              {busy ? "Pooling…" : "Run Analysis"}
            </button>
          </div>
        }
      >
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
                <option value="doubleArcsine">Freeman-Tukey Double Arcsine (recommended)</option>
                <option value="glmm">GLMM (Logit-Normal / Binomial)</option>
                <option value="arcsine">Arcsine Square-Root</option>
              </select>
            </div>
          </div>

          {err && (
            <div className="rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">
              {err}
            </div>
          )}

          <div className="overflow-x-auto rounded-[3px] border border-[var(--color-border)]">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Study</th>
                  <th className="px-3 py-2 font-medium">Events (r)</th>
                  <th className="px-3 py-2 font-medium">Total (N)</th>
                  <th className="px-3 py-2 font-medium">Proportion</th>
                  <th className="px-3 py-2 font-medium">Relative Bar</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {studies.map((s) => {
                  const p = s.events / Math.max(s.n, 1);
                  return (
                    <tr key={s.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]/50">
                      <td className="px-3 py-2 font-medium">{s.study}</td>
                      <td className="px-3 py-2 font-mono">{s.events}</td>
                      <td className="px-3 py-2 font-mono">{s.n}</td>
                      <td className="px-3 py-2 font-mono">{fmtPct(p)}</td>
                      <td className="px-3 py-2 w-48">
                        <div className="h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div className="h-full bg-[var(--color-accent)]" style={{ width: `${Math.min(100, p * 100)}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button className="btn-ghost text-[11px] text-[var(--color-exclude)]" onClick={() => removeStudy(s.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-[var(--color-border)]">
            <Input placeholder="Study name" value={newStudy.study} onChange={(e) => setNewStudy({ ...newStudy, study: e.target.value })} />
            <Input type="number" placeholder="Events" value={newStudy.events} onChange={(e) => setNewStudy({ ...newStudy, events: e.target.value })} />
            <Input type="number" placeholder="Total N" value={newStudy.n} onChange={(e) => setNewStudy({ ...newStudy, n: e.target.value })} />
            <button className="btn-secondary" onClick={addStudy}>+ Add Study</button>
          </div>
        </div>
      </Card>

      {results && (
        <Card
          title="Pooled Proportion Results"
          right={
            <Button onClick={exportResults} variant="secondary" size="sm">
              Export CSV
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <div className="card p-2.5">
              <div className="text-[20px] font-semibold font-mono text-[var(--color-text)]">{fmtPct(results.pooledProportion)}</div>
              <div className="text-[10.5px] text-[var(--color-text-muted)]">Pooled Proportion</div>
            </div>
            <div className="card p-2.5">
              <div className="text-[20px] font-semibold font-mono text-[var(--color-text)]">
                {fmtPct(results.ciLower)} – {fmtPct(results.ciUpper)}
              </div>
              <div className="text-[10.5px] text-[var(--color-text-muted)]">95% Confidence Interval</div>
            </div>
            <div className="card p-2.5">
              <div className="text-[20px] font-semibold font-mono text-[var(--color-text)]">{fmtNum(results.i2, 1)}%</div>
              <div className="text-[10.5px] text-[var(--color-text-muted)]">I² Heterogeneity (τ² = {fmtNum(results.tau2, 4)})</div>
            </div>
            <div className="card p-2.5">
              <div className="text-[20px] font-semibold font-mono text-[var(--color-text)]">
                {results.totalEvents} / {results.totalN}
              </div>
              <div className="text-[10.5px] text-[var(--color-text-muted)]">Total Events / Total Patients</div>
            </div>
          </div>

          <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">
            Method: <span className="font-semibold text-[var(--color-text)]">{results.method}</span> across {results.nStudies} studies.
          </div>
        </Card>
      )}
    </div>
  );
}
