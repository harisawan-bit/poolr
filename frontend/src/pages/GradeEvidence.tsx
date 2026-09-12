import { useState, useMemo } from 'react';
import type { Project } from '../lib/project';
import type { StudyInput } from '../lib/meta-engine';
import { Card, Pill, EmptyState, Input } from '../components/ui';
import { assessCertainty, gradeToMarkdown, getDowngradeReasons, type GradeOutcomeResult } from '../lib/grade-engine';
import { ShieldCheck, Info, Download, Sparkles } from 'lucide-react';

export default function GradeEvidence({ project }: { project: Project; onChange: (p: Project) => void }) {
  const results = project.meta.results;
  const studies = project.extraction.studies;
  const robAssessments = project.rob.assessments;

  const robSummary = useMemo(() => {
    let low = 0, some = 0, high = 0;
    for (const a of robAssessments) {
      if (a.overall === 'Low') low++;
      else if (a.overall === 'Some concerns') some++;
      else if (a.overall === 'High' || a.overall === 'Critical') high++;
    }
    return { low, some, high };
  }, [robAssessments]);

  const metaResults = useMemo(() => {
    if (!results) return null;
    const m = results;
    const r = m as any;
    return {
      effect: r.pooled?.effect ?? 0,
      ciLower: r.pooled?.ci_lower ?? 0,
      ciUpper: r.pooled?.ci_upper ?? 0,
      measure: m.measure || 'OR',
      i2: r.heterogeneity?.i2 ?? 0,
      tau2: r.heterogeneity?.tau2 ?? 0,
      qPvalue: r.heterogeneity?.q_p ?? 1,
      k: m.studies?.length ?? studies.length,
      totalN: studies.reduce((s, st) => s + (st.int_n ?? 0) + (st.ctrl_n ?? 0), 0),
    };
  }, [results, studies]);

  const defaultOutcomes = useMemo(() => {
    const o = project.pico.outcomes;
    return o.split(/[;,\n]/).map(s => s.trim()).filter(Boolean);
  }, [project.pico.outcomes]);

  const [outcomes, setOutcomes] = useState<string[]>(
    defaultOutcomes.length > 0 ? defaultOutcomes : ['Primary outcome']
  );
  const [assessments, setAssessments] = useState<Record<string, GradeOutcomeResult>>({});

  const addOutcome = () => {
    setOutcomes([...outcomes, `Outcome ${outcomes.length + 1}`]);
  };

  const updateOutcome = (idx: number, name: string) => {
    const updated = [...outcomes];
    updated[idx] = name;
    setOutcomes(updated);
  };

  const removeOutcome = (idx: number) => {
    const name = outcomes[idx];
    setOutcomes(outcomes.filter((_, i) => i !== idx));
    setAssessments(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const assess = (outcome: string) => {
    if (!metaResults) return;
    const gradeStudies: StudyInput[] = studies.map(s => ({
      study: s.study || 'Unknown',
      int_events: s.int_events ?? 0,
      int_n: s.int_n ?? 0,
      ctrl_events: s.ctrl_events ?? 0,
      ctrl_n: s.ctrl_n ?? 0,
      int_mean: s.int_mean ?? undefined,
      int_sd: s.int_sd ?? undefined,
      ctrl_mean: s.ctrl_mean ?? undefined,
      ctrl_sd: s.ctrl_sd ?? undefined,
    }));

    const result = assessCertainty({
      outcome,
      studies: gradeStudies,
      effect: metaResults.effect,
      ciLower: metaResults.ciLower,
      ciUpper: metaResults.ciUpper,
      measure: metaResults.measure,
      i2: metaResults.i2,
      tau2: metaResults.tau2,
      qPvalue: metaResults.qPvalue,
      robHigh: robSummary.high,
      robSome: robSummary.some,
      robLow: robSummary.low,
      totalN: metaResults.totalN,
      expectedDirection: 'favors_intervention',
    });
    setAssessments({ ...assessments, [outcome]: result });
  };

  const assessAll = () => {
    for (const outcome of outcomes) {
      assess(outcome);
    }
  };

  const exportSoF = () => {
    const lines: string[] = [];
    lines.push('## Summary of Findings Table (GRADE)');
    lines.push('');
    lines.push(`**Review:** ${project.metadata.title || 'Untitled'}`);
    lines.push(`**Comparison:** ${project.pico.intervention || 'Intervention'} vs ${project.pico.comparator || 'Control'}`);
    lines.push('');
    lines.push('### Certainty Assessment');
    lines.push('');
    for (const outcome of outcomes) {
      const a = assessments[outcome];
      if (a) {
        lines.push(gradeToMarkdown(a));
        lines.push(`  - Downgrade reasons: ${getDowngradeReasons(a)}`);
        if (a.upgradeFactors.length > 0) {
          lines.push(`  - Upgrade factors: ${a.upgradeFactors.join('; ')}`);
        }
        lines.push('');
      }
    }
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grade_summary_of_findings.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <Info className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
        <p className="text-[12px] text-[var(--color-text-muted)]">
          The GRADE (Grading of Recommendations Assessment, Development and Evaluation) framework assesses certainty of evidence across 5 domains: Risk of Bias, Inconsistency, Indirectness, Imprecision, and Publication Bias. Assessments are derived from your meta-analysis results and risk-of-bias ratings.
        </p>
      </div>

      {!results ? (
        <EmptyState title="No meta-analysis results">
          Run a meta-analysis first to populate GRADE certainty assessments automatically.
        </EmptyState>
      ) : (
        <>
          <Card title="GRADE Certainty of Evidence" right={
            <div className="flex items-center gap-2">
              <button className="btn-ghost flex items-center gap-1.5" onClick={assessAll}>
                <Sparkles className="h-3.5 w-3.5" /> Assess All
              </button>
              {Object.keys(assessments).length > 0 && (
                <button className="btn-primary flex items-center gap-1.5" onClick={exportSoF}>
                  <Download className="h-3.5 w-3.5" /> Export SoF
                </button>
              )}
            </div>
          }>
            <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
                <div className="text-sm font-semibold text-[var(--color-include)]">{robSummary.low}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Low RoB</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
                <div className="text-sm font-semibold text-[var(--color-unsure)]">{robSummary.some}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Some Concerns</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
                <div className="text-sm font-semibold text-[var(--color-exclude)]">{robSummary.high}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">High RoB</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
                <div className="text-sm font-semibold text-[var(--color-text)]">{metaResults?.i2.toFixed(0)}%</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">I²</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
                <div className="text-sm font-semibold text-[var(--color-text)]">{metaResults?.k}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Studies</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
                <div className="text-sm font-semibold text-[var(--color-text)]">{metaResults?.totalN.toLocaleString()}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Total N</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Outcomes</span>
                <button className="btn-ghost text-[11px]" onClick={addOutcome}>+ Add Outcome</button>
              </div>
              {outcomes.map((outcome, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={outcome}
                    onChange={(e) => updateOutcome(idx, e.target.value)}
                    className="flex-1"
                    placeholder="Outcome name"
                  />
                  <button className="btn-ghost text-[11px]" onClick={() => assess(outcome)}>Assess</button>
                  <button className="btn-ghost text-[11px] text-[var(--color-exclude)]" onClick={() => removeOutcome(idx)}>Remove</button>
                </div>
              ))}
            </div>
          </Card>

          {Object.keys(assessments).length > 0 && (
            <Card title="Summary of Findings">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-[var(--color-text-muted)]">
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-2 py-1.5 text-left font-medium">Outcome</th>
                      <th className="px-2 py-1.5 text-left font-medium">Certainty</th>
                      <th className="px-2 py-1.5 text-left font-medium">Downgraded</th>
                      <th className="px-2 py-1.5 text-left font-medium">Domains</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(assessments).map(([outcome, a]) => (
                      <tr key={outcome} className="border-b border-[var(--color-border)]">
                        <td className="px-2 py-1.5 font-medium text-[var(--color-text)]">{outcome}</td>
                        <td className="px-2 py-1.5">
                          <Pill tone={certTone(a.finalCertainty)}>{certSymbol(a.finalCertainty)}</Pill>
                        </td>
                        <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{a.downgradeScore > 0 ? `−${a.downgradeScore}` : '—'}</td>
                        <td className="px-2 py-1.5 text-[11px] text-[var(--color-text-muted)]">
                          {a.domains.filter(d => d.rating !== 'no').map(d => d.domain).join(', ') || 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 space-y-2">
                {Object.entries(assessments).map(([outcome, a]) => (
                  <div key={outcome} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
                      <span className="text-[12.5px] font-semibold text-[var(--color-text)]">{outcome}</span>
                      <Pill tone={certTone(a.finalCertainty)}>{a.finalCertainty}</Pill>
                    </div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {a.domains.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className={`h-2 w-2 rounded-full ${domainColor(d.rating)}`} />
                          <span className="text-[var(--color-text)]">{d.domain}</span>
                          <span className="text-[var(--color-text-muted)]">— {d.reason}</span>
                        </div>
                      ))}
                    </div>
                    {a.upgradeFactors.length > 0 && (
                      <div className="mt-1 text-[11px] text-[var(--color-include)]">
                        Upgrade: {a.upgradeFactors.join('; ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function certTone(c: string): 'include' | 'exclude' | 'unsure' | 'neutral' {
  if (c === 'High') return 'include';
  if (c === 'Moderate') return 'unsure';
  if (c === 'Low' || c === 'Very Low') return 'exclude';
  return 'neutral';
}

function certSymbol(c: string): string {
  if (c === 'High') return 'High';
  if (c === 'Moderate') return 'Moderate';
  if (c === 'Low') return 'Low';
  return 'Very Low';
}

function domainColor(rating: string): string {
  if (rating === 'no') return 'bg-[var(--color-include)]';
  if (rating === 'serious') return 'bg-[var(--color-unsure)]';
  return 'bg-[var(--color-exclude)]';
}
