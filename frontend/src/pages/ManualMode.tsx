import { useState } from 'react';
import { Card, Button, Textarea } from '../components/ui';
import { FileText, Code, Upload } from 'lucide-react';

export default function ManualMode({ project, onChange }: { project: any; onChange: (p: any) => void }) {
  const [jsonData, setJsonData] = useState(JSON.stringify(project, null, 2));
  const [script, setScript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const applyJSON = () => {
    try {
      const parsed = JSON.parse(jsonData);
      onChange(parsed);
      setError(null);
    } catch (e) {
      setError('Invalid JSON: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <Card title="Manual Mode">
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Full control over your review. Edit the project JSON directly, write custom R/Python scripts, or paste data from any source.
          </p>

          {/* JSON Editor */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="text-[12px] font-medium">Project JSON</span>
            </div>
            <Textarea
              className="font-mono text-[11px]"
              rows={12}
              value={jsonData}
              onChange={e => setJsonData(e.target.value)}
            />
            <button className="btn-primary mt-2" onClick={applyJSON}>Apply JSON</button>
            {error && <div className="mt-2 text-[12px] text-[var(--color-exclude)]">{error}</div>}
          </div>

          {/* Custom Script */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="text-[12px] font-medium">Custom R / Python Script</span>
            </div>
            <Textarea
              className="font-mono text-[11px]"
              rows={8}
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="# Paste your R or Python script here..."
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
