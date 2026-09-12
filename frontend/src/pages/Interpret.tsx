import { useState } from 'react';
import type { Project } from '../lib/project';
import { Card, EmptyState } from '../components/ui';
import { Download, Copy, Check, Lightbulb } from 'lucide-react';
import { generatePlainTextInterpretation } from '../lib/interpretation';

export default function Interpret({ project }: { project: Project; onChange: (p: Project) => void }) {
  const results = project.meta.results;
  const [copied, setCopied] = useState<string | null>(null);

  const generateAll = (): { section: string; text: string }[] => {
    if (!results) return [];
    return generatePlainTextInterpretation(project);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExport = () => {
    const sections = generateAll();
    const text = sections.map(s => `## ${s.section}\n\n${s.text}`).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interpretation.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <Lightbulb className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
        <p className="text-[12px] text-[var(--color-text-muted)]">
          This page generates plain-language interpretations of your meta-analysis results. 
          It covers the pooled effect, heterogeneity, sensitivity analyses, and clinical implications 
          — ready for manuscript or report use.
        </p>
      </div>

      {!results ? (
        <EmptyState title="No meta-analysis results">
          Run a meta-analysis first to generate interpretations.
        </EmptyState>
      ) : (
        <>
          <div className="flex justify-end">
            <button className="btn-primary flex items-center gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Export All
            </button>
          </div>

          {generateAll().map((section, idx) => (
            <Card
              key={idx}
              title={section.section}
              right={
                <button
                  className="btn-ghost flex items-center gap-1.5"
                  onClick={() => handleCopy(section.text, `section-${idx}`)}
                >
                  {copied === `section-${idx}` ? (
                    <><Check className="h-3.5 w-3.5" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copy</>
                  )}
                </button>
              }
            >
              <div className="prose prose-sm max-w-none">
                {section.text.split('\n').map((line, i) => (
                  <p key={i} className="text-[12.5px] leading-relaxed text-[var(--color-text)]">
                    {line}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
