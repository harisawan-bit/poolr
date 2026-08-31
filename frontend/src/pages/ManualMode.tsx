import { Card } from '../components/ui';

export default function ManualMode({ project: _project, onChange: _onChange }: { project: any; onChange: (p: any) => void }) {
  return (
    <div className="space-y-3">
      <Card title="Manual Mode">
        <div className="rounded-[5px] border border-dashed border-[var(--color-border)] p-8 text-center">
          <div className="text-[14px] font-medium text-[var(--color-text)]">Manual Mode</div>
          <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
            Full control over your review. No guided workflow. Paste custom R/Python scripts, define your own data structure, and export in any format.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Free-Form Data</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Custom Scripts</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Any Format</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
