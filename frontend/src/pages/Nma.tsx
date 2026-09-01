import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Select, Pill } from "../components/ui";
import { postJson } from "../lib/api";

interface NmaStudy {
  study: string;
  treatment1: string;
  treatment2: string;
  measure: string;
  effect: number | null;
  se: number | null;
}

interface LeagueEntry {
  treatment1: string;
  treatment2: string;
  effect: number;
  ciLower: number;
  ciUpper: number;
  se: number;
  p: number;
  nStudies: number;
}

interface RankResult {
  treatment: string;
  pScore: number;
  sucra: number;
  meanRank: number;
  rankProbs: number[];
}

interface NodeSplitResult {
  treatment1: string;
  treatment2: string;
  commonComparator: string;
  directEffect: number;
  indirectEffect: number;
  difference: number;
  p: number;
  inconsistent: boolean;
}

interface NmaResult {
  measure: string;
  treatments: string[];
  league: LeagueEntry[];
  leagueMatrix: number[][];
  ranking: RankResult[];
  nodeSplit: NodeSplitResult[];
  qTotal: number;
  qHeterogeneity: number;
  qInconsistency: number;
  i2: number;
  tau2: number;
  bayesian: boolean;
  warnings: string[];
}

const MEASURES = ["OR", "RR", "RD", "MD", "SMD", "HR"];

export default function Nma({ project: _project, onChange: _onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [studies, setStudies] = useState<NmaStudy[]>([]);
  const [measure, setMeasure] = useState("OR");
  const [bayesian, setBayesian] = useState(false);
  const [result, setResult] = useState<NmaResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addStudy = () => {
    setStudies([...studies, { study: `S${studies.length + 1}`, treatment1: "", treatment2: "", measure, effect: null, se: null }]);
  };

  const updateStudy = (i: number, patch: Partial<NmaStudy>) => {
    setStudies(studies.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const removeStudy = (i: number) => {
    setStudies(studies.filter((_, idx) => idx !== i));
  };

  const run = async () => {
    if (studies.length < 2) { setErr("At least 2 studies required"); return; }
    if (studies.some(s => !s.treatment1 || !s.treatment2 || s.effect === null || s.se === null)) {
      setErr("All studies need treatments, effect, and SE"); return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson<NmaResult>("/api/nma", {
        studies: studies.map(s => ({ ...s, measure })),
        measure,
        bayesian,
        mcmcIter: 5000,
        warmup: 1000
      });
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const logScale = measure === "OR" || measure === "RR" || measure === "HR";
  const fmt = (v: number, d = 2) => logScale ? v.toFixed(d) : v.toFixed(3);

  return (
    <div className="space-y-3">
      <Card title="Network Meta-Analysis" right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{studies.length} comparisons</Pill>
          <button className="btn-primary" onClick={run} disabled={busy}>
            {busy ? "Running…" : "Run NMA"}
          </button>
        </div>
      }>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Measure</div>
            <Select value={measure} onChange={e => setMeasure(e.target.value)}>
              {MEASURES.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12px]">
              <input type="checkbox" checked={bayesian} onChange={e => setBayesian(e.target.checked)} className="h-3.5 w-3.5" />
              Bayesian MCMC
            </label>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-semibold">Studies</div>
            <button className="btn-ghost" onClick={addStudy}>+ Add comparison</button>
          </div>
          <div className="space-y-1.5">
            {studies.map((s, i) => (
              <div key={i} className="grid grid-cols-6 gap-1.5 rounded border border-[var(--color-border)] p-1.5">
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Study" value={s.study}
                  onChange={e => updateStudy(i, { study: e.target.value })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Treat 1" value={s.treatment1}
                  onChange={e => updateStudy(i, { treatment1: e.target.value })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Treat 2" value={s.treatment2}
                  onChange={e => updateStudy(i, { treatment2: e.target.value })} />
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

          <Card title="League Table">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="px-2 py-1">Treatment 1</th>
                    <th className="px-2 py-1">Treatment 2</th>
                    <th className="px-2 py-1">{measure}</th>
                    <th className="px-2 py-1">95% CI</th>
                    <th className="px-2 py-1">p</th>
                    <th className="px-2 py-1">k</th>
                  </tr>
                </thead>
                <tbody>
                  {result.league.map((l, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-1">{l.treatment1}</td>
                      <td className="px-2 py-1">{l.treatment2}</td>
                      <td className="px-2 py-1 font-mono">{fmt(l.effect)}</td>
                      <td className="px-2 py-1 font-mono">{fmt(l.ciLower)} – {fmt(l.ciUpper)}</td>
                      <td className="px-2 py-1 font-mono">{l.p.toFixed(3)}</td>
                      <td className="px-2 py-1">{l.nStudies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Ranking">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {result.ranking.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-[var(--color-border)] p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)]">#{i + 1}</span>
                    <span className="text-[12px] font-semibold">{r.treatment}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono">P-score: {r.pScore.toFixed(3)}</div>
                    <div className="text-[11px] font-mono">SUCRA: {r.sucra.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Heterogeneity & Inconsistency">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{result.i2.toFixed(1)}%</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">I²</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{result.tau2.toFixed(4)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">τ²</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{result.qTotal.toFixed(2)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Q total</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{result.nodeSplit.filter(n => n.inconsistent).length}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Inconsistent nodes</div>
              </div>
            </div>
          </Card>

          {result.nodeSplit.length > 0 && (
            <Card title="Node-Split Inconsistency">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11.5px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="px-2 py-1">Edge</th>
                      <th className="px-2 py-1">Comparator</th>
                      <th className="px-2 py-1">Direct</th>
                      <th className="px-2 py-1">Indirect</th>
                      <th className="px-2 py-1">Diff</th>
                      <th className="px-2 py-1">p</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.nodeSplit.map((ns, i) => (
                      <tr key={i} className={`border-t border-[var(--color-border)] ${ns.inconsistent ? "text-amber-500" : ""}`}>
                        <td className="px-2 py-1">{ns.treatment1} vs {ns.treatment2}</td>
                        <td className="px-2 py-1">{ns.commonComparator}</td>
                        <td className="px-2 py-1 font-mono">{fmt(ns.directEffect)}</td>
                        <td className="px-2 py-1 font-mono">{fmt(ns.indirectEffect)}</td>
                        <td className="px-2 py-1 font-mono">{fmt(ns.difference)}</td>
                        <td className="px-2 py-1 font-mono">{ns.p.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
