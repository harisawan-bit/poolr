import { useState, useMemo } from 'react';
import { Card, Button, Textarea } from '../components/ui';
import { Download, Copy, Check, FileText, Pen } from 'lucide-react';
import type { Project } from '../lib/project';
import { draftManuscriptTemplate } from '../lib/manuscript';

export default function ManuscriptHelper({ project }: { project: Project; onChange: (p: Project) => void }) {
  const results = project.meta.results;
  const [activeSection, setActiveSection] = useState<'title' | 'abstract' | 'introduction' | 'methods' | 'results' | 'discussion' | 'conclusion'>('introduction');
  const [customNotes, setCustomNotes] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const template = useMemo(() => {
    return draftManuscriptTemplate(project, customNotes);
  }, [project, customNotes]);

  const sections: { key: typeof activeSection; label: string }[] = [
    { key: 'title', label: 'Title' },
    { key: 'abstract', label: 'Abstract' },
    { key: 'introduction', label: 'Introduction' },
    { key: 'methods', label: 'Methods' },
    { key: 'results', label: 'Results' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'conclusion', label: 'Conclusion' },
  ];

  const sectionContent = template[activeSection] || '';

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportFullDraft = () => {
    const text = sections.map(s => {
      const content = template[s.key] || '';
      return `## ${s.label}\n\n${content}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([`# ${project.metadata.title || 'Untitled Systematic Review'}\n\n${text}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manuscript_draft.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  };

  const exportToWord = () => {
    // Simple HTML-to-doc conversion
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${project.metadata.title || 'Manuscript'}</title></head><body style="font-family: Times New Roman, serif; max-width: 7in; margin: 1in auto;">
      <h1>${project.metadata.title || 'Untitled Systematic Review'}</h1>
      ${sections.map(s => `<h2>${s.label}</h2><p>${(template[s.key] || '').replace(/\n/g, '<br>')}</p>`).join('\n')}
      </body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manuscript_draft.doc';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  };

  const studyCount = project.extraction.studies.length;
  const totalN = project.extraction.studies.reduce((s, st) => s + (st.int_n ?? 0) + (st.ctrl_n ?? 0), 0);
  const robCount = project.rob.assessments.length;
  const robLow = project.rob.assessments.filter(a => a.overall === 'Low').length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <Pen className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
        <p className="text-[12px] text-[var(--color-text-muted)]">
          This page generates structured manuscript sections from your review data. 
          All text is drafted from your PICO, meta-analysis results, and risk-of-bias assessments — 
          ready for editing in your preferred word processor.
        </p>
      </div>

      <Card title="Draft Statistics">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
            <div className="text-lg font-semibold text-[var(--color-text)]">{studyCount}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Studies</div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
            <div className="text-lg font-semibold text-[var(--color-text)]">{totalN.toLocaleString()}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Total N</div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
            <div className="text-lg font-semibold text-[var(--color-include)]">{robLow}/{robCount}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Low RoB</div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2 text-center">
            <div className="text-lg font-semibold text-[var(--color-accent)]">{results ? 'Yes' : 'No'}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Meta-Analysis</div>
          </div>
        </div>
      </Card>

      <Card title="Author Notes">
        <Textarea
          rows={3}
          placeholder="Add context for the draft (e.g., 'Focus on pediatric population', 'Include comparison with Smith et al. 2020')"
          value={customNotes}
          onChange={e => setCustomNotes(e.target.value)}
        />
      </Card>

      <Card title="Sections" right={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportFullDraft}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export .md
          </Button>
          <Button variant="default" size="sm" onClick={exportToWord}>
            <FileText className="h-3.5 w-3.5 mr-1" /> Export .doc
          </Button>
        </div>
      }>
        <div className="mb-3 flex flex-wrap gap-1">
          {sections.map(s => (
            <button
              key={s.key}
              className={`btn-ghost ${activeSection === s.key ? '!text-[var(--color-text)] !border-[var(--color-border-strong)]' : ''}`}
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-[var(--color-text)]">{sections.find(s => s.key === activeSection)?.label}</span>
          <button
            className="btn-ghost text-[11px]"
            onClick={() => handleCopy(sectionContent, activeSection)}
          >
            {copied === activeSection ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </button>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-3 min-h-[200px]">
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-[var(--color-text)]">
            {sectionContent}
          </pre>
        </div>

        <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          {activeSection === 'title' && 'A concise, informative title that captures the PICO elements and study design.'}
          {activeSection === 'abstract' && 'Structured abstract following PRISMA-A guidelines. Edit to match journal requirements.'}
          {activeSection === 'introduction' && 'Background, rationale, and objectives structured with PICO elements.'}
          {activeSection === 'methods' && 'Methodology follows PRISMA 2020 reporting guidelines.'}
          {activeSection === 'results' && 'Results summary drawn from your screening data and meta-analysis output.'}
          {activeSection === 'discussion' && 'Interpretation of findings, limitations, and implications.'}
          {activeSection === 'conclusion' && 'Concise statement of main findings and implications.'}
        </div>
      </Card>
    </div>
  );
}
