import { useState } from 'react';
import { Card, Input, Button } from '../components/ui';
import { computePower, predictionInterval } from '../lib/power-calculator';
import { Activity, TrendingUp, AlertTriangle } from 'lucide-react';

export default function PowerCalculatorPage({ project }: { project: any }) {
  const [nStudies, setNStudies] = useState(10);
  const [avgSampleSize, setAvgSampleSize] = useState(50);
  const [effectSize, setEffectSize] = useState(0.3);
  const [heterogeneityI2, setHeterogeneityI2] = useState(50);
  const [alpha, setAlpha] = useState(0.05);
  const [targetPower, setTargetPower] = useState(0.8);
  const [result, setResult] = useState<ReturnType<typeof computePower> | null>(null);

  const handleCalculate = () => {
    const r = computePower({
      nStudies,
      avgSampleSize,
      effectSize,
      heterogeneityI2,
      alpha,
      power: targetPower,
      twoTailed: true,
    });
    setResult(r);
  };

  const handleUseMetaResults = () => {
    if (project?.meta?.results) {
      const k = project.meta.results.studies?.length || 0;
      if (k > 0) {
        setNStudies(k);
        setHeterogeneityI2(Math.round(project.meta.results.heterogeneity?.i2 || 0));
        setEffectSize(Math.abs(project.meta.results.pooled?.effect || 0.3));
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Power & Sample Size Calculator">
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Estimate statistical power for your meta-analysis given expected effect size, heterogeneity, and number of studies.
          Based on Borenstein et al. (2009) and Jackson & Bowden (2009).
        </p>
        <div className="mt-2">
          <Button variant="default" size="sm" onClick={handleUseMetaResults}>
            <Activity className="h-3 w-3 mr-1" /> Use Current Meta-Analysis Results
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Parameters">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Number of Studies (k)
              </label>
              <Input
                type="number"
                value={nStudies}
                onChange={e => setNStudies(parseInt(e.target.value) || 0)}
                min={2}
                max={200}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Avg Sample Size per Arm (n)
              </label>
              <Input
                type="number"
                value={avgSampleSize}
                onChange={e => setAvgSampleSize(parseInt(e.target.value) || 0)}
                min={5}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Expected Effect Size (SMD or logOR)
              </label>
              <Input
                type="number"
                step="0.01"
                value={effectSize}
                onChange={e => setEffectSize(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Expected I² (%)
              </label>
              <Input
                type="number"
                value={heterogeneityI2}
                onChange={e => setHeterogeneityI2(parseFloat(e.target.value) || 0)}
                min={0}
                max={100}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Significance Level (α)
              </label>
              <Input
                type="number"
                step="0.01"
                value={alpha}
                onChange={e => setAlpha(parseFloat(e.target.value) || 0.05)}
                min={0.001}
                max={0.2}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Target Power (1-β)
              </label>
              <Input
                type="number"
                step="0.01"
                value={targetPower}
                onChange={e => setTargetPower(parseFloat(e.target.value) || 0.8)}
                min={0.5}
                max={0.99}
              />
            </div>
            <Button variant="default" size="sm" onClick={handleCalculate}>
              <TrendingUp className="h-3 w-3 mr-1" /> Calculate Power
            </Button>
          </div>
        </Card>

        {result && (
          <Card title="Results">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatBox
                  label="Achieved Power"
                  value={`${(result.achievedPower * 100).toFixed(1)}%`}
                  tone={result.achievedPower >= targetPower ? 'include' : 'exclude'}
                />
                <StatBox
                  label="Min Detectable Effect"
                  value={result.minDetectableEffect.toFixed(3)}
                  tone="neutral"
                />
                <StatBox
                  label="Required Studies"
                  value={String(result.requiredStudies)}
                  tone={result.requiredStudies <= nStudies ? 'include' : 'exclude'}
                />
                <StatBox
                  label="Pooled SE"
                  value={result.standardError.toFixed(4)}
                  tone="neutral"
                />
              </div>

              {/* Prediction Interval */}
              <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Prediction Interval (95%)
                </div>
                <div className="text-[13px] font-mono text-[var(--color-text)]">
                  [{predictionInterval(
                    effectSize,
                    (heterogeneityI2 / 100) * 0.1,
                    result.standardError,
                    nStudies - 2
                  ).lower.toFixed(3)}, {predictionInterval(
                    effectSize,
                    (heterogeneityI2 / 100) * 0.1,
                    result.standardError,
                    nStudies - 2
                  ).upper.toFixed(3)}]
                </div>
                <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">
                  The range where a new study's true effect would fall with 95% probability.
                </p>
              </div>

              {result.note && (
                <div className="flex items-start gap-2 rounded-md border border-[var(--color-unsure)]/30 bg-[var(--color-unsure)]/10 p-2">
                  <AlertTriangle className="mt-0.5 h-3 w-3 text-[var(--color-unsure)]" />
                  <span className="text-[11px] text-[var(--color-unsure)]">{result.note}</span>
                </div>
              )}

              {/* Interpretation */}
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Interpretation
                </div>
                <p className="text-[12px] text-[var(--color-text)]">
                  {result.achievedPower >= targetPower
                    ? `With ${nStudies} studies of average n=${avgSampleSize}, you have ${(result.achievedPower * 100).toFixed(0)}% power to detect an effect size of ${effectSize.toFixed(2)} (I²=${heterogeneityI2}%).`
                    : `Power is only ${(result.achievedPower * 100).toFixed(0)}% — you need at least ${result.requiredStudies} studies to reach ${(targetPower * 100).toFixed(0)}% power.`}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone: 'include' | 'exclude' | 'neutral' }) {
  const colors = {
    include: 'text-[var(--color-include)]',
    exclude: 'text-[var(--color-exclude)]',
    neutral: 'text-[var(--color-text)]',
  };
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5">
      <div className={`text-[18px] font-semibold tabular-nums ${colors[tone]}`}>{value}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
