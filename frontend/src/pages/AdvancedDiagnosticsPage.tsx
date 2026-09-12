import { useState, useMemo } from 'react';
import { Card, Pill } from '../components/ui';

interface GalbraithDatum {
  study: string;
  precision: number;
  z: number;
}

/**
 * Galbraith (Radial) plot for visualizing heterogeneity.
 */
export function computeGalbraithData(
  studies: { study: string; effect: number; ci_lower: number; ci_upper: number }[]
): { data: GalbraithDatum[]; regression: { slope: number; se: number; r2: number } } {
  const valid = studies.filter(s =>
    Number.isFinite(s.effect) && Number.isFinite(s.ci_lower) && Number.isFinite(s.ci_upper) &&
    s.ci_upper > s.ci_lower
  );

  const data: GalbraithDatum[] = valid.map(s => {
    const se = (s.ci_upper - s.ci_lower) / (2 * 1.959964);
    return {
      study: s.study,
      precision: se > 0 ? 1 / se : 0,
      z: se > 0 ? s.effect / se : 0,
    };
  }).filter(d => d.precision > 0);

  let num = 0;
  let den = 0;
  let ssRes = 0;
  let ssTot = 0;
  const meanZ = data.reduce((s, d) => s + d.z, 0) / data.length;

  for (const d of data) {
    num += d.precision * d.precision * d.z;
    den += d.precision * d.precision;
  }

  const slope = den > 0 ? num / den : 0;

  for (const d of data) {
    const predicted = slope * d.precision;
    ssRes += (d.z - predicted) ** 2;
    ssTot += (d.z - meanZ) ** 2;
  }

  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  const se = Math.sqrt(ssRes / Math.max(data.length - 1, 1) / den);

  return {
    data,
    regression: { slope, se, r2: Math.max(0, Math.min(1, r2)) },
  };
}

/**
 * Baujat plot: identifies studies contributing most to heterogeneity.
 */
export interface BaujatDatum {
  study: string;
  influence: number;
  heterogeneity: number;
}

export function computeBaujatData(
  studies: { study: string; effect: number; se: number }[]
): BaujatDatum[] {
  const valid = studies.filter(s => Number.isFinite(s.effect) && s.se > 0);

  const weights = valid.map(s => 1 / (s.se * s.se));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const pooled = valid.reduce((s, x, i) => s + x.effect * weights[i], 0) / sumW;

  return valid.map(s => {
    const w = 1 / (s.se * s.se);
    const qContribution = w * (s.effect - pooled) ** 2;
    const wOth = sumW - w;
    const effOth = wOth > 0 ? (pooled * sumW - s.effect * w) / wOth : pooled;
    const influence = Math.abs(pooled - effOth);

    return {
      study: s.study,
      influence,
      heterogeneity: qContribution,
    };
  });
}

/**
 * GOSH plot data: distribution of effects across subsets of studies.
 */
export function computeGoshDistribution(
  effects: number[],
  ses: number[],
  subsampleSize?: number
): { subsetEffect: number; subsetSize: number }[] {
  const valid = effects.map((e, i) => ({ effect: e, se: ses[i] })).filter(
    x => Number.isFinite(x.effect) && x.se > 0
  );
  if (valid.length < 2) return [];

  const k = subsampleSize || Math.max(2, Math.floor(valid.length / 2));
  const results: { subsetEffect: number; subsetSize: number }[] = [];

  const stride = Math.max(1, Math.floor(valid.length / Math.min(k, valid.length)));
  for (let start = 0; start < Math.min(k, valid.length); start++) {
    const subset: typeof valid = [];
    for (let i = 0; i < k && start + i * stride < valid.length; i++) {
      subset.push(valid[start + i * stride]);
    }
    if (subset.length >= 2) {
      const w = subset.map(s => 1 / (s.se * s.se));
      const sw = w.reduce((a, b) => a + b, 0);
      const eff = subset.reduce((s, x, i) => s + x.effect * w[i], 0) / sw;
      results.push({ subsetEffect: eff, subsetSize: subset.length });
    }
  }

  return results;
}

export default function AdvancedDiagnosticsPage({ project }: { project: any }) {
  const [activeTab, setActiveTab] = useState<'galbraith' | 'baujat' | 'gosh'>('galbraith');

  const metaResults = project?.meta?.results;
  const studies = metaResults?.studies || [];

  const galbraithData = useMemo(() => {
    if (studies.length < 3) return null;
    return computeGalbraithData(studies.map((s: any) => ({
      study: s.study,
      effect: s.effect,
      ci_lower: s.ci_lower,
      ci_upper: s.ci_upper,
    })));
  }, [studies]);

  const baujatData = useMemo(() => {
    if (studies.length < 3) return null;
    return computeBaujatData(studies.map((s: any) => ({
      study: s.study,
      effect: s.effect,
      se: s.se ?? (Math.abs(s.ci_upper - s.ci_lower) / (2 * 1.959964)),
    })));
  }, [studies]);

  const goshData = useMemo(() => {
    if (studies.length < 3) return null;
    return computeGoshDistribution(
      studies.map((s: any) => s.effect),
      studies.map((s: any) => s.se ?? (Math.abs(s.ci_upper - s.ci_lower) / (2 * 1.959964)))
    );
  }, [studies]);

  const hasData = studies.length >= 3;

  return (
    <div className="space-y-4">
      <Card title="Advanced Diagnostic Plots">
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Galbraith (radial), Baujat, and GOSH plots for detecting influential studies and sources of heterogeneity.
        </p>
        <div className="mt-3 flex gap-2">
          <button className={`btn-ghost text-[11px] ${activeTab === 'galbraith' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setActiveTab('galbraith')}>
            Galbraith Plot
          </button>
          <button className={`btn-ghost text-[11px] ${activeTab === 'baujat' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setActiveTab('baujat')}>
            Baujat Plot
          </button>
          <button className={`btn-ghost text-[11px] ${activeTab === 'gosh' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setActiveTab('gosh')}>
            GOSH Plot
          </button>
        </div>
      </Card>

      {!hasData ? (
        <Card title="No Meta-Analysis Data">
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            Run a meta-analysis with at least 3 studies to generate diagnostic plots.
          </p>
        </Card>
      ) : (
        <>
          {activeTab === 'galbraith' && galbraithData && (
            <Card title="Galbraith (Radial) Plot">
              <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
                Z-statistic vs. precision (1/SE). Studies outside the ±2 bands contribute disproportionately to heterogeneity.
              </p>
              <GalbraithSVG data={galbraithData} />
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                <StatBox label="Slope (Pooled ES)" value={galbraithData.regression.slope.toFixed(4)} />
                <StatBox label="R²" value={(galbraithData.regression.r2 * 100).toFixed(1) + '%'} />
                <StatBox label="Studies Plotted" value={String(galbraithData.data.length)} />
              </div>
            </Card>
          )}

          {activeTab === 'baujat' && baujatData && (
            <Card title="Baujat Plot">
              <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
                X-axis: influence on overall result. Y-axis: contribution to heterogeneity (Q).
                Top-right quadrant studies drive both the result and heterogeneity.
              </p>
              <BaujatSVG data={baujatData} />
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                  High-Influence Studies
                </div>
                <div className="space-y-1">
                  {baujatData
                    .sort((a, b) => (b.influence * b.heterogeneity) - (a.influence * a.heterogeneity))
                    .slice(0, 3)
                    .map(d => (
                      <div key={d.study} className="flex items-center gap-2 text-[12px]">
                        <span className="flex-1 text-[var(--color-text)]">{d.study}</span>
                        <Pill tone="unsure">Infl: {d.influence.toFixed(3)}</Pill>
                        <Pill tone="exclude">Q: {d.heterogeneity.toFixed(2)}</Pill>
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'gosh' && goshData && (
            <Card title="GOSH Plot">
              <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
                Distribution of pooled effects across study subsets.
                A bimodal distribution indicates latent heterogeneity.
              </p>
              <GOSHPlotSVG data={goshData} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5">
      <div className="text-[16px] font-semibold tabular-nums text-[var(--color-text)]">{value}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function GalbraithSVG({ data }: { data: { data: GalbraithDatum[]; regression: { slope: number; se: number; r2: number } } }) {
  const { data: points, regression } = data;
  const size = 360;
  const margin = 50;
  const plotSize = size - margin * 2;

  const maxPrec = Math.max(...points.map(d => d.precision)) * 1.05;
  const maxZ = Math.max(...points.map(d => Math.abs(d.z))) * 1.2;

  const scaleX = (v: number) => margin + (v / maxPrec) * plotSize;
  const scaleY = (v: number) => margin + plotSize / 2 - (v / maxZ) * (plotSize / 2);

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        <line x1={margin} y1={size - margin} x2={size - margin} y2={size - margin} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={margin} y1={margin} x2={margin} y2={size - margin} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={margin} y1={scaleY(0)} x2={size - margin} y2={scaleY(0)} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="4,4" />
        <line x1={margin} y1={scaleY(2)} x2={size - margin} y2={scaleY(2)} stroke="var(--color-exclude)" strokeWidth={0.5} strokeDasharray="2,2" />
        <line x1={margin} y1={scaleY(-2)} x2={size - margin} y2={scaleY(-2)} stroke="var(--color-exclude)" strokeWidth={0.5} strokeDasharray="2,2" />
        <line
          x1={scaleX(0)}
          y1={scaleY(0)}
          x2={scaleX(maxPrec)}
          y2={scaleY(regression.slope * maxPrec)}
          stroke="var(--color-accent)"
          strokeWidth={2}
        />
        {points.map((d, i) => (
          <circle key={i} cx={scaleX(d.precision)} cy={scaleY(d.z)} r={4} fill="var(--color-accent)" fillOpacity={0.6} />
        ))}
        <text x={size / 2} y={size - 10} textAnchor="middle" className="text-[9px]" fill="var(--color-text-muted)">Precision (1/SE)</text>
        <text x={15} y={size / 2} textAnchor="middle" transform={`rotate(-90, 15, ${size / 2})`} className="text-[9px]" fill="var(--color-text-muted)">Z (ES/SE)</text>
      </svg>
    </div>
  );
}

function BaujatSVG({ data }: { data: BaujatDatum[] }) {
  const size = 360;
  const margin = 50;
  const plotSize = size - margin * 2;

  const maxInf = Math.max(...data.map(d => d.influence)) * 1.05 || 1;
  const maxHet = Math.max(...data.map(d => d.heterogeneity)) * 1.05 || 1;

  const scaleX = (v: number) => margin + (v / maxInf) * plotSize;
  const scaleY = (v: number) => size - margin - (v / maxHet) * plotSize;

  const qThreshold = maxHet / 2;
  const infThreshold = maxInf / 2;

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        <line x1={margin} y1={size - margin} x2={size - margin} y2={size - margin} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={margin} y1={margin} x2={margin} y2={size - margin} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={scaleX(infThreshold)} y1={margin} x2={scaleX(infThreshold)} y2={size - margin} stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3,3" />
        <line x1={margin} y1={scaleY(qThreshold)} x2={size - margin} y2={scaleY(qThreshold)} stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3,3" />
        <rect x={scaleX(infThreshold)} y={scaleY(qThreshold)} width={plotSize - (scaleX(infThreshold) - margin)} height={scaleY(0) - scaleY(qThreshold)} fill="var(--color-exclude)" fillOpacity={0.05} />
        {data.map((d, i) => (
          <circle key={i} cx={scaleX(d.influence)} cy={scaleY(d.heterogeneity)} r={5} fill={d.influence > infThreshold && d.heterogeneity > qThreshold ? 'var(--color-exclude)' : 'var(--color-accent)'} fillOpacity={0.6} />
        ))}
        <text x={size / 2} y={size - 10} textAnchor="middle" className="text-[9px]" fill="var(--color-text-muted)">Influence</text>
        <text x={15} y={size / 2} textAnchor="middle" transform={`rotate(-90, 15, ${size / 2})`} className="text-[9px]" fill="var(--color-text-muted)">Heterogeneity (Q)</text>
      </svg>
    </div>
  );
}

function GOSHPlotSVG({ data }: { data: { subsetEffect: number; subsetSize: number }[] }) {
  const size = 360;
  const margin = 50;
  const plotSize = size - margin * 2;

  if (data.length === 0) return null;

  const effects = data.map(d => d.subsetEffect);
  const minEff = Math.min(...effects);
  const maxEff = Math.max(...effects);
  const range = maxEff - minEff || 1;

  const nBins = Math.min(20, data.length);
  const binWidth = range / nBins;
  const bins: number[] = Array(nBins).fill(0);
  for (const d of data) {
    const idx = Math.min(nBins - 1, Math.floor((d.subsetEffect - minEff) / binWidth));
    bins[idx]++;
  }

  const maxCount = Math.max(...bins);
  const barWidth = plotSize / nBins;

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        <line x1={margin} y1={size - margin} x2={size - margin} y2={size - margin} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={margin} y1={margin} x2={margin} y2={size - margin} stroke="var(--color-border)" strokeWidth={1} />
        {bins.map((count, i) => {
          const h = (count / maxCount) * plotSize;
          return (
            <rect
              key={i}
              x={margin + i * barWidth + 1}
              y={size - margin - h}
              width={barWidth - 2}
              height={h}
              fill="var(--color-accent)"
              fillOpacity={0.6}
              rx={1}
            />
          );
        })}
        <text x={size / 2} y={size - 10} textAnchor="middle" className="text-[9px]" fill="var(--color-text-muted)">Pooled Effect Size (subset)</text>
        <text x={15} y={size / 2} textAnchor="middle" transform={`rotate(-90, 15, ${size / 2})`} className="text-[9px]" fill="var(--color-text-muted)">Frequency</text>
      </svg>
    </div>
  );
}
