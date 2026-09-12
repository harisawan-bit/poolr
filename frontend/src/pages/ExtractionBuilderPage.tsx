import { useState } from 'react';
import { Card, Button, Pill } from '../components/ui';
import { getBuiltInTemplates, exportExtractionToCsv } from '../lib/extraction-templates';
import type { ExtractionTemplate } from '../lib/extraction-templates';
import { FileText, Download, Check } from 'lucide-react';

export default function ExtractionBuilderPage() {
  const templates = getBuiltInTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractionTemplate>(templates[0]);
  const [showExport, setShowExport] = useState(false);

  const handleExportTemplate = () => {
    const sampleData = [{
      templateId: selectedTemplate.id,
      studyId: 'SAMPLE_001',
      values: {},
      timestamp: new Date().toISOString(),
      reviewer: 'Reviewer1',
    }];
    const csv = exportExtractionToCsv(sampleData, selectedTemplate);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extraction_form_${selectedTemplate.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(true);
    setTimeout(() => setShowExport(false), 2000);
  };

  const sections = [...new Set(selectedTemplate.fields.map(f => f.section))];

  return (
    <div className="space-y-4">
      <Card title="Data Extraction Form Builder">
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Generate structured extraction templates for your systematic review. Export as CSV for use in Excel, REDCap, or OpenClinica.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {templates.map(t => (
            <button
              key={t.id}
              className={`btn-ghost text-[11px] ${selectedTemplate.id === t.id ? '!border-[var(--color-accent)] !text-[var(--color-text)]' : ''}`}
              onClick={() => setSelectedTemplate(t)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </Card>

      <Card title={selectedTemplate.name} right={
        <Button variant="outline" size="sm" onClick={handleExportTemplate}>
          {showExport ? <><Check className="h-3 w-3 mr-1" /> Exported</> : <><Download className="h-3 w-3 mr-1" /> Export CSV</>}
        </Button>
      }>
        <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">{selectedTemplate.description}</p>
        <div className="mb-3 flex items-center gap-2">
          <Pill tone="neutral">{selectedTemplate.fields.length} fields</Pill>
          <Pill tone="neutral">{sections.length} sections</Pill>
          <Pill tone="accent">{selectedTemplate.studyType}</Pill>
        </div>

        {sections.map(section => (
          <div key={section} className="mb-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {section}
            </div>
            <div className="space-y-2">
              {selectedTemplate.fields.filter(f => f.section === section).map(field => (
                <div key={field.id} className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                  <FileText className="h-3 w-3 text-[var(--color-text-muted)]" />
                  <span className="flex-1 text-[12px] text-[var(--color-text)]">{field.label}</span>
                  <Pill tone="neutral">{field.type}</Pill>
                  {field.required && <Pill tone="exclude">Required</Pill>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
