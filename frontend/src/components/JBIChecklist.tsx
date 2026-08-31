import { useState } from 'react';
import { Card, Input, Select } from '../components/ui';

const JBI_QUAL_ITEMS = [
  { id: 'q1', text: 'Is there congruity between the stated philosophical perspective and the research methodology?' },
  { id: 'q2', text: 'Is there congruity between the research methodology and the research question or objectives?' },
  { id: 'q3', text: 'Is there congruity between the research methodology and the methods used to collect data?' },
  { id: 'q4', text: 'Is there congruity between the research methodology and the representation and analysis of data?' },
  { id: 'q5', text: 'Is there congruity between the research methodology and the interpretation of results?' },
  { id: 'q6', text: 'Is there a statement locating the researcher culturally or theoretically?' },
  { id: 'q7', text: 'Is the influence of the researcher on the research, and vice-versa, addressed?' },
  { id: 'q8', text: 'Are participants, and their voices, adequately represented?' },
  { id: 'q9', text: 'Is the research ethical according to current criteria or, for recent studies, is there evidence of ethical approval by an appropriate body?' },
  { id: 'q10', text: 'Do the conclusions drawn in the research report flow from the analysis, or interpretation, of the data?' },
];

const JBI_PREVALENCE_ITEMS = [
  { id: 'q1', text: 'Was the sample frame appropriate to address the target population?' },
  { id: 'q2', text: 'Were study participants sampled in an appropriate way?' },
  { id: 'q3', text: 'Was the sample size adequate?' },
  { id: 'q4', text: 'Were the study subjects and the setting described in detail?' },
  { id: 'q5', text: 'Was data analysis conducted with sufficient coverage of the identified sample?' },
  { id: 'q6', text: 'Were valid methods used for the identification of the condition?' },
  { id: 'q7', text: 'Was the condition measured in a standard, reliable way for all participants?' },
  { id: 'q8', text: 'Was there appropriate statistical analysis?' },
  { id: 'q9', text: 'Was the response rate adequate, and if not, was the low response rate managed appropriately?' },
];

type Response = 'yes' | 'no' | 'unclear' | 'na';

export default function JBIChecklist() {
  const [variant, setVariant] = useState<'qualitative' | 'prevalence'>('qualitative');
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [studyName, setStudyName] = useState('');

  const items = variant === 'qualitative' ? JBI_QUAL_ITEMS : JBI_PREVALENCE_ITEMS;

  const yesCount = Object.values(responses).filter(r => r === 'yes').length;
  const totalAnswered = Object.values(responses).filter(r => r !== undefined).length;
  const qualityScore = totalAnswered > 0 ? (yesCount / totalAnswered) * 100 : 0;

  return (
    <Card title="JBI Critical Appraisal Checklist">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Select value={variant} onChange={e => setVariant(e.target.value as any)}>
            <option value="qualitative">Qualitative Studies (10 items)</option>
            <option value="prevalence">Prevalence Studies (9 items)</option>
          </Select>
          <Input
            value={studyName}
            onChange={e => setStudyName(e.target.value)}
            placeholder="Study name..."
            className="flex-1"
          />
        </div>

        {totalAnswered > 0 && (
          <div className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5">
            <div className="flex-1">
              <div className="h-2 rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${qualityScore}%` }}
                />
              </div>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {yesCount}/{totalAnswered} ({qualityScore.toFixed(0)}%)
            </span>
          </div>
        )}

        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="rounded border border-[var(--color-border)] p-2">
              <div className="mb-1 text-[11px] text-[var(--color-text)]">
                {item.id.toUpperCase()}: {item.text}
              </div>
              <div className="flex gap-1">
                {(['yes', 'no', 'unclear', 'na'] as Response[]).map(r => (
                  <button
                    key={r}
                    className={`btn-ghost text-[10px] py-0.5 px-2 ${
                      responses[item.id] === r ? '!text-[var(--color-text)] !border-[var(--color-border-strong)]' : ''
                    }`}
                    onClick={() => setResponses({ ...responses, [item.id]: r })}
                  >
                    {r === 'na' ? 'N/A' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-[var(--color-text-muted)]">
          The JBI Critical Appraisal Checklist is used to assess the methodological quality of studies included in systematic reviews.
        </div>
      </div>
    </Card>
  );
}
