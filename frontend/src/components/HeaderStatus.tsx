import { Save, CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface Props {
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  connected: boolean | null;
}

export default function HeaderStatus({ saveState, connected }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1"
        title={connected === null ? 'Connecting...' : connected ? 'Engine online' : 'Engine offline'}
      >
        {connected === null ? (
          <AlertCircle className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        ) : connected ? (
          <Wifi className="h-3.5 w-3.5 text-[var(--color-include)]" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-[var(--color-exclude)]" />
        )}
      </div>
      <div
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1"
        title={`Save status: ${saveState}`}
      >
        {saveState === 'saving' ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-text-muted)] border-t-transparent" />
        ) : saveState === 'saved' ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-include)]" />
        ) : saveState === 'error' ? (
          <XCircle className="h-3.5 w-3.5 text-[var(--color-exclude)]" />
        ) : (
          <Save className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        )}
      </div>
    </div>
  );
}
