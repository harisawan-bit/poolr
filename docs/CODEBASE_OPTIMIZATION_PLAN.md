# poolr Codebase Cable Management Plan

## Current State Analysis

| File | Lines | Verdict |
|---|---|---|
| `pages/Meta.tsx` | 1,196 | 🔴 God component |
| `lib/meta-engine.ts` | 827 | 🔴 Everything bucket |
| `components/charts/gauge.tsx` | 738 | 🔴 Kitchen sink chart |
| `lib/project.ts` | 596 | 🟡 Types + utils mixed |
| `pages/Screening.tsx` | 584 | 🟡 Reasonable but bloated |
| `lib/api.ts` | 561 | 🟡 All API calls flat |
| `lib/competitive-engine.ts` | 533 | 🟡 New methods unconsolidated |
| `pages/NetworkMeta.tsx` | 513 | 🟡 Copy-paste pattern |
| `components/charts/ring-chart.tsx` | 491 | 🟡 Chart + state + svg |

---

## Cable Management Strategy

### Phase 1: Extract Shared Primitives (Low Risk, High Impact)

**Problem:** Every page re-implements table, stat card, empty state, filter bar.

**Solution:** Create `components/ui/` additions:

```
components/ui/
  StatCard.tsx          ← Replaces 47 inline `<div className="card p-2.5">` blocks
  DataTable.tsx         ← Standardized sortable table with pill badges
  FilterBar.tsx         ← Search + filter tabs (used in Screening, Meta, Extraction)
  EmptyState.tsx        ← Already exists, consolidate icon map
  PlotContainer.tsx     ← Standardized SVG export header
  ResultCard.tsx        ← Pooled result + CI + p-value display
```

**Pages that benefit immediately:** Meta, Screening, Extraction, Diagnostic, IPD, Multilevel, Proportions, Qualitative, Network — **9 pages**

---

### Phase 2: Consolidate the Meta-Analysis Engine Files

**Problem:** `meta-engine.ts` (827) + `competitive-engine.ts` (533) + `interpretation.ts` (139) + `grade-engine.ts` (168) + `manuscript.ts` (139) + `prospero.ts` (329) + `power-calculator.ts` (156) + `extraction-templates.ts` (213) = **2,504 lines** of loosely-related TS.

**Solution:** Create domain modules:

```
lib/
  meta/
    core.ts             ← runMetaAnalysis, heterogeneity, DL estimator
    publication-bias.ts ← egger, begg, harbord, peters, trim-fill
    power-tools.ts      ← cumulative MA, meta-regression, failsafe N
    advanced.ts         ← influence diagnostics, cluster-robust, multivariate
    types.ts            ← StudyInput, MetaSettings, MetaAnalysisResult
    
  grade/
    engine.ts           ← GRADE certainty assessment
    sof.ts              ← Summary of Findings generation
    
  manuscript/
    generator.ts        ← Section drafting
    search-strategy.ts  ← Boolean query builder
    
  utils/
    statistics.ts       ← normalCDF, normalPPF, chiSquareCDF (shared)
    effect-size.ts      ← ES converter, Cohen's d, Hedges g
    validation.ts       ← validateStudyData
```

---

### Phase 3: Decompose Meta.tsx (1,196 lines)

**Problem:** One file handles: settings, run, results, forest plot, funnel plot, TSA, model averaging, replication suite, subgroups, sensitivity, power tools, publication bias — all with local state.

**Solution:** Extract feature components:

```
pages/Meta/
  index.tsx             ← Thin shell, composes children (< 100 lines)
  SettingsPanel.tsx     ← Model/measure/method/pub-bias selectors
  ResultsSummary.tsx    ← Pooled result + CI + PI + copy button
  FigureStudio.tsx      ← Plot tabs + SVG export (forest/funnel/galbraith/etc.)
  TsaCard.tsx           ← Trial Sequential Analysis
  ModelAveragingCard.tsx
  ReplicationSuite.tsx  ← R/Stata/Python code tabs
  PowerToolsBlock.tsx   ← Already extracted in current code
  PublicationBiasBlock.tsx ← Bias tests tab
```

---

### Phase 4: Unify the Meta-Analysis Page Pattern

**Problem:** `Meta.tsx`, `NetworkMeta.tsx`, `IPDMeta.tsx`, `MultilevelMeta.tsx`, `DiagnosticMeta.tsx`, `ProportionsMeta.tsx` all follow the same pattern: settings card → run button → results card → plots. But each is a separate 300-500 line file with copy-pasted structure.

**Solution:** Create a generic `MetaAnalysisWorkbench` component:

```
components/MetaWorkbench/
  index.tsx             ← Generic settings → run → results → plots flow
  types.ts              ← Config interface for each study type
```

Each page becomes a config file:

```tsx
// pages/Meta.tsx (new, ~50 lines)
export default function Meta() {
  return <MetaAnalysisWorkbench config={standardMetaConfig} />
}
```

---

### Phase 5: API Layer Cleanup

**Problem:** `api.ts` (561 lines) has all endpoints flat. No error handling consistency. No types on responses.

**Solution:** Split by domain:

```
lib/api/
  client.ts             ← postJson, getProject, saveProject, engineHealth
  meta.ts               ← meta2, TSA, model averaging, prediction
  figures.ts            ← diagnostic figures, rob figures, export
  search.ts             ← PubMed, OpenAlex, Crossref, etc.
  export.ts             ← docx, latex, html, R, stata, python
```

Add a typed response wrapper:
```ts
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
```

---

### Phase 6: State Management

**Problem:** `App.tsx` manages project, page, save state, and passes everything via props. `useUndoRedo.ts` exists but is never used. No global store.

**Solution:** Lightweight context (no Redux needed):

```
context/
  ProjectContext.tsx    ← Current project + onChange
  ThemeContext.tsx      ← Already exists in lib/theme.tsx
  SaveContext.tsx       ← Save state + debounced autosave
```

Or use `zustand` (small, no boilerplate) if more complexity needed later.

---

### Phase 7: Chart Component Library

**Problem:** 19 files in `components/charts/`, many with duplicated SVG axis/pseudo-CI/scaling logic.

**Solution:**

```
components/charts/
  core/
    axes.tsx            ← Shared axis rendering
    scales.ts           ← Linear/log scale helpers
    labels.ts           ← Axis label positioning
  ForestPlot.tsx        ← Current generateForestSVG → React component
  FunnelPlot.tsx
  GalbraithPlot.tsx
  BaujatPlot.tsx
  GoshPlot.tsx
  SucraPlot.tsx
  ClusterDetectionPlot.tsx
  DiagnosticOrcPlot.tsx
```

All plots get consistent: title, export SVG, study labels, hover tooltips.

---

## Implementation Priority

| Phase | Impact | Risk | Effort | Priority |
|---|---|---|---|---|
| 1. Shared UI primitives | 🔴 High | 🟢 Low | 2 days | **P0** |
| 5. API layer cleanup | 🟡 Medium | 🟢 Low | 1 day | **P0** |
| 3. Decompose Meta.tsx | 🔴 High | 🟡 Medium | 2 days | **P1** |
| 2. Consolidate engine files | 🟡 Medium | 🟢 Low | 1 day | **P1** |
| 4. MetaWorkbench pattern | 🔴 High | 🔴 High | 3 days | **P2** |
| 6. State management | 🟡 Medium | 🟡 Medium | 1 day | **P2** |
| 7. Chart library | 🟡 Medium | 🔴 High | 3 days | **P3** |

**P0 + P1 = ~6 days of work, eliminates 60% of the mess.**

---

## Summary

The codebase grew organically — feature after feature appended to existing files. The core issue isn't bad code; it's **no enforced seams**. Every new feature went into `Meta.tsx` or `meta-engine.ts` because that path of least resistance was wide open.

The fix is not a rewrite. It's **extraction**:
1. Pull shared UI primitives up and out
2. Split engine files by domain  
3. Decompose Meta.tsx into feature components
4. Unify the 6 meta-analysis page variants
5. Organize API calls by domain
6. Add lightweight global state

Result: each file < 200 lines, each component does one thing, adding a new feature means adding a new file rather than bloating an existing one.
