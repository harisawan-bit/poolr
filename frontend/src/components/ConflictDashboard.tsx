import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Users,
  Bot,
  ArrowRightLeft,
  CheckCheck,
  FileDown,
  ChevronDown,
  Loader2,
  Sparkles,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { Card, Pill, Button, EmptyState } from "./ui";
import { getActiveProviders, callAIMultiProvider } from "../lib/ai";
import { downloadText, toCsv } from "../lib/project";
import type { Project, ScreeningItem, ScreenDecision } from "../lib/project";

/* ── types ── */

interface Props {
  project: Project;
  onChange: (p: Project) => void;
  stage: "title_abstract" | "full_text";
  reviewers: number;
}

interface ConflictRecord {
  item: ScreeningItem;
  decisions: { reviewerId: string; reviewerName: string; decision: ScreenDecision; note?: string; exclusion_reason?: string; timestamp: string }[];
  hasConflict: boolean;
  aiSuggestion?: { decision: ScreenDecision; reason: string; confidence: number } | null;
}

type BulkAction = "accept_a" | "accept_b" | "discuss" | "ai_adjudicate";

const DECISION_LABEL: Record<ScreenDecision, string> = {
  include: "Include",
  exclude: "Exclude",
  unsure: "Unsure",
  unset: "Unset",
};

const DECISION_ICON: Record<ScreenDecision, typeof CheckCircle2> = {
  include: CheckCircle2,
  exclude: XCircle,
  unsure: HelpCircle,
  unset: HelpCircle,
};

const DECISION_COLOR: Record<ScreenDecision, string> = {
  include: "var(--color-include)",
  exclude: "var(--color-exclude)",
  unsure: "var(--color-unsure)",
  unset: "#5a5c63",
};

/* ── helpers ── */

function hasConflict(decs: { decision: ScreenDecision }[]): boolean {
  const settled = decs.filter((d) => d.decision !== "unset");
  if (settled.length < 2) return false;
  const first = settled[0].decision;
  return settled.some((d) => d.decision !== first);
}

function detectConflicts(items: ScreeningItem[]): ConflictRecord[] {
  return items
    .filter((it) => it.reviewerDecisions && it.reviewerDecisions.length >= 2)
    .map((it) => {
      const decs = it.reviewerDecisions!;
      const conflict = hasConflict(decs);
      return {
        item: it,
        decisions: decs,
        hasConflict: conflict,
        aiSuggestion: it.aiDecision
          ? { decision: it.aiDecision.decision, reason: it.aiDecision.reason, confidence: it.aiDecision.confidence }
          : null,
      };
    });
}

/* ── component ── */

export default function ConflictDashboard({ project, onChange, stage, reviewers }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<"all" | "pending" | "resolved" | "ai_adjudicated" | "discuss">("all");

  const items = project.screening?.[stage] ?? [];
  const conflictRecords = useMemo(() => detectConflicts(items), [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return conflictRecords;
    return conflictRecords.filter((r) => r.item.conflictStatus === filter);
  }, [conflictRecords, filter]);

  const stats = useMemo(() => {
    const total = conflictRecords.length;
    const pending = conflictRecords.filter((r) => r.item.conflictStatus === "pending" || !r.item.conflictStatus).length;
    const resolved = conflictRecords.filter((r) => r.item.conflictStatus === "resolved").length;
    const aiAdj = conflictRecords.filter((r) => r.item.conflictStatus === "ai_adjudicated").length;
    const discuss = conflictRecords.filter((r) => r.item.conflictStatus === "discuss").length;
    const actualConflicts = conflictRecords.filter((r) => r.hasConflict).length;
    return { total, pending, resolved, aiAdj, discuss, actualConflicts };
  }, [conflictRecords]);

  const updateItem = useCallback(
      (id: string, patch: Partial<ScreeningItem>) => {
        const next = items.map((it) => (it.id === id ? { ...it, ...patch } : it));
        const newScreening = { ...project.screening };
        newScreening[stage] = next;
        onChange({ ...project, screening: newScreening });
      },
      [items, onChange, project, stage]
    );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.item.id)));
    }
  };

  /* ── Adjudication ── */

  const adjudicate = (record: ConflictRecord, decision: ScreenDecision, source: "manual" | "ai") => {
    updateItem(record.item.id, {
      finalDecision: decision,
      conflictStatus: source === "ai" ? "ai_adjudicated" : "resolved",
      decision: decision,
    });
  };

  const markDiscuss = (id: string) => {
    updateItem(id, { conflictStatus: "discuss" });
  };

  /* ── AI Tie-breaker ── */

  const runAIBreaker = async (records: ConflictRecord[]) => {
    const providers = getActiveProviders();
    if (providers.length === 0) return;

    setProcessing(true);
    setProgress({ current: 0, total: records.length });

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      setProgress({ current: i + 1, total: records.length });

      const prompt = `You are a systematic review adjudicator. Two reviewers DISAGREED on this record. Act as the third reviewer to break the tie.

Record: ${rec.item.title}
Abstract: ${rec.item.abstract}

Reviewer 1 (${rec.decisions[0]?.reviewerName}): ${rec.decisions[0]?.decision}${rec.decisions[0]?.note ? ` — "${rec.decisions[0].note}"` : ""}
Reviewer 2 (${rec.decisions[1]?.reviewerName}): ${rec.decisions[1]?.decision}${rec.decisions[1]?.note ? ` — "${rec.decisions[1].note}"` : ""}

Pick a final decision. Respond with ONLY JSON: {"decision": "include|exclude|unsure", "reason": "brief", "confidence": 0.0-1.0}`;

      try {
        const responses = await callAIMultiProvider(providers, [
          { role: "system", content: "You are a systematic review tie-breaker. Respond with ONLY JSON." },
          { role: "user", content: prompt },
        ]);

        if (responses.length > 0) {
          const parsed = JSON.parse(responses[0].content.match(/\{[\s\S]*\}/)?.[0] || "{}");
          const decision = ["include", "exclude", "unsure"].includes(parsed.decision)
            ? parsed.decision
            : "unsure";
          const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;

          updateItem(rec.item.id, {
            aiDecision: { decision, reason: parsed.reason || "AI adjudication", confidence, timestamp: new Date().toISOString() },
            finalDecision: decision,
            conflictStatus: "ai_adjudicated",
            decision,
          });
        }
      } catch {
        // skip on failure — non-fatal
      }
    }

    setProcessing(false);
  };

  /* ── Bulk actions ── */

  const applyBulk = (action: BulkAction) => {
    const targets = filtered.filter((r) => selectedIds.has(r.item.id));

    if (action === "ai_adjudicate") {
      void runAIBreaker(targets);
      return;
    }

    for (const rec of targets) {
      if (action === "accept_a") {
        adjudicate(rec, rec.decisions[0]?.decision ?? "unsure", "manual");
      } else if (action === "accept_b") {
        adjudicate(rec, rec.decisions[1]?.decision ?? "unsure", "manual");
      } else if (action === "discuss") {
        markDiscuss(rec.item.id);
      }
    }
    setSelectedIds(new Set());
  };

  /* ── Export ── */

  const exportReport = () => {
    const rows = conflictRecords.map((r) => ({
      title: r.item.title,
      reviewer_1: r.decisions[0]?.reviewerName ?? "",
      decision_1: r.decisions[0]?.decision ?? "",
      note_1: r.decisions[0]?.note ?? "",
      reviewer_2: r.decisions[1]?.reviewerName ?? "",
      decision_2: r.decisions[1]?.decision ?? "",
      note_2: r.decisions[1]?.note ?? "",
      conflict: r.hasConflict ? "yes" : "no",
      status: r.item.conflictStatus ?? "pending",
      ai_decision: r.item.aiDecision?.decision ?? "",
      ai_reason: r.item.aiDecision?.reason ?? "",
      ai_confidence: r.item.aiDecision?.confidence ?? "",
      final_decision: r.item.finalDecision ?? "",
    }));

    const csv = toCsv(rows);
    downloadText(`conflict-report-${stage}-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  };

  /* ── render ── */

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-3 text-center">
          <div className="text-lg font-semibold text-[var(--color-text)]">{stats.total}</div>
          <div className="text-[10.5px] text-[var(--color-text-muted)]">Total Dual</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-3 text-center">
          <div className="text-lg font-semibold text-[var(--color-unsure)]">{stats.actualConflicts}</div>
          <div className="text-[10.5px] text-[var(--color-text-muted)]">Conflicts</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-3 text-center">
          <div className="text-lg font-semibold text-[var(--color-include)]">{stats.resolved}</div>
          <div className="text-[10.5px] text-[var(--color-text-muted)]">Resolved</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-3 text-center">
          <div className="text-lg font-semibold text-[var(--color-accent)]">{stats.aiAdj}</div>
          <div className="text-[10.5px] text-[var(--color-text-muted)]">AI Adj.</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-3 text-center">
          <div className="text-lg font-semibold text-[var(--color-exclude)]">{stats.discuss}</div>
          <div className="text-[10.5px] text-[var(--color-text-muted)]">Discuss</div>
        </div>
      </div>

      {/* Controls */}
      <Card
        title="Conflict Resolution"
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportReport} disabled={conflictRecords.length === 0}>
              <FileDown className="h-3.5 w-3.5" /> Export
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={selectedIds.size === 0 || processing}
              onClick={() => applyBulk("ai_adjudicate")}
            >
              {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI Break Ties ({selectedIds.size})
            </Button>
          </div>
        }
      >
        {/* Filter tabs */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {(["all", "pending", "resolved", "ai_adjudicated", "discuss"] as const).map((f) => (
            <button
              key={f}
              className={`btn-ghost ${filter === f ? "!text-[var(--color-text)] !border-[var(--color-border-strong)]" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "All"
                : f === "ai_adjudicated"
                ? "AI Adj."
                : f.charAt(0).toUpperCase() + f.slice(1)}{" "}
              {f === "all"
                ? stats.total
                : f === "pending"
                ? stats.pending
                : f === "resolved"
                ? stats.resolved
                : f === "ai_adjudicated"
                ? stats.aiAdj
                : stats.discuss}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={selectAll} />
              Select all
            </label>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
            <span className="text-[12px] text-[var(--color-text)]">{selectedIds.size} selected</span>
            <div className="ml-auto flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => applyBulk("accept_a")}>
                Accept Reviewer 1
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyBulk("accept_b")}>
                Accept Reviewer 2
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyBulk("discuss")}>
                <MessageSquare className="h-3 w-3" /> Mark Discuss
              </Button>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {processing && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span>AI adjudicating ties...</span>
              <span>
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Conflict list */}
        {filtered.length === 0 ? (
          <EmptyState>
            {conflictRecords.length === 0
              ? "No dual-screening records yet. Assign at least 2 reviewers and record decisions for the same records."
              : "No conflicts in this filter."}
          </EmptyState>
        ) : (
          <div className="max-h-[480px] space-y-2 overflow-y-auto">
            {filtered.map((record) => (
              <ConflictCard
                key={record.item.id}
                record={record}
                expanded={expandedId === record.item.id}
                selected={selectedIds.has(record.item.id)}
                onToggleExpand={() => setExpandedId(expandedId === record.item.id ? null : record.item.id)}
                onToggleSelect={() => toggleSelect(record.item.id)}
                onAdjudicate={(d) => adjudicate(record, d, "manual")}
                onDiscuss={() => markDiscuss(record.item.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Conflict Card ── */

interface CardProps {
  record: ConflictRecord;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onAdjudicate: (d: ScreenDecision) => void;
  onDiscuss: () => void;
}

function ConflictCard({ record, expanded, selected, onToggleExpand, onToggleSelect, onAdjudicate, onDiscuss }: CardProps) {
  const { item, decisions, hasConflict, aiSuggestion } = record;
  const status = item.conflictStatus ?? "pending";

  const statusTone = status === "resolved" ? "include" : status === "ai_adjudicated" ? "accent" : status === "discuss" ? "exclude" : "unsure";

  const cardCls = selected
    ? "rounded-lg border border-[var(--color-accent)] bg-[var(--color-surface-2)]"
    : "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]";

  return (
    <div className={cardCls}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} />

        {hasConflict ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--color-unsure)]" />
        ) : (
          <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[var(--color-include)]" />
        )}

        <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="truncate text-[12px] font-medium text-[var(--color-text)]">{item.title}</div>
        </div>

        <Pill tone={statusTone}>{status === "ai_adjudicated" ? "AI Adj." : status}</Pill>

        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--color-border)]"
          >
            <div className="space-y-3 p-3">
              {/* Side-by-side reviewer decisions */}
              <div className="grid grid-cols-2 gap-3">
                {decisions.slice(0, 2).map((d, idx) => {
                  const Icon = DECISION_ICON[d.decision];
                  return (
                    <div key={idx} className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-[var(--color-text-muted)]" />
                        <span className="text-[11px] font-medium text-[var(--color-text)]">{d.reviewerName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-4 w-4" style={{ color: DECISION_COLOR[d.decision] }} />
                        <span className="text-[12px] font-semibold" style={{ color: DECISION_COLOR[d.decision] }}>
                          {DECISION_LABEL[d.decision]}
                        </span>
                      </div>
                      {d.note && <div className="mt-1.5 text-[10.5px] text-[var(--color-text-muted)]">{d.note}</div>}
                      {d.exclusion_reason && (
                        <div className="mt-1 text-[10.5px] text-[var(--color-exclude)]">Reason: {d.exclusion_reason}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* AI suggestion */}
              {aiSuggestion && (
                <div className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-2.5">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Bot className="h-3 w-3 text-[var(--color-accent)]" />
                    <span className="text-[11px] font-medium text-[var(--color-accent)]">AI Adjudication</span>
                    <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                      {(aiSuggestion.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-semibold" style={{ color: DECISION_COLOR[aiSuggestion.decision] }}>
                      {DECISION_LABEL[aiSuggestion.decision]}
                    </span>
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">— {aiSuggestion.reason}</span>
                  </div>
                </div>
              )}

              {/* Abstract preview */}
              <div className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] p-2">
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Abstract</div>
                <div className="mt-1 line-clamp-3 text-[11px] text-[var(--color-text)]">{item.abstract || "—"}</div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] text-[var(--color-text-muted)]">Adjudicate:</span>
                <Button variant="outline" size="sm" onClick={() => onAdjudicate(decisions[0]?.decision ?? "unsure")}>
                  <ArrowRightLeft className="h-3 w-3" /> Accept {decisions[0]?.reviewerName ?? "R1"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onAdjudicate(decisions[1]?.decision ?? "unsure")}>
                  <ArrowRightLeft className="h-3 w-3" /> Accept {decisions[1]?.reviewerName ?? "R2"}
                </Button>
                <Button variant="ghost" size="sm" onClick={onDiscuss}>
                  <MessageSquare className="h-3 w-3" /> Discuss
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}