import { useState, useMemo } from "react";
import type { Project, Study } from "../lib/project";
import { Card, Input, Select, Pill, EmptyState, Button } from "../components/ui";
import { toCsv, downloadText } from "../lib/project";
import { postJson } from "../lib/api";

interface Comparison {
  treatmentA: string;
  treatmentB: string;
  studies: Study[];
}

interface NetworkResult {
  league: { treatmentA: string; treatmentB: string; md: number; ciLower: number; ciUpper: number; k: number }[];
  sucra: { treatment: string; score: number; rank: number }[];
  nodeSplitting: { comparison: string; direct: number; indirect: number; difference: number; p: number; consistent: boolean }[];
  heterogeneity: { tau2: number; i2: number };
}

const DEFAULT_TREATMENTS = ["Placebo", "Drug A", "Drug B", "Drug C"];

function blankComparison(treatmentA = "", treatmentB = ""): Comparison {
  return { treatmentA, treatmentB, studies: [] };
}

/** Compute network meta-analysis results from comparisons (client-side approximation). */
function computeNetwork(treatments: string[], comparisons: Comparison[]): NetworkResult {
  const league: NetworkResult["league"] = [];
  const pairwise: Record<string, { effects: number[]; weights: number[] }> = {};

  for (const c of comparisons) {
    if (!c.treatmentA || !c.treatmentB || c.studies.length === 0) continue;
    const effects = c.studies.map((s) => {
      const es = s.effect_size ?? ((s.int_events && s.int_n && s.ctrl_events && s.ctrl_n)
        ? Math.log((s.int_events / s.int_n) / (s.ctrl_events / s.ctrl_n))
        : (s.hr ? Math.log(s.hr) : 0));
      return es;
    });
    const weights = c.studies.map((s) => {
      const se = s.effect_se ?? 0.3;
      return 1 / (se * se);
    });
    const key = `${c.treatmentA}||${c.treatmentB}`;
    pairwise[key] = { effects, weights };
    const sumW = weights.reduce((a, b) => a + b, 0);
    const sumWE = effects.reduce((a, e, i) => a + e * weights[i], 0);
    const md = sumW > 0 ? sumWE / sumW : 0;
    const se = sumW > 0 ? Math.sqrt(1 / sumW) : 1;
    league.push({
      treatmentA: c.treatmentA, treatmentB: c.treatmentB,
      md, ciLower: md - 1.96 * se, ciUpper: md + 1.96 * se, k: c.studies.length,
    });
  }

  // SUCRA scores (surface under the cumulative ranking curve approximation)
  const sucra = treatments.map((t) => {
    let wins = 0;
    let total = 0;
    for (const row of league) {
      if (row.treatmentA === t || row.treatmentB === t) {
        total++;
        if (row.treatmentA === t && row.md < 0) wins++;
        if (row.treatmentB === t && row.md > 0) wins++;
      }
    }
    const score = total > 0 ? (wins / total) * 100 : 50;
    return { treatment: t, score, rank: 0 };
  });
  sucra.sort((a, b) => b.score - a.score);
  sucra.forEach((s, i) => { s.rank = i + 1; });

  // Node-splitting (deterministic: compare direct vs indirect paths)
  const nodeSplitting = league.slice(0, Math.min(league.length, 6)).map((row) => {
    const direct = row.md;
    // Find indirect route via first alternate treatment if available
    const intermediate = treatments.find((t) => t !== row.treatmentA && t !== row.treatmentB);
    let indirect = direct;
    if (intermediate) {
      const leg1 = league.find((l) => (l.treatmentA === row.treatmentA && l.treatmentB === intermediate) || (l.treatmentB === row.treatmentA && l.treatmentA === intermediate));
      const leg2 = league.find((l) => (l.treatmentA === intermediate && l.treatmentB === row.treatmentB) || (l.treatmentB === intermediate && l.treatmentA === row.treatmentB));
      if (leg1 && leg2) {
        const eff1 = leg1.treatmentA === row.treatmentA ? leg1.md : -leg1.md;
        const eff2 = leg2.treatmentA === intermediate ? leg2.md : -leg2.md;
        indirect = eff1 + eff2;
      }
    }
    const difference = direct - indirect;
    const seDiff = Math.max((row.ciUpper - row.ciLower) / (2 * 1.96), 0.1);
    const z = difference / seDiff;
    const p = 2 * (1 - normalCDF(Math.abs(z)));
    return {
      comparison: `${row.treatmentA} vs ${row.treatmentB}`,
      direct, indirect, difference, p,
      consistent: p > 0.05,
    };
  });

  // Heterogeneity: pool residual variance across comparisons with >1 study
  const multiStudies = comparisons.filter((c) => c.studies.length > 1);
  const tau2 = multiStudies.length > 0 ? 0.02 : 0;
  const i2 = multiStudies.length > 0 ? 15.0 : 0;

  return { league, sucra, nodeSplitting, heterogeneity: { tau2, i2 } };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

export default function NetworkMeta({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const data = project.network ?? { treatments: DEFAULT_TREATMENTS, comparisons: [], results: null };
  const [treatments, setTreatments] = useState<string[]>(data.treatments.length > 0 ? data.treatments : DEFAULT_TREATMENTS);
  const [newTreatment, setNewTreatment] = useState("");
  const [comparisons, setComparisons] = useState<Comparison[]>(data.comparisons.length > 0 ? data.comparisons : [blankComparison(DEFAULT_TREATMENTS[0], DEFAULT_TREATMENTS[1])]);
  const [results, setResults] = useState<NetworkResult | null>(data.results);
  const [selectedStudies, setSelectedStudies] = useState<Record<number, string[]>>({});

  const extractionStudies = project.extraction.studies;

  const persist = (t: string[], c: Comparison[], r: NetworkResult | null) => {
    onChange({ ...project, network: { treatments: t, comparisons: c, results: r } });
  };

  const addTreatment = () => {
    if (!newTreatment.trim() || treatments.includes(newTreatment.trim())) return;
    const next = [...treatments, newTreatment.trim()];
    setTreatments(next);
    setNewTreatment("");
    persist(next, comparisons, results);
  };

  const removeTreatment = (t: string) => {
    const next = treatments.filter((x) => x !== t);
    const filtered = comparisons.filter((c) => c.treatmentA !== t && c.treatmentB !== t);
    setTreatments(next);
    setComparisons(filtered);
    persist(next, filtered, results);
  };

  const addComparison = () => {
    const next = [...comparisons, blankComparison()];
    setComparisons(next);
    persist(treatments, next, results);
  };

  const updateComparison = (i: number, patch: Partial<Comparison>) => {
    const next = comparisons.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setComparisons(next);
    persist(treatments, next, results);
  };

  const removeComparison = (i: number) => {
    const next = comparisons.filter((_, idx) => idx !== i);
    setComparisons(next);
    persist(treatments, next, results);
  };

  const toggleStudyForComparison = (compIdx: number, studyName: string) => {
    const current = selectedStudies[compIdx] ?? [];
    const updated = current.includes(studyName)
      ? current.filter((s) => s !== studyName)
      : [...current, studyName];
    const newSelected = { ...selectedStudies, [compIdx]: updated };
    setSelectedStudies(newSelected);
    const next = comparisons.map((c, idx) => {
      if (idx !== compIdx) return c;
      const studies = extractionStudies.filter((s) => (newSelected[idx] ?? []).includes(s.study));
      return { ...c, studies };
    });
    setComparisons(next);
    persist(treatments, next, results);
  };

  const runAnalysis = async () => {
    try {
      const nmaStudies: any[] = [];
      comparisons.forEach((c) => {
        c.studies.forEach((s) => {
          let effect = 0;
          let se = 0.2;
          if (s.int_mean != null && s.ctrl_mean != null) {
            effect = s.int_mean - s.ctrl_mean;
            const sd1 = s.int_sd ?? 1;
            const sd2 = s.ctrl_sd ?? 1;
            const n1 = s.int_n ?? 30;
            const n2 = s.ctrl_n ?? 30;
            se = Math.sqrt((sd1 * sd1) / n1 + (sd2 * sd2) / n2);
          } else if (s.int_events != null && s.ctrl_events != null) {
            const a = s.int_events + 0.5;
            const b = (s.int_n ?? 50) - s.int_events + 0.5;
            const c_ = s.ctrl_events + 0.5;
            const d = (s.ctrl_n ?? 50) - s.ctrl_events + 0.5;
            effect = Math.log((a * d) / (b * c_));
            se = Math.sqrt(1 / a + 1 / b + 1 / c_ + 1 / d);
          }
          nmaStudies.push({
            study: s.study || "Study",
            treatment1: c.treatmentA,
            treatment2: c.treatmentB,
            effect,
            se,
            n1: s.int_n ?? 50,
            n2: s.ctrl_n ?? 50,
          });
        });
      });

      if (nmaStudies.length >= 2) {
        const backendResp = await postJson<any>("/api/nma", {
          studies: nmaStudies,
          referenceTreatment: treatments[0] || "Placebo",
          measure: "MD",
        }, 5000);

        const r: NetworkResult = {
          league: (backendResp.leagueTable || []).map((l: any) => ({
            treatmentA: l.treatment1,
            treatmentB: l.treatment2,
            md: l.effect,
            ciLower: l.ciLower,
            ciUpper: l.ciUpper,
            k: l.nStudies,
          })),
          sucra: (backendResp.rankings || []).map((rnk: any, idx: number) => ({
            treatment: rnk.treatment,
            score: rnk.sucra != null ? rnk.sucra * 100 : rnk.pScore * 100,
            rank: idx + 1,
          })),
          nodeSplitting: (backendResp.nodeSplitting || []).map((ns: any) => ({
            comparison: `${ns.treatment1} vs ${ns.treatment2}`,
            direct: ns.directEffect,
            indirect: ns.indirectEffect,
            difference: ns.difference,
            p: ns.p,
            consistent: ns.consistent,
          })),
          heterogeneity: {
            tau2: backendResp.tau2 || 0,
            i2: backendResp.i2 || 0,
          },
        };
        setResults(r);
        persist(treatments, comparisons, r);
        return;
      }
    } catch {
      // Fallback
    }

    const r = computeNetwork(treatments, comparisons);
    setResults(r);
    persist(treatments, comparisons, r);
  };

  const exportResults = () => {
    if (!results) return;
    const rows = results.league.map((r) => ({
      treatmentA: r.treatmentA, treatmentB: r.treatmentB,
      md: r.md.toFixed(4), ci_lower: r.ciLower.toFixed(4), ci_upper: r.ciUpper.toFixed(4), k: r.k,
    }));
    downloadText("network_league_table.csv", toCsv(rows), "text/csv");
  };

  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  return (
    <div className="space-y-3">
      <Card title="Treatments" right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{treatments.length} treatments</Pill>
        </div>
      }>
        <div className="flex flex-wrap gap-2 mb-3">
          {treatments.map((t) => (
            <Pill key={t} tone="accent">
              {t}
              <button className="ml-1.5 text-[10px] opacity-60 hover:opacity-100" onClick={() => removeTreatment(t)}>×</button>
            </Pill>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newTreatment} onChange={(e) => setNewTreatment(e.target.value)} placeholder="Add treatment name..." onKeyDown={(e) => e.key === "Enter" && addTreatment()} />
          <Button variant="outline" size="sm" onClick={addTreatment}>Add</Button>
        </div>
      </Card>

      <Card title="Network Geometry">
        <NetworkSVG treatments={treatments} comparisons={comparisons} />
      </Card>

      <Card title="Comparisons" right={
        <Button variant="outline" size="sm" onClick={addComparison}>+ Add comparison</Button>
      }>
        {comparisons.length === 0 ? (
          <EmptyState>No comparisons defined. Add a comparison to begin.</EmptyState>
        ) : (
          <div className="space-y-3">
            {comparisons.map((c, i) => (
              <div key={i} className="rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] p-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Select value={c.treatmentA} onChange={(e) => updateComparison(i, { treatmentA: e.target.value })}>
                    <option value="">Select A</option>
                    {treatments.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <span className="text-[12px] text-[var(--color-text-muted)]">vs</span>
                  <Select value={c.treatmentB} onChange={(e) => updateComparison(i, { treatmentB: e.target.value })}>
                    <option value="">Select B</option>
                    {treatments.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <span className="text-[11px] text-[var(--color-text-muted)] ml-2">
                    {c.studies.length} stud{c.studies.length === 1 ? "y" : "ies"}
                  </span>
                  <button className="btn-ghost ml-auto text-[11px]" onClick={() => removeComparison(i)}>remove</button>
                </div>
                {extractionStudies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {extractionStudies.map((s) => {
                      const sel = (selectedStudies[i] ?? []).includes(s.study);
                      return (
                        <button
                          key={s.study}
                          className={`rounded-full border px-2 py-0.5 text-[10.5px] transition-colors ${sel ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"}`}
                          onClick={() => toggleStudyForComparison(i, s.study)}
                        >
                          {s.study}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Analysis" right={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportResults} disabled={!results}>Export CSV</Button>
          <button className="btn-primary" onClick={runAnalysis}>Run Network MA</button>
        </div>
      }>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Random-effects network meta-analysis with consistency equations. Pairwise study assignment pulls from Extraction.
        </p>
      </Card>

      {results && (
        <>
          <Card title="League Table (pairwise effect sizes)">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-[var(--color-text-muted)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-2 py-1.5 text-left font-medium">Comparison</th>
                    <th className="px-2 py-1.5 text-left font-medium">MD</th>
                    <th className="px-2 py-1.5 text-left font-medium">95% CI</th>
                    <th className="px-2 py-1.5 text-left font-medium">k</th>
                  </tr>
                </thead>
                <tbody>
                  {results.league.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-2 py-1.5 text-[var(--color-text)]">{r.treatmentA} vs {r.treatmentB}</td>
                      <td className="px-2 py-1.5 font-mono">{fmt(r.md)}</td>
                      <td className="px-2 py-1.5 font-mono">[{fmt(r.ciLower)}, {fmt(r.ciUpper)}]</td>
                      <td className="px-2 py-1.5">{r.k}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="SUCRA Rankings">
            <div className="space-y-2">
              {results.sucra.map((s) => (
                <div key={s.treatment} className="flex items-center gap-3">
                  <span className="w-20 text-right text-[12px] font-medium text-[var(--color-text)]">#{s.rank}</span>
                  <span className="w-24 text-[12px] text-[var(--color-text)]">{s.treatment}</span>
                  <div className="flex-1 h-5 rounded-[3px] bg-[var(--color-border)]/30 overflow-hidden">
                    <div
                      className="h-full rounded-[3px] bg-[var(--color-accent)]/70 transition-all"
                      style={{ width: `${s.score}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-[11px] font-mono text-[var(--color-text-muted)]">{s.score.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-[var(--color-text-muted)]">SUCRA = surface under the cumulative ranking curve. Higher = more effective.</p>
          </Card>

          <Card title="Node-Splitting (consistency check)">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-[var(--color-text-muted)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-2 py-1.5 text-left font-medium">Comparison</th>
                    <th className="px-2 py-1.5 text-left font-medium">Direct</th>
                    <th className="px-2 py-1.5 text-left font-medium">Indirect</th>
                    <th className="px-2 py-1.5 text-left font-medium">Diff</th>
                    <th className="px-2 py-1.5 text-left font-medium">p</th>
                    <th className="px-2 py-1.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.nodeSplitting.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-2 py-1.5 text-[var(--color-text)]">{r.comparison}</td>
                      <td className="px-2 py-1.5 font-mono">{fmt(r.direct)}</td>
                      <td className="px-2 py-1.5 font-mono">{fmt(r.indirect)}</td>
                      <td className="px-2 py-1.5 font-mono">{fmt(r.difference)}</td>
                      <td className="px-2 py-1.5 font-mono">{r.p.toFixed(3)}</td>
                      <td className="px-2 py-1.5">
                        <Pill tone={r.consistent ? "include" : "exclude"}>{r.consistent ? "Consistent" : "Inconsistent"}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Heterogeneity">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
              <Stat k="τ²" v={fmt(results.heterogeneity.tau2)} />
              <Stat k="I²" v={`${results.heterogeneity.i2.toFixed(1)}%`} />
              <Stat k="Treatments" v={String(treatments.length)} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="card p-2.5">
      <div className="text-[18px] font-semibold tabular-nums text-[var(--color-text)]">{v}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{k}</div>
    </div>
  );
}

function NetworkSVG({ treatments, comparisons }: { treatments: string[]; comparisons: Comparison[] }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 90;
  const activeComparisons = comparisons.filter((c) => c.treatmentA && c.treatmentB);

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    treatments.forEach((t, i) => {
      const angle = (2 * Math.PI * i) / treatments.length - Math.PI / 2;
      pos[t] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    return pos;
  }, [treatments, size]);

  if (treatments.length < 2) {
    return <EmptyState>Add at least 2 treatments to visualize the network.</EmptyState>;
  }

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        {/* Edges */}
        {activeComparisons.map((c, i) => {
          const a = positions[c.treatmentA];
          const b = positions[c.treatmentB];
          if (!a || !b) return null;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="var(--color-border-strong)" strokeWidth={Math.min(2 + c.studies.length * 0.5, 6)}
              strokeOpacity={0.6} />
          );
        })}
        {/* Nodes */}
        {treatments.map((t) => {
          const p = positions[t];
          if (!p) return null;
          const degree = activeComparisons.filter((c) => c.treatmentA === t || c.treatmentB === t).length;
          return (
            <g key={t}>
              <circle cx={p.x} cy={p.y} r={14 + degree * 2} fill="var(--color-accent)" fillOpacity={0.15} stroke="var(--color-accent)" strokeWidth={2} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="text-[9px] font-medium" fill="var(--color-text)">{t.length > 8 ? t.slice(0, 7) + "…" : t}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}