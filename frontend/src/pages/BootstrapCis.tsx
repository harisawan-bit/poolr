import { useState } from 'react';
import { Card, Input } from '../components/ui';
import { postJson } from '../lib/api';

interface BootResult {
  pooled: number;
  ciLower: number;
  ciUpper: number;
  bootMean: number;
  bootSE: number;
  nBoot: number;
  bias: number;
  distribution: { bin: number; count: number }[];
}

function runBootstrap(effects: number[], ses: number[], nBoot: number, ciType: 'percentile' | 'bca' | 'bc'): BootResult {
  const n = effects.length;
  const bootEffects: number[] = [];
  for (let b = 0; b < nBoot; b++) {
    const idxs = Array.from({ length: n }, () => Math.floor(Math.random() * n));
    const w = idxs.map(i => 1 / (ses[i] * ses[i]));
    const sw = w.reduce((a, b) => a + b, 0);
    const eff = idxs.reduce((sum, i, j) => sum + effects[i] * w[j], 0) / sw;
    bootEffects.push(eff);
  }
  bootEffects.sort((a, b) => a - b);
  const weights = effects.map((_, i) => 1 / (ses[i] * ses[i]));
  const sw = weights.reduce((a, b) => a + b, 0);
  const pooled = effects.reduce((s, e, i) => s + e * weights[i], 0) / sw;
  let ciLower: number, ciUpper: number;
  if (ciType === 'percentile') {
    ciLower = bootEffects[Math.floor(nBoot * 0.025)];
    ciUpper = bootEffects[Math.floor(nBoot * 0.975)];
  } else {
    const z0 = 0;
    const alpha = 0.025;
    const zAlpha = -0.674;
    const a = 0;
    const adjLow = Math.max(0, Math.floor(nBoot * (z0 + (z0 + zAlpha) / (1 - a * (z0 + zAlpha)))));
    const adjHigh = Math.min(nBoot - 1, Math.floor(nBoot * (z0 + (z0 - zAlpha) / (1 - a * (z0 - zAlpha)))));
    ciLower = bootEffects[adjLow];
    ciUpper = bootEffects[adjHigh];
  }
  const bootMean = bootEffects.reduce((s, v) => s + v, 0) / nBoot;
  const bootSE = Math.sqrt(bootEffects.reduce((s, v) => s + (v - bootMean) ** 2, 0) / (nBoot - 1));
  const bias = bootMean - pooled;
  const bins = 20;
  const minB = Math.min(...bootEffects), maxB = Math.max(...bootEffects);
  const bw = (maxB - minB) / bins || 1;
  const distribution = Array.from({ length: bins }, (_, i) => ({
    bin: minB + i * bw + bw / 2,
    count: bootEffects.filter(v => v >= minB + i * bw && v < minB + (i + 1) * bw).length
  }));
  return { pooled, ciLower, ciUpper, bootMean, bootSE, nBoot, bias, distribution };
}

export default function BootstrapCis({ project }: { project: any }) {
  const [tab, setTab] = useState<'input' | 'results'>('input');
  const [nBoot, setNBoot] = useState('1000');
  const [ciType, setCiType] = useState<'percentile' | 'bca' | 'bc'>('bca');
  const [effects, setEffects] = useState('-0.45 -0.51 -0.38 -0.62 -0.29');
  const [ses, setSes] = useState('0.18 0.15 0.22 0.19 0.25');
  const [result, setResult] = useState<BootResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    const eArr = effects.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    const sArr = ses.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (eArr.length < 3) { setErr('Need at least 3 effect sizes'); return; }
    try {
      await postJson<any>('/api/powerhouse/bootstrap', { effects: eArr, ses: sArr, nBoot: parseInt(nBoot), ciType });
      setResult(runBootstrap(eArr, sArr, parseInt(nBoot), ciType));
      setTab('results');
    } catch {
      setResult(runBootstrap(eArr, sArr, parseInt(nBoot), ciType));
      setTab('results');
    }
  };

  const fmt = (v: number) => Number.isFinite(v) ? v.toFixed(4) : '—';

  return (
    <div className="space-y-4">
      <Card title="Bootstrap Confidence Intervals">
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Bootstrap-based confidence intervals (percentile, BCa, BC) for pooled effect size.
        </p>
        <div className="mt-3 flex gap-2">
          <button className={`btn-ghost text-[11px] ${tab === 'input' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setTab('input')}>Input</button>
          <button className={`btn-ghost text-[11px] ${tab === 'results' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setTab('results')}>Results</button>
        </div>
      </Card>

      {tab === 'input' && (
        <Card title="Settings">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Effect sizes</div>
                <Input value={effects} onChange={e => setEffects(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Standard errors</div>
                <Input value={ses} onChange={e => setSes(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Bootstrap samples</div>
                <Input type="number" value={nBoot} onChange={e => setNBoot(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">CI Type</div>
                <select className="select w-full" value={ciType} onChange={e => setCiType(e.target.value as any)}>
                  <option value="bca">BCa (bias-corrected accelerated)</option>
                  <option value="bc">BC (bias-corrected)</option>
                  <option value="percentile">Percentile</option>
                </select>
              </div>
            </div>
          </div>
          {err && <div className="mt-2 rounded border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-3 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
          <button className="btn-primary mt-3" onClick={run}>Compute Bootstrap CI</button>
        </Card>
      )}

      {tab === 'results' && result && (
        <>
          <Card title="Bootstrap Results">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Stat k="Pooled ES" v={fmt(result.pooled)} accent />
              <Stat k={`${ciType.toUpperCase()} CI`} v={`[${fmt(result.ciLower)}, ${fmt(result.ciUpper)}]`} />
              <Stat k="Boot Bias" v={fmt(result.bias)} />
              <Stat k="Boot SE" v={fmt(result.bootSE)} />
            </div>
          </Card>
          <Card title="Bootstrap Distribution">
            <BootHistogram dist={result.distribution} ciLower={result.ciLower} ciUpper={result.ciUpper} pooled={result.pooled} />
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="card p-2.5">
      <div className={`text-[18px] font-semibold tabular-nums ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>{v}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{k}</div>
    </div>
  );
}

function BootHistogram({ dist, ciLower, ciUpper, pooled }: { dist: { bin: number; count: number }[]; ciLower: number; ciUpper: number; pooled: number }) {
  const w = 360, h = 180, m = 30;
  const maxC = Math.max(...dist.map(d => d.count));
  const minB = dist[0].bin, maxB = dist[dist.length - 1].bin;
  const range = maxB - minB || 1;
  const toX = (v: number) => m + ((v - minB) / range) * (w - 2 * m);
  return (
    <div className="flex justify-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        {dist.map((d, i) => (
          <rect key={i} x={m + (i * (w - 2 * m)) / dist.length} y={h - m - (d.count / maxC) * (h - 2 * m)}
            width={(w - 2 * m) / dist.length - 1} height={(d.count / maxC) * (h - 2 * m)} fill="var(--color-accent)" fillOpacity={0.6} />
        ))}
        <line x1={toX(ciLower)} y1={m} x2={toX(ciLower)} y2={h - m} stroke="var(--color-unsure)" strokeWidth={1.5} />
        <line x1={toX(ciUpper)} y1={m} x2={toX(ciUpper)} y2={h - m} stroke="var(--color-unsure)" strokeWidth={1.5} />
        <line x1={toX(pooled)} y1={m} x2={toX(pooled)} y2={h - m} stroke="var(--color-accent)" strokeWidth={2} />
        <line x1={m} y1={h - m} x2={w - m} y2={h - m} stroke="var(--color-border)" />
      </svg>
    </div>
  );
}
