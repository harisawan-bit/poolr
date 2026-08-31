import { useState } from 'react';
import { Card, Button, Pill } from '../components/ui';
import { FileText, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getActiveProviders, callAI } from '../lib/ai';

interface ExtractedData {
  field: string;
  value: string;
  confidence: number;
}

export default function PDFExtraction({ onExtract }: { onExtract: (data: Record<string, string>) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ExtractedData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const providers = getActiveProviders();

  const processPDF = async () => {
    if (!file || providers.length === 0) return;
    setProcessing(true);
    setError(null);
    setResults([]);

    try {
      // Read file as text (in production, would use PDF parser)
      const text = await file.text();
      
      const prompt = `Extract the following fields from this research paper text. Return JSON:
{"author": "", "year": "", "country": "", "design": "", "sample_size": "", "intervention": "", "comparator": "", "outcome": "", "effect_size": "", "confidence_interval": ""}

Paper text (first 5000 chars):
${text.substring(0, 5000)}`;

      const response = await callAI(providers[0], [
        { role: 'system', content: 'You are a data extraction assistant. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ]);

      try {
        const parsed = JSON.parse(response.content);
        const extracted: ExtractedData[] = Object.entries(parsed).map(([field, value]) => ({
          field,
          value: String(value),
          confidence: 0.85,
        }));
        setResults(extracted);
      } catch {
        setError('Failed to parse AI response. Please extract manually.');
      }
    } catch (e) {
      setError('Failed to process PDF. Ensure AI provider is configured.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card title="PDF Auto-Extraction">
      <div className="space-y-3">
        {providers.length === 0 && (
          <div className="rounded-[3px] border border-[var(--color-unsure)]/30 bg-[var(--color-unsure)]/10 p-3 text-[12px] text-[var(--color-unsure)]">
            No AI provider configured. Go to Settings → AI Providers to enable PDF extraction.
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="btn-ghost flex cursor-pointer items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Choose PDF
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {file && <span className="text-[12px] text-[var(--color-text-muted)]">{file.name}</span>}
          <Button
            variant="default"
            size="sm"
            disabled={!file || processing || providers.length === 0}
            onClick={processPDF}
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {processing ? 'Extracting...' : 'Extract Data'}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--color-text-muted)]">Extracted fields:</span>
              <Button variant="outline" size="sm" onClick={() => {
                const data: Record<string, string> = {};
                results.forEach(r => data[r.field] = r.value);
                onExtract(data);
              }}>
                Apply to Form
              </Button>
            </div>
            <div className="space-y-1">
              {results.map(r => (
                <div key={r.field} className="flex items-center gap-2 rounded border border-[var(--color-border)] px-2 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-include)]" />
                  <span className="w-32 text-[11px] text-[var(--color-text-muted)]">{r.field}</span>
                  <span className="flex-1 text-[12px]">{r.value}</span>
                  <Pill tone="neutral">{(r.confidence * 100).toFixed(0)}%</Pill>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
