import { useState } from 'react';
import { Card, Button } from './ui';
import { Network, Database, BarChart3, FileText, ListChecks, Settings, Sigma } from 'lucide-react';

const STUDY_TYPES = [
  { id: 'standard', name: 'Standard Meta-Analysis', desc: 'Binary, continuous, survival outcomes', icon: Sigma },
  { id: 'network', name: 'Network Meta-Analysis', desc: 'Multiple treatments, SUCRA rankings', icon: Network },
  { id: 'ipd', name: 'IPD Meta-Analysis', desc: 'Individual participant data', icon: Database },
  { id: 'multilevel', name: 'Multilevel Meta-Analysis', desc: 'Dependent effect sizes', icon: BarChart3 },
  { id: 'diagnostic', name: 'Diagnostic Accuracy', desc: 'SROC, sensitivity/specificity', icon: FileText },
  { id: 'proportions', name: 'Proportions / Rates', desc: 'Single-arm pooling', icon: ListChecks },
  { id: 'qualitative', name: 'Qualitative Synthesis', desc: 'Thematic analysis', icon: FileText },
  { id: 'manual', name: 'Manual Mode', desc: 'Full control, no guided workflow', icon: Settings },
];

interface Props {
  onSelect: (type: string) => void;
}

export default function StudyTypeSelector({ onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Card title="Choose Study Type">
        <p className="mb-4 text-[12px] text-[var(--color-text-muted)]">
          Select the type of review you want to conduct. Each type enables specific features and workflows.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {STUDY_TYPES.map(st => (
            <button
              key={st.id}
              className={`flex items-start gap-3 rounded-[5px] border p-3 text-left transition-colors ${
                selected === st.id
                  ? 'border-[var(--color-accent)] bg-[var(--color-surface-2)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--hover-surface)]'
              }`}
              onClick={() => setSelected(st.id)}
            >
              <st.icon className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <div className="text-[12px] font-medium">{st.name}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">{st.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="default"
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
          >
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
