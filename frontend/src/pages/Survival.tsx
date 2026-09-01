import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Select, Pill } from "../components/ui";
import { postJson } from "../lib/api";

interface RmstStudyInput {
  study: string;
  rmstDiff: number | null;
  se: number | null;
}

interface RmstResult {
  pooledRmstDiff: number;
  ciLower: number;
  ciUpper: number;
  se: number;
  p: number;
  i2: number;
  tau2: number;
  nStudies: number;
  tauSensitivity: Array<{ tau: number; pooled: number; lo: number; hi: number }>;
}

interface CumulativeEntry {
  study: string;
  k: number;
  pooledEffect: number;
  ciLower: number;
  ciUpper: number;
  i2: number;
}

interface CumulativeResult {
  cumulative: CumulativeEntry[];
  finalPooledEffect: number;
  finalCiLower: number;
  finalCiUpper: number;
  finalI2: number;
}

const TYPES = [
  { value: "rmst", label: "RMST Meta-Analysis" },
  { value: "cumulative", label: "Cumulative Meta-Analysis" },
];

export default function Survival({ project: _project, onChange: _onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [type, setType] = useState("rmst");
  const [studies, setStudies] = useState<RmstStudyInput[]>([]);
  const [rmstResult, setRmstResult] = useState<RmstResult | null>(null);
  const [cumulResult, setCumulResult] = useState<CumulativeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addStudy = () => {
    setStudies([...studies, { study: `S${studies.length + 1}`, rmstDiff: null, se: null }]);
  };

  const updateStudy = (i: number, patch: Partial<RmstStudyInput>) => {
    setStudies(studies.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const removeStudy = (i: number) => {
    setStudies(studies.filter((_, idx) => idx !== i));
  };

  const run = async () => {
    if (studies.length < 2) { setErr("At least 2 studies required"); return; }
    if (studies.some(s => s.rmstDiff === null || s.se === null)) {
      setErr("All studies need RMST diff and SE"); return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (type === "rmst") {
        const res = await postJson<RmstResult>("/api/survival", {
          type: "rmst",
          request: {
            studies: studies.map(s => ({ study: s.study, rmstDiff: s.rmstDiff, se: s.se })),
            tau: 5.0
          }
        });
        setRmstResult(res);
      } else {
        const res = await postJson<CumulativeResult>("/api/living/cumulative", {
          studies: studies.map((s, i) => ({
            study: s.study,
            effect: s.rmstDiff,
            se: s.se,
            year: 2020 + i,
            dateAdded: new Date(2024, i).toISOString()
          })),
          chronological: true
        });
        setCumulResult(res);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v: number, d = 3) => v.toFixed(d);

  return (
    <div className="space-y-3">
      <Card title="Survival Extensions" right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{studies.length} studies</Pill>
          <button className="btn-primary" onClick={run} disabled={busy}>
            {busy ? "Running…" : "Run"}
          </button>
        </div>
      }>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Type</div>
            <Select value={type} onChange={e => { setType(e.target.value); setRmstResult(null); setCumulResult(null); }}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-semibold">Studies</div>
            <button className="btn-ghost" onClick={addStudy}>+ Add study</button>
          </div>
          <div className="space-y-1.5">
            {studies.map((s, i) => (
              <div key={i} className="grid grid-cols-4 gap-1.5 rounded border border-[var(--color-border)] p-1.5">
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Study" value={s.study}
                  onChange={e => updateStudy(i, { study: e.target.value })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder={type === "rmst" ? "RMST diff" : "Effect"} type="number" step="any"
                  value={s.rmstDiff ?? ""} onChange={e => updateStudy(i, { rmstDiff: e.target.value ? Number(e.target.value) : null })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="SE" type="number" step="any"
                  value={s.se ?? ""} onChange={e => updateStudy(i, { se: e.target.value ? Number(e.target.value) : null })} />
                <button className="col-span-1 text-[10px] text-[var(--color-exclude)]" onClick={() => removeStudy(i)}>remove</button>
              </div>
            ))}
          </div>
        </div>

        {err && <div className="mt-2 rounded border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
      </Card>

      {rmstResult && (
        <>
          <Card title="RMST Meta-Analysis Result">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{fmt(rmstResult.pooledRmstDiff, 3)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Pooled RMST diff</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">[{fmt(rmstResult.ciLower, 3)}, {fmt(rmstResult.ciUpper, 3)}]</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">95% CI</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{rmstResult.i2.toFixed(1)}%</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">I²</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{fmt(rmstResult.tau2, 4)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">τ²</div>
              </div>
            </div>
          </Card>

          <Card title="Tau Sensitivity Analysis">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="px-2 py-1">Tau (years)</th>
                    <th className="px-2 py-1">Pooled RMST diff</th>
                    <th className="px-2 py-1">95% CI</th>
                  </tr>
                </thead>
                <tbody>
                  {rmstResult.tauSensitivity.filter((_, i) => i % 2 === 0).map((t, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-1">{t.tau.toFixed(1)}</td>
                      <td className="px-2 py-1 font-mono">{fmt(t.pooled, 3)}</td>
                      <td className="px-2 py-1 font-mono">{fmt(t.lo, 3)} – {fmt(t.hi, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {cumulResult && (
        <Card title="Cumulative Meta-Analysis">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-2 py-1">Added</th>
                  <th className="px-2 py-1">k</th>
                  <th className="px-2 py-1">Pooled</th>
                  <th className="px-2 py-1">95% CI</th>
                  <th className="px-2 py-1">I²</th>
                </tr>
              </thead>
              <tbody>
                {cumulResult.cumulative.map((c, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-2 py-1">{c.study}</td>
                    <td className="px-2 py-1">{c.k}</td>
                    <td className="px-2 py-1 font-mono">{fmt(c.pooledEffect, 3)}</td>
                    <td className="px-2 py-1 font-mono">{fmt(c.ciLower, 3)} – {fmt(c.ciUpper, 3)}</td>
                    <td className="px-2 py-1">{c.i2.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
