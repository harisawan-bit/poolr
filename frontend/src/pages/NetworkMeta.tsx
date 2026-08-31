import { Card } from '../components/ui';

export default function NetworkMeta({ project: _project, onChange: _onChange }: { project: any; onChange: (p: any) => void }) {
  return (
    <div className="space-y-3">
      <Card title="Network Meta-Analysis">
        <div className="rounded-[5px] border border-dashed border-[var(--color-border)] p-8 text-center">
          <div className="text-[14px] font-medium text-[var(--color-text)]">Network Meta-Analysis</div>
          <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
            Compare multiple treatments using network geometry, league tables, SUCRA rankings, and node-splitting for inconsistency.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Network Geometry</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">League Table</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">SUCRA Rankings</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">Node-Splitting</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
