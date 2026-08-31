import { useState } from 'react';
import { Card, Button } from '../components/ui';
import { RefreshCw, Clock, CheckCircle2 } from 'lucide-react';

interface LivingReviewConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  databases: string[];
  lastRun: string | null;
  nextRun: string | null;
  autoImport: boolean;
  newStudiesCount: number;
}

export default function LivingReviews() {
  const [config, setConfig] = useState<LivingReviewConfig>({
    enabled: false,
    frequency: 'weekly',
    databases: ['PubMed', 'ClinicalTrials.gov'],
    lastRun: null,
    nextRun: null,
    autoImport: false,
    newStudiesCount: 0,
  });
  const [running, setRunning] = useState(false);

  const runUpdate = async () => {
    setRunning(true);
    // In production, this would trigger the engine to re-run searches
    setTimeout(() => {
      setConfig({
        ...config,
        lastRun: new Date().toISOString(),
        nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        newStudiesCount: Math.floor(Math.random() * 5),
      });
      setRunning(false);
    }, 2000);
  };

  return (
    <Card title="Living Systematic Review">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={e => setConfig({ ...config, enabled: e.target.checked })}
          />
          <span className="text-[12px]">Enable automatic updates</span>
        </div>

        {config.enabled && (
          <>
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Update Frequency</label>
              <div className="flex gap-1">
                {(['daily', 'weekly', 'monthly'] as const).map(f => (
                  <button
                    key={f}
                    className={`btn-ghost text-[11px] ${config.frequency === f ? '!text-[var(--color-text)] !border-[var(--color-border-strong)]' : ''}`}
                    onClick={() => setConfig({ ...config, frequency: f })}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Databases to Search</label>
              <div className="flex flex-wrap gap-1">
                {['PubMed', 'ClinicalTrials.gov', 'Scopus', 'Web of Science', 'Embase'].map(db => (
                  <button
                    key={db}
                    className={`btn-ghost text-[10px] ${config.databases.includes(db) ? '!text-[var(--color-text)] !border-[var(--color-border-strong)]' : ''}`}
                    onClick={() => {
                      const dbs = config.databases.includes(db)
                        ? config.databases.filter(d => d !== db)
                        : [...config.databases, db];
                      setConfig({ ...config, databases: dbs });
                    }}
                  >
                    {db}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.autoImport}
                onChange={e => setConfig({ ...config, autoImport: e.target.checked })}
              />
              <span className="text-[12px]">Auto-import new studies to screening queue</span>
            </div>

            {config.lastRun && (
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-[11px]">
                <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                  <Clock className="h-3 w-3" />
                  Last run: {new Date(config.lastRun).toLocaleDateString()}
                </div>
                {config.nextRun && (
                  <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                    <RefreshCw className="h-3 w-3" />
                    Next run: {new Date(config.nextRun).toLocaleDateString()}
                  </div>
                )}
                {config.newStudiesCount > 0 && (
                  <div className="flex items-center gap-1 text-[var(--color-include)]">
                    <CheckCircle2 className="h-3 w-3" />
                    {config.newStudiesCount} new studies found
                  </div>
                )}
              </div>
            )}

            <Button
              variant="default"
              size="sm"
              disabled={running}
              onClick={runUpdate}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Running...' : 'Run Update Now'}
            </Button>
          </>
        )}

        <div className="text-[11px] text-[var(--color-text-muted)]">
          Living systematic reviews automatically search for new evidence on a schedule, helping you keep your review up-to-date.
        </div>
      </div>
    </Card>
  );
}
