import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, ChevronDown } from 'lucide-react';
import { Card, Button, Pill } from '../../components/ui';
import { getActiveProviders, callAIMultiProvider, type AIProvider, type AIResponse } from '../../lib/ai';
import { loadSettings } from '../../lib/settings';
import type { ScreeningItem } from '../../lib/project';

interface Props {
  items: ScreeningItem[];
  pico: { population: string; intervention: string; comparator: string; outcomes: string };
  inclusionCriteria: string;
  exclusionCriteria: string;
  onDecisions: (decisions: { id: string; decision: 'include' | 'exclude' | 'unsure'; confidence: number }[]) => void;
}

interface RecordResult {
  id: string;
  decisions: { provider: string; model: string; decision: string; reason: string; confidence: number }[];
  consensus: 'include' | 'exclude' | 'unsure';
  avgConfidence: number;
  agreement: number;
}

export function aggregateResults(batch: Pick<ScreeningItem, 'id'>[], responses: AIResponse[]): RecordResult[] {
  const providers = responses.flatMap(response => {
    try {
      const records: unknown = JSON.parse(response.content);
      return Array.isArray(records) ? [{ response, records }] : [];
    } catch {
      return [];
    }
  });

  return batch.flatMap(({ id }) => {
    const decisions = providers.flatMap(({ response, records }) => {
      const match = records.find(record => record?.id === id);
      if (!match || !['include', 'exclude', 'unsure'].includes(match.decision) ||
          !Number.isFinite(match.confidence) || match.confidence < 0 || match.confidence > 1) return [];
      return [{
        provider: response.providerName, model: response.model, decision: match.decision,
        reason: typeof match.reason === 'string' ? match.reason : '', confidence: match.confidence,
      }];
    });
    if (decisions.length === 0) return [];
    const votes = { include: 0, exclude: 0, unsure: 0 };
    for (const decision of decisions) votes[decision.decision as keyof typeof votes]++;
    const ranked = (Object.keys(votes) as (keyof typeof votes)[]).sort((a, b) => votes[b] - votes[a]);
    const consensus = votes[ranked[0]] === votes[ranked[1]] ? 'unsure' : ranked[0];
    return {
      id, decisions, consensus,
      avgConfidence: decisions.reduce((sum, decision) => sum + decision.confidence, 0) / decisions.length,
      agreement: votes[consensus] / decisions.length,
    };
  });
}

export default function AIScreeningPanel({ items, pico, inclusionCriteria, exclusionCriteria, onDecisions }: Props) {
  const [allProviders, setAllProviders] = useState<AIProvider[]>(getActiveProviders());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, perModel: {} as Record<string, number> });
  const [results, setResults] = useState<RecordResult[]>([]);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const settings = loadSettings();

  const activeProviders = allProviders;

  const runScreening = async () => {
    const providers = activeProviders;
    setAllProviders(providers);
    if (providers.length === 0) return;

    setProcessing(true);
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: items.length, perModel: {} });

    const configuredBatchSize = settings.ai.batchSize;
    const batchSize = Number.isSafeInteger(configuredBatchSize) && configuredBatchSize > 0 ? configuredBatchSize : 50;
    const allResults: RecordResult[] = [];

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        setProgress(prev => ({
          ...prev,
          current: Math.min(i + batchSize, items.length),
        }));

        const prompt = buildPrompt(batch, pico, inclusionCriteria, exclusionCriteria);
        const responses = await callAIMultiProvider(providers, [
          { role: 'system', content: 'You are a systematic review screening assistant. Respond with ONLY a JSON array.' },
          { role: 'user', content: prompt },
        ]);

        const batchResults = aggregateResults(batch, responses);
        if (batchResults.length === 0) {
          setError('AI screening returned no valid decisions. Check your providers and retry.');
          return;
        }
        allResults.push(...batchResults);
      }
      setResults(allResults);
    } catch {
      setError('AI screening failed. Check your providers and retry.');
    } finally {
      setProcessing(false);
    }
  };

  const buildPrompt = (batch: ScreeningItem[], pico: any, inclusion: string, exclusion: string) => {
    return `You are screening records for a systematic review.

PICO:
- Population: ${pico.population}
- Intervention: ${pico.intervention}
- Comparator: ${pico.comparator}
- Outcomes: ${pico.outcomes}

Inclusion Criteria: ${inclusion}
Exclusion Criteria: ${exclusion}

Screen these ${batch.length} records. For each, return JSON:
[{"id": "...", "decision": "include|exclude|unsure", "reason": "brief reason", "confidence": 0.0-1.0}]

Records:
${batch.map((r, i) => `${i + 1}. ID: ${r.id}\n   Title: ${r.title}\n   Abstract: ${r.abstract}`).join('\n')}

Return ONLY a JSON array. No markdown.`;
  };

  const applyDecisions = () => {
    const decisions = results
      .filter(r => r.avgConfidence >= settings.ai.autoAcceptThreshold && r.agreement >= settings.ai.minConfidence)
      .map(r => ({ id: r.id, decision: r.consensus, confidence: r.avgConfidence }));
    onDecisions(decisions);
  };

  const consensusColor = (consensus: string) => {
    if (consensus === 'include') return 'text-[var(--color-include)]';
    if (consensus === 'exclude') return 'text-[var(--color-exclude)]';
    return 'text-[var(--color-unsure)]';
  };

  const agreementColor = (agreement: number) => {
    if (agreement >= 0.7) return 'bg-[var(--color-include)]';
    if (agreement >= 0.5) return 'bg-[var(--color-unsure)]';
    return 'bg-[var(--color-exclude)]';
  };

  return (
    <Card
      title="AI Screening Assistant"
      right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{activeProviders.length} providers</Pill>
          <Button
            variant="default"
            size="sm"
            disabled={processing || activeProviders.length === 0 || items.length === 0}
            onClick={runScreening}
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {processing ? 'Screening...' : 'Run AI Screening'}
          </Button>
        </div>
      }
    >
      {activeProviders.length === 0 && (
        <div className="rounded-[3px] border border-[var(--color-unsure)]/30 bg-[var(--color-unsure)]/10 p-3 text-[12px] text-[var(--color-unsure)]">
          No AI providers configured. Go to Settings → AI Providers to set up.
        </div>
      )}

      {error && <p role="alert" className="mb-3 text-[var(--color-exclude)]">{error}</p>}

      {processing && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span>Processing records...</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--color-text-muted)]">
              {results.length} records screened
            </span>
            <Button variant="outline" size="sm" onClick={applyDecisions}>
              Apply High-Confidence Decisions
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-1">
            {results.map(result => {
              const item = items.find(i => i.id === result.id);
              return (
                <div key={result.id} className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <div
                    className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
                    onClick={() => setExpandedRecord(expandedRecord === result.id ? null : result.id)}
                  >
                    <span className={`text-[12px] font-medium ${consensusColor(result.consensus)}`}>
                      {result.consensus.toUpperCase()}
                    </span>
                    <span className="flex-1 truncate text-[12px] text-[var(--color-text)]">
                      {item?.title}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-12 rounded-full bg-[var(--color-border)]">
                        <div
                          className={`h-full rounded-full ${agreementColor(result.agreement)}`}
                          style={{ width: `${result.agreement * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {(result.agreement * 100).toFixed(0)}%
                      </span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform ${expandedRecord === result.id ? 'rotate-180' : ''}`} />
                  </div>

                  <AnimatePresence>
                    {expandedRecord === result.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-[var(--color-border)]"
                      >
                        <div className="space-y-1 p-2">
                          {result.decisions.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <span className="w-20 truncate text-[var(--color-text-muted)]">{d.provider}</span>
                              <span className={`font-medium ${consensusColor(d.decision)}`}>{d.decision}</span>
                              <span className="flex-1 truncate text-[var(--color-text-muted)]">{d.reason}</span>
                              <span className="text-[var(--color-text-muted)]">{(d.confidence * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
