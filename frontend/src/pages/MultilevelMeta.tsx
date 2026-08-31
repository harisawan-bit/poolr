import { Card } from '../components/ui';

export default function MultilevelMeta({ project: _project, onChange: _onChange }: { project: any; onChange: (p: any) => void }) {
  return (
    <div className="space-y-3">
      <Card title="Multilevel Meta-Analysis">
        <div className="rounded-[5px] border border-dashed border-[var(--color-border)] p-8 text-center">
          <div className="text-[14px] font-medium text-[var(--color-text)]">Multilevel Meta-Analysis</div>
          <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
            Handle dependent effect sizes (multiple outcomes per study) with three-level models and heterogeneity decomposition.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Three-Level Model</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">τ² Decomposition</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Dependency Specification</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
