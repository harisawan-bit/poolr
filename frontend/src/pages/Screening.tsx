import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, ScreeningItem, ScreenDecision } from "../lib/project";
import { CITATION_ACCEPT, importCitationText, mergeScreeningItems, dedupeRecords } from "../lib/project";
import { readTextFiles } from "../lib/api";
import { Card, Pill, Input, Textarea, EmptyState } from "../components/ui";
import FunnelChart from "../components/charts/FunnelChart";
import TeamSelector, { REVIEWER_MEMBERS } from "../components/kokonut/TeamSelector";

const DECISIONS: ScreenDecision[] = ["include", "exclude", "unsure"];
const DEC_LABEL: Record<ScreenDecision, string> = { include: "Include", exclude: "Exclude", unsure: "Unsure", unset: "Unset" };
const DEC_TONE: Record<ScreenDecision, "include" | "exclude" | "unsure" | "neutral"> = {
  include: "include", exclude: "exclude", unsure: "unsure", unset: "neutral",
};
// v0.5.1 — structured PICO-failure exclusion reasons (PRISMA-reportable)
const EXCLUSION_REASONS = [
  "Population not relevant",
  "Intervention not relevant",
  "Comparator not relevant",
  "Outcome not reported",
  "Study design not eligible",
  "Review / meta-analysis (not primary)",
  "Case report / series",
  "Insufficient data for extraction",
  "Wrong language",
  "Duplicate publication",
] as const;

// Lightweight windowing virtualization (no external dep) — only renders visible rows.
const ROW_H = 64;
const OVERSCAN = 6;

function StageTabs({ stage, setStage }: { stage: "title_abstract" | "full_text"; setStage: (s: "title_abstract" | "full_text") => void }) {
  return (
    <div className="flex items-center gap-1">
      {(["title_abstract", "full_text"] as const).map((s) => (
        <button key={s} className={`btn-ghost ${stage === s ? "!text-[var(--color-text)] !border-[var(--color-border-strong)]" : ""}`}
          onClick={() => setStage(s)}>{s === "title_abstract" ? "Title / Abstract" : "Full text"}</button>
      ))}
    </div>
  );
}

export default function Screening({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [stage, setStage] = useState<"title_abstract" | "full_text">("title_abstract");
  const [filter, setFilter] = useState<"all" | ScreenDecision>("all");
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  // Selection is tracked by record id, not by position: a filter change, an
  // import, a decision update or a delete all reshuffle the visible list, and an
  // index would silently point at a different record (editing the wrong one).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // v0.5.3 — number of independent reviewers screening (dual screening support).
  const [reviewers, setReviewers] = useState(2);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);

  const items = project.screening?.[stage] ?? [];

  useEffect(() => () => { if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current); }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  };

  const visible = useMemo(() => {
    let list = items;
    if (filter !== "all") list = list.filter((i) => i.decision === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(q) || i.abstract.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, include: 0, exclude: 0, unsure: 0, unset: 0 };
    for (const it of items) c[it.decision]++;
    return c;
  }, [items]);

  const setDecision = (id: string, decision: ScreenDecision) => {
    const next = items.map((it) => (it.id === id ? { ...it, decision } : it));
    onChange({ ...project, screening: { ...project.screening, [stage]: next } });
  };

  const setNote = (id: string, note: string) => {
    const next = items.map((it) => (it.id === id ? { ...it, note } : it));
    onChange({ ...project, screening: { ...project.screening, [stage]: next } });
  };

  const addSample = () => {
    const n = items.length + 1;
    const next: ScreeningItem = {
      id: `s${Date.now()}_${n}`,
      title: `Screening record #${n} — ${stage === "title_abstract" ? "title/abstract" : "full-text"} candidate`,
      abstract: "Paste or import the citation abstract here. Decision persists in the project and is auto-saved.",
      decision: "unset",
      stage,
    };
    onChange({ ...project, screening: { ...project.screening, [stage]: [...items, next] } });
  };

  // ── Citation import: MEDLINE .txt, CSV, RIS/.nbib, EndNote .txt ──
  const onImportFiles = async (fileList: FileList | null) => {
    const files = await readTextFiles(fileList);
    if (files.length === 0) return;

    let next = project;
    let imported = 0;
    let dupes = 0;
    const formats = new Set<string>();
    for (const f of files) {
      const stageItems = next.screening[stage] ?? [];
      const res = importCitationText(f.text, f.name, stage, stageItems.length + 1);
      if (res.items.length > 0) {
        // v0.5.1 — de-duplicate against what is already in the stage before merging
        const { kept, duplicatesRemoved } = dedupeRecords(res.items, stageItems);
        if (kept.length > 0) next = mergeScreeningItems(next, stage, kept);
        imported += kept.length;
        dupes += duplicatesRemoved;
        formats.add(res.format);
      }
    }

    if (imported > 0) onChange(next);
    const fmt = formats.size > 0 ? ` (${Array.from(formats).join(", ")})` : "";
    const dupeNote = dupes > 0 ? ` — ${dupes} duplicate${dupes === 1 ? "" : "s"} removed automatically` : "";
    flash(imported > 0 ? `Imported ${imported} records${fmt}${dupeNote}` : "Imported 0 records — no citations recognised");
  };

  // Resolve the selected record id to its position in the current visible list.
  // Tracked by id (not index) so filter/import/decision changes can't silently
  // repoint selection at the wrong record.
  const selIndex = selectedId != null ? visible.findIndex((it) => it.id === selectedId) : -1;

  const total = visible.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + 520) / ROW_H) + OVERSCAN);
  const slice = visible.slice(start, end);
  const sel = selIndex >= 0 ? selIndex : null;

  const funnelData = [
    { label: "Identified", value: Math.max(items.length, counts.all) || 0 },
    { label: "Screened", value: counts.all },
    { label: "Included", value: counts.include },
    { label: "Excluded", value: counts.exclude },
  ];

  return (
    <div className="space-y-3">
      {/* v0.5.3 — screening funnel + reviewer team, kokonutui-style */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card title="Screening funnel" className="lg:col-span-2">
          <FunnelChart
            color="var(--chart-1)"
            data={funnelData}
            layers={3}
          />
        </Card>
        <Card title="Reviewers">
          <TeamSelector defaultValue={reviewers} members={REVIEWER_MEMBERS} onChange={setReviewers} />
          <p className="mt-2 text-center text-[11px] text-[var(--color-text-muted)]">
            {reviewers > 1 ? "Dual screening — records should be agreed by both reviewers." : "Single reviewer screening."}
          </p>
        </Card>
      </div>
      <Card title="Screening" right={
        <div className="flex items-center gap-2">
          <StageTabs stage={stage} setStage={(s) => { setStage(s); setSelectedId(null); }} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Import</button>
          <button className="btn-primary" onClick={addSample}>+ Add</button>
        </div>
      }>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={CITATION_ACCEPT}
          multiple
          onChange={(e) => {
            const fl = e.target.files;
            void onImportFiles(fl);
            e.target.value = "";
          }}
        />
        {notice && (
          <div className="mb-2 rounded-[3px] border border-[var(--color-border)] bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] text-[var(--color-text)]">
            {notice}
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {(["all", "include", "exclude", "unsure", "unset"] as const).map((f) => (
            <button key={f} className={`btn-ghost ${filter === f ? "!text-[var(--color-text)] !border-[var(--color-border-strong)]" : ""}`}
              onClick={() => setFilter(f)}>
              {f === "all" ? `All ${counts.all}` : `${DEC_LABEL[f]} ${counts[f]}`}
            </button>
          ))}
          <Input className="ml-auto w-44" placeholder="Filter titles…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {total === 0 ? (
          <EmptyState>
            No records at this stage. Use <span className="text-[var(--color-text)]">+ Add</span> to create screening items, or{" "}
            <span className="text-[var(--color-text)]">Import</span> a PubMed MEDLINE / RIS / .nbib / CSV / EndNote export.
          </EmptyState>
        ) : (
          <div className="flex gap-3" style={{ height: 520 }}>
            {/* Virtualized list */}
            <div ref={viewportRef}
              onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
              className="w-[56%] overflow-y-auto rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)]">
              <div style={{ height: total * ROW_H, position: "relative" }}>
                <div style={{ transform: `translateY(${start * ROW_H}px)` }}>
                  {slice.map((it) => {
                    const idx = visible.indexOf(it);
                    return (
                      <div key={it.id}
                        onClick={() => setSelectedId(it.id)}
                        className={`flex cursor-pointer items-start gap-2 border-b border-[var(--color-border)] px-3 py-2 transition-colors ${sel === idx ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                        style={{ height: ROW_H }}>
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(it.decision)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] text-[var(--color-text)]">{it.title}</div>
                          <div className="truncate text-[11px] text-[var(--color-text-muted)]">{it.abstract}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detail + decisions */}
            <div className="flex w-[44%] flex-col rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] p-3">
              {sel == null ? (
                <EmptyState>Select a record to screen.</EmptyState>
              ) : (
                (() => {
                  const it = visible[sel];
                  return (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <Pill tone={DEC_TONE[it.decision]}>{DEC_LABEL[it.decision]}</Pill>
                        <span className="text-[10.5px] text-[var(--color-text-muted)]">{sel + 1} / {total}</span>
                      </div>
                      <div className="text-[13px] font-semibold text-[var(--color-text)]">{it.title}</div>
                      <Textarea className="mt-2 flex-1" rows={8} value={it.abstract} onChange={(e) => {
                        const next = items.map((x) => (x.id === it.id ? { ...x, abstract: e.target.value } : x));
                        onChange({ ...project, screening: { ...project.screening, [stage]: next } });
                      }} />
                      <Input className="mt-2" placeholder="Note (optional)" value={it.note ?? ""} onChange={(e) => setNote(it.id, e.target.value)} />
                      {it.decision === "exclude" && (
                        <select
                          className="mt-2 w-full rounded-[3px] border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1.5 text-[12px] text-[var(--color-text)]"
                          value={(it as ScreeningItem).exclusion_reason ?? ""}
                          onChange={(e) => {
                            const next = items.map((x) => (x.id === it.id ? { ...x, exclusion_reason: e.target.value } : x));
                            onChange({ ...project, screening: { ...project.screening, [stage]: next } });
                          }}>
                          <option value="">Exclusion reason…</option>
                          {EXCLUSION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                      {(it as ScreeningItem).exclusion_reason && (
                        <div className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">Reason: {(it as ScreeningItem).exclusion_reason}</div>
                      )}
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        {DECISIONS.map((d) => (
                          <button key={d} className={`btn-ghost ${it.decision === d ? "!border-[var(--color-border-strong)]" : ""}`}
                            style={it.decision === d ? { color: decisionColor(d) } : undefined}
                            onClick={() => setDecision(it.id, d)}>{DEC_LABEL[d]}</button>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <button className="btn-ghost" disabled={sel <= 0} onClick={() => setSelectedId(visible[sel - 1].id)}>↑ Prev</button>
                        <button className="btn-ghost" disabled={sel >= total - 1} onClick={() => setSelectedId(visible[sel + 1].id)}>Next ↓</button>
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function dotClass(d: ScreenDecision) {
  return d === "include" ? "bg-[var(--color-include)]" : d === "exclude" ? "bg-[var(--color-exclude)]" : d === "unsure" ? "bg-[var(--color-unsure)]" : "bg-[#5a5c63]";
}
function decisionColor(d: ScreenDecision) {
  return d === "include" ? "var(--color-include)" : d === "exclude" ? "var(--color-exclude)" : d === "unsure" ? "var(--color-unsure)" : "#e6e7ea";
}
