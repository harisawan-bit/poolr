import { useState } from 'react';
import { Card, Textarea } from '../components/ui';
import { FileText, Code, Copy, Download, Play, Check } from 'lucide-react';

export default function ManualMode({ project, onChange }: { project: any; onChange: (p: any) => void }) {
  const [jsonData, setJsonData] = useState(JSON.stringify(project, null, 2));
  const [script, setScript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const applyJSON = () => {
    try {
      const parsed = JSON.parse(jsonData);
      onChange(parsed);
      setError(null);
    } catch (e) {
      setError('Invalid JSON: ' + (e as Error).message);
    }
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(jsonData);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poolr_project.json';
    a.click();
    URL.revokeObjectURL(url);
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
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span className="text-[12px] font-medium">Project JSON</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="btn-ghost flex items-center gap-1" onClick={handleCopyJson} title="Copy JSON to clipboard">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button className="btn-ghost flex items-center gap-1" onClick={handleDownloadJson} title="Download as poolr_project.json">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>
            <Textarea
              className="font-mono text-[11px]"
              rows={12}
              value={jsonData}
              onChange={e => setJsonData(e.target.value)}
            />
            <div className="mt-2 flex items-center gap-2">
              <button className="btn-primary" onClick={applyJSON}>Apply JSON</button>
              <span className="text-[11px] text-[var(--color-text-muted)]">Replaces the entire project — autosaves.</span>
            </div>
            {error && <div className="mt-2 text-[12px] text-[var(--color-exclude)]">{error}</div>}
          </div>

          {/* Custom Script */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span className="text-[12px] font-medium">Custom R / Python Script</span>
              </div>
              <button
                className="btn-ghost flex items-center gap-1"
                disabled={!script.trim()}
                onClick={() => alert('Script execution requires a connected R or Python kernel. Export your data and run externally for now.')}
              >
                <Play className="h-3.5 w-3.5" />
                Run Script
              </button>
            </div>
            <Textarea
              className="font-mono text-[11px]"
              rows={8}
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="# Paste your R or Python script here..."
            />
            <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">
              Tip: Use the Meta-Analysis replication suite to export R/Stata/Python scripts for your data.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
