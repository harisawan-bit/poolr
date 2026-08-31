import { Card } from '../components/ui';

export default function IPDMeta({ project: _project, onChange: _onChange }: { project: any; onChange: (p: any) => void }) {
  return (
    <div className="space-y-3">
      <Card title="IPD Meta-Analysis">
        <div className="rounded-[5px] border border-dashed border-[var(--color-border)] p-8 text-center">
          <div className="text-[14px] font-medium text-[var(--color-text)]">Individual Participant Data Meta-Analysis</div>
          <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
            Upload patient-level datasets for one-stage or two-stage IPD meta-analysis with subgroup × treatment interaction testing.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">IPD Upload</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">One-Stage Model</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Two-Stage Model</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Patient-Level Forest</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
