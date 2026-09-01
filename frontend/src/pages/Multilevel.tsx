import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Select, Pill } from "../components/ui";
import { postJson } from "../lib/api";

interface MLevelStudy {
  study: string;
  effectId: string;
  effect: number | null;
  se: number | null;
  outcome: string;
}

interface MultilevelResult {
  method: string;
  pooledEffect: number;
  ciLower: number;
  ciUpper: number;
  se: number;
  p: number;
  q: number;
  i2: number;
  tau2Within: number;
  tau2Between: number;
  i2Level1: number;
  i2Level2: number;
  i2Level3: number;
  nStudies: number;
  nEffects: number;
  lrtStat: number | null;
  lrtP: number | null;
  rveRho: number | null;
  rveDf: number | null;
  rveAdjustedSe: number | null;
  warnings: string[];
}

const METHODS = [
  { value: "threeLevel", label: "Three-Level" },
  { value: "multivariate", label: "Multivariate" },
  { value: "rve", label: "RVE" },
];

export default function Multilevel({ project: _project, onChange: _onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [studies, setStudies] = useState<MLevelStudy[]>([]);
  const [method, setMethod] = useState("threeLevel");
  const [rho, setRho] = useState(0.5);
  const [result, setResult] = useState<MultilevelResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addStudy = () => {
    setStudies([...studies, { study: `S${studies.length + 1}`, effectId: "", effect: null, se: null, outcome: "" }]);
  };

  const updateStudy = (i: number, patch: Partial<MLevelStudy>) => {
    setStudies(studies.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const removeStudy = (i: number) => {
    setStudies(studies.filter((_, idx) => idx !== i));
  };

  const run = async () => {
    if (studies.length < 2) { setErr("At least 2 effects required"); return; }
    if (studies.some(s => s.effect === null || s.se === null)) {
      setErr("All effects need a value and SE"); return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson<MultilevelResult>("/api/multilevel", {
        studies: studies.map(s => ({
          study: s.study,
          effectId: s.effectId || undefined,
          effect: s.effect,
          se: s.se,
          outcome: s.outcome || undefined
        })),
        method,
        assumedRho: rho
      });
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v: number, d = 3) => v.toFixed(d);

  return (
    <div className="space-y-3">
      <Card title="Multilevel / Multivariate Meta-Analysis" right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{studies.length} effects</Pill>
          <button className="btn-primary" onClick={run} disabled={busy}>
            {busy ? "Running…" : "Run"}
          </button>
        </div>
      }>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Method</div>
            <Select value={method} onChange={e => setMethod(e.target.value)}>
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </div>
          {method === "rve" && (
            <div>
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Assumed ρ</div>
              <input type="number" min="0" max="1" step="0.1" value={rho}
                onChange={e => setRho(Number(e.target.value))}
                className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-[12px]" />
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-semibold">Effects (multiple per study allowed)</div>
            <button className="btn-ghost" onClick={addStudy}>+ Add effect</button>
          </div>
          <div className="space-y-1.5">
            {studies.map((s, i) => (
              <div key={i} className="grid grid-cols-7 gap-1.5 rounded border border-[var(--color-border)] p-1.5">
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Study" value={s.study}
                  onChange={e => updateStudy(i, { study: e.target.value })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Effect ID" value={s.effectId}
                  onChange={e => updateStudy(i, { effectId: e.target.value })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Outcome" value={s.outcome}
                  onChange={e => updateStudy(i, { outcome: e.target.value })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Effect" type="number" step="any"
                  value={s.effect ?? ""} onChange={e => updateStudy(i, { effect: e.target.value ? Number(e.target.value) : null })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="SE" type="number" step="any"
                  value={s.se ?? ""} onChange={e => updateStudy(i, { se: e.target.value ? Number(e.target.value) : null })} />
                <button className="col-span-1 text-[10px] text-[var(--color-exclude)]" onClick={() => removeStudy(i)}>remove</button>
              </div>
            ))}
          </div>
        </div>

        {err && <div className="mt-2 rounded border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
      </Card>

      {result && (
        <>
          {result.warnings.length > 0 && (
            <Card title="Warnings">
              {result.warnings.map((w, i) => (
                <div key={i} className="text-[12px] text-amber-500">{w}</div>
              ))}
            </Card>
          )}

          <Card title="Pooled Result">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{fmt(result.pooledEffect)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Pooled effect</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">[{fmt(result.ciLower)}, {fmt(result.ciUpper)}]</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">95% CI</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{fmt(result.p)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">p-value</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{result.i2.toFixed(1)}%</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">I²</div>
              </div>
            </div>
          </Card>

          {result.method.includes("Three-level") && (
            <Card title="Variance Decomposition">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{fmt(result.tau2Between)}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">τ² between</div>
                </div>
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{fmt(result.tau2Within)}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">τ² within</div>
                </div>
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{result.i2Level3.toFixed(1)}%</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">I² between</div>
                </div>
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{result.i2Level2.toFixed(1)}%</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">I² within</div>
                </div>
              </div>
              {result.lrtStat !== null && (
                <div className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                  LRT (3-level vs 2-level): χ² = {fmt(result.lrtStat, 2)}, p = {fmt(result.lrtP ?? 0)}
                </div>
              )}
            </Card>
          )}

          {result.method.includes("RVE") && (
            <Card title="RVE Details">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{fmt(result.rveAdjustedSe ?? 0)}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">Adjusted SE</div>
                </div>
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{result.rveDf?.toFixed(1) ?? "—"}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">Satterthwaite df</div>
                </div>
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{result.rveRho?.toFixed(2) ?? "—"}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">Assumed ρ</div>
                </div>
              </div>
            </Card>
          )}

          <Card title="Study Summary">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{result.nStudies}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Studies</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{result.nEffects}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Effects</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{fmt(result.q, 2)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Q statistic</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
