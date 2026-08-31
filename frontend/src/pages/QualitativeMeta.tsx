import { Card } from '../components/ui';

export default function QualitativeMeta({ project: _project, onChange: _onChange }: { project: any; onChange: (p: any) => void }) {
  return (
    <div className="space-y-3">
      <Card title="Qualitative Synthesis">
        <div className="rounded-[5px] border border-dashed border-[var(--color-border)] p-8 text-center">
          <div className="text-[14px] font-medium text-[var(--color-text)]">Qualitative Synthesis</div>
          <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
            Thematic coding, code book management, thematic mapping, and narrative synthesis export.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Thematic Coding</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Code Book</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Thematic Map</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Narrative Export</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
