import { useState } from 'react';
import { Card, Button } from '../components/ui';
import { getProsperoSections, generateProsperoMarkdown, getCompletionPercentage } from '../lib/prospero';
import { Download, Check, AlertCircle, ChevronRight } from 'lucide-react';

export default function ProsperoPage({ project }: { project: any }) {
  const sections = getProsperoSections();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({
    reviewTitle: project.metadata?.title || '',
    reviewQuestion: project.protocol?.objective || '',
    population: project.pico?.population || '',
    intervention: project.pico?.intervention || '',
    comparator: project.pico?.comparator || '',
    outcome: project.pico?.outcomes || '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [exported, setExported] = useState(false);

  const currentSection = sections[currentStep];

  const updateField = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleNext = () => {
    const sectionErrors = validateSection(currentSection.id, formData);
    if (sectionErrors.length > 0) {
      setErrors(sectionErrors);
      return;
    }
    setErrors([]);
    setCurrentStep(prev => Math.min(prev + 1, sections.length - 1));
  };

  const handlePrev = () => {
    setErrors([]);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleExport = () => {
    const markdown = generateProsperoMarkdown(formData);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prospero_protocol.md';
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  const completion = getCompletionPercentage(formData);

  return (
    <div className="space-y-4">
      <Card title="PROSPERO Registration Wizard">
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Step-by-step protocol builder for PROSPERO registration. Completeness: {completion}%
        </p>
        <div className="mt-3 h-2 w-full rounded-full bg-[var(--color-border)]/30">
          <div
            className="h-full rounded-full bg-[var(--color-accent)]/70 transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
      </Card>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2">
        {sections.map((section, idx) => (
          <button
            key={section.id}
            className={`btn-ghost text-[11px] ${idx === currentStep ? '!border-[var(--color-accent)] !text-[var(--color-text)]' : ''}`}
            onClick={() => { setCurrentStep(idx); setErrors([]); }}
          >
            {idx + 1}. {section.title}
          </button>
        ))}
      </div>

      {/* Current section form */}
      <Card title={currentSection.title}>
        <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">{currentSection.description}</p>

        {errors.length > 0 && (
          <div className="mb-3 rounded-md border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 p-2">
            {errors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px] text-[var(--color-exclude)]">
                <AlertCircle className="h-3 w-3" /> {err}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {currentSection.fields.map(field => (
            <div key={field.id}>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {field.label}
                {field.required && <span className="ml-1 text-[var(--color-exclude)]">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  className="w-full rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  rows={3}
                  placeholder={field.placeholder}
                  value={formData[field.id] || ''}
                  onChange={e => updateField(field.id, e.target.value)}
                />
              ) : field.type === 'select' ? (
                <select
                  className="w-full rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  value={formData[field.id] || field.value}
                  onChange={e => updateField(field.id, e.target.value)}
                >
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === 'date' ? (
                <input
                  type="date"
                  className="w-full rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  value={formData[field.id] || ''}
                  onChange={e => updateField(field.id, e.target.value)}
                />
              ) : field.type === 'multi-select' ? (
                <div className="flex flex-wrap gap-1.5">
                  {field.options?.map(opt => {
                    const selected = (formData[field.id] || []).includes(opt);
                    return (
                      <button
                        key={opt}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                          selected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-[var(--color-text)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
                        }`}
                        onClick={() => {
                          const current = formData[field.id] || [];
                          const next = selected ? current.filter((v: string) => v !== opt) : [...current, opt];
                          updateField(field.id, next);
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  className="w-full rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  placeholder={field.placeholder}
                  value={formData[field.id] || ''}
                  onChange={e => updateField(field.id, e.target.value)}
                />
              )}
              {field.helpText && (
                <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">{field.helpText}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            className="btn-ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            ← Previous
          </button>
          <div className="flex items-center gap-2">
            {currentStep === sections.length - 1 && (
              <Button variant="default" size="sm" onClick={handleExport}>
                {exported ? <><Check className="h-3 w-3 mr-1" /> Exported!</> : <><Download className="h-3 w-3 mr-1" /> Export Protocol</>}
              </Button>
            )}
            {currentStep < sections.length - 1 && (
              <button className="btn-primary" onClick={handleNext}>
                Next <ChevronRight className="ml-1 h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function validateSection(sectionId: string, data: Record<string, any>): string[] {
  const sections = getProsperoSections();
  const section = sections.find(s => s.id === sectionId);
  if (!section) return [];
  const errors: string[] = [];
  for (const field of section.fields) {
    if (!field.required) continue;
    const v = data[field.id];
    if (!v || (Array.isArray(v) && v.length === 0)) {
      errors.push(`${field.label} is required`);
    }
  }
  return errors;
}
