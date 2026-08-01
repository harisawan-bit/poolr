# poolr Overhaul — Tauri + React + Rust + C# Engine (Native, All-OS) — v2 Plan

> **For Hermes:** Implement task-by-task (subagent-driven-development or direct). 
> **Status: EXECUTING.** Branch `feat/web-overhaul` off `develop`. Never merge to `main` first.

**Goal:** Replace the broken CustomTkinter UI + Python engine with a premium, fast, margin-correct **React** frontend inside a **Tauri (Rust)** native window, a **C# 12 / .NET 8** statistical engine (no Python), and ship **native installers** (MSI/NSIS for Windows, DMG for macOS, deb/AppImage for Linux) that run on any machine with no prerequisites. Project data auto-saves to the user's machine so multi-day MAs survive restarts.

**Architecture:**
- **Tauri 2 (Rust)** = native window shell. Spawns a bundled **C# AOT engine** sidecar (localhost HTTP API) and bridges it to the webview.
- **React 18 + TypeScript + Vite** = the UI (webview). Real CSS layout → margins/overlap/speed fixed by construction.
- **C# 12 / .NET 8 AOT** = engine: reimplements the stats (OR/RR/RD/MD/SMD/HR, fixed/random-effects, REML, Egger/Begg, I²/τ², GRADE) + figures (SkiaSharp) + export (Word/LaTeX). **Validated against the pinned Python test numbers before any UI ships.**
- **No Python anywhere.** No webview dependency on the user (WebView2 fixed runtime embedded on Windows).

**Tech Stack:** Rust + Tauri 2, React + TS + Vite, Tailwind + shadcn/ui, C# 12 / .NET 8 (AOT sidecar), Math.NET Numerics, SkiaSharp, System.Text.Json, GitHub Actions (6-OS matrix).

---

## 0. Locked Decisions (from user)
- **Stack:** Tauri + React + Rust + **C# backend** (no Python). ✅
- **Font:** Helvetica + Helvetica Light (body), bundled (free metric-compatible fetch at build, open-source/non-commercial — no license). Roboto Mono for stats. ✅
- **Corners:** 6–8px (buttons/inputs), 10–12px (cards). Not pill. ✅
- **Color:** very-dark-grey base (#0E0E10/#141417), **red #E5484D accent only**, hairline borders. Not slate. ✅
- **Glass:** frosted blur on chrome (sidebar/header/status/modals) + sharp hairline edges; content cards solid. ✅
- **Installer:** full native (MSI/NSIS Windows, DMG macOS, deb/AppImage Linux) — NOT a portable zip. ✅
- **Persistence:** auto-save `poolr.json` to disk on every action (atomic write + `.bak`), resumable across days. ✅
- **Workflow:** branch off `develop` → PR to `develop` → CI green → merge → `develop`→`main` → tag `v0.4.0` → release. Never to `main` first. ✅

## 1. Current State (read-only)
- Repo: Python package, `src/poolr/` (CustomTkinter UI + Python engine). v0.3.3 released.
- Engine correct & tested: `src/poolr/meta/analysis.py`, `grade.py`, `plotting/figures.py`, `export/reports.py`. `tests/verification/test_meta_analysis.py` pins exact numbers (e.g. MD CI=(-0.820,0.550)→non-significant). **These numbers are the acceptance oracle for the C# port.**
- UI defects confirmed: no margin system; screening decision buttons overflow (`pack(side=left,expand,fill=x)`); `_update_list` destroys+rebuilds all widgets per visit → slow/buggy tabs.

## 2. Repository Layout (new monorepo, on the branch)
```
poolr-app/
├── src-tauri/            # Rust Tauri shell + sidecar spawner + IPC bridge
│   ├── Cargo.toml
│   ├── tauri.conf.json   # bundle: msi+nsis (win), dmg (mac), deb+appimage (linux); embed engine + webview2 fixed
│   └── src/main.rs
├── frontend/             # React + TS + Vite UI
│   ├── src/
│   │   ├── components/   # Sidebar, HeaderBar, StatusBar, Card, KpiTile, Button
│   │   ├── pages/        # Dashboard, Protocol, Search, Screening, Extraction, RoB, Meta, Prisma
│   │   ├── lib/          # api client (fetch to sidecar), theme (Helvetica, dark-red tokens)
│   │   └── main.tsx
│   ├── tailwind.config.js, index.css (font-face + tokens)
│   └── package.json
├── engine/               # C# 12 / .NET 8 AOT sidecar
│   ├── Poolr.Engine/     # MetaAnalysis, Grade, Figures, Export, ProjectStore
│   ├── Poolr.Engine.Api/ # ASP.NET minimal API: /health, /api/meta, /api/figure/*, /api/grade, /api/export
│   └── Poolr.Engine.sln
├── src/poolr/            # KEEP until C# parity proven (deleted in cleanup PR later)
└── .github/workflows/build.yml  # extend: Node + .NET + Tauri build, 6-OS native installers
```

## 3. Step-by-Step (bite-sized; branch `feat/web-overhaul` off `develop`)

### Phase A — Toolchain + Scaffold (EXECUTING)
- A1: `git checkout -B feat/web-overhaul origin/develop`.
- A2: Install toolchains if missing: Rust (rustup), .NET 8 SDK, Tauri CLI (`npm i -g @tauri-apps/cli`), WiX/NSIS for installer. Verify versions.
- A3: `npm create vite@latest frontend -- --template react-ts`; add Tailwind + shadcn/ui. Blank styled "poolr" renders in `npm run dev`.
- A4: `tauri init` in `src-tauri/`; blank Tauri window opens (dev). Confirms Rust+WebView2 toolchain.
- A5: `dotnet new sln` + `dotnet new webapi` (minimal) → `engine/Poolr.Engine.Api`; `dotnet run` serves `/health`.
- A6: Tauri spawns the C# Api sidecar; React calls `http://127.0.0.1:<port>/health` → shows "connected". Minimal end-to-end bridge.
- A7: Commit + push + **open PR to `develop`** (CI must at least build the scaffold).

### Phase B — C# Engine (validated against pinned Python numbers)
- B1: Port `MetaAnalysis` to C# (`Poolr.Engine/MetaAnalysis.cs`): OR/RR/RD/MD/SMD/HR, fixed + DerSimonian-Laird/REML/Paule-Mandel/Hunter-Schmidt, Cochran Q, I², τ².
- B2: **Test B1** against `tests/verification/test_meta_analysis.py` oracle: feed same datasets, assert pooled estimate + CI + I² match within 1e-6. (Port the oracle to C# xUnit or a Python harness that calls the sidecar.)
- B3: Port Egger/Begg publication bias; re-validate.
- B4: Port GRADE (`create_grade_summary`).
- B5: Port figures to SkiaSharp (`create_forest_plot`, `create_funnel_plot`) → return PNG bytes.
- B6: Port export (`export_to_word`, `export_to_latex`, JSON).
- B7: `ProjectStore`: load/save `poolr.json` (System.Text.Json) — see Phase E persistence.

### Phase C — React Shell (premium, margin-correct)
- C1: Theme tokens (Helvetica font-face, dark-grey #0E0E10, red #E5484D, radius 6–8px, hairline border) in `frontend/src/lib/theme`.
- C2: `Sidebar` (8 nav, active/hover, 240px, frosted) + `HeaderBar` (title + project + actions) + `StatusBar` (version, save state) — glass chrome per visual spec.
- C3: Project open/new (Tauri file dialog) → load `poolr.json` into React state via sidecar.

### Phase D — Port 8 Pages (React, via sidecar)
- D1 Dashboard: KPI tiles from project.
- D2 Protocol/PICO form → save.
- D3 Search: generate-from-PICO + per-DB editable + export .txt.
- D4 **Screening: virtualized list (TanStack Virtual) + detail + color-coded Include/Exclude/Unsure; NO full rebuild on switch** (fixes slow/buggy + overlap).
- D5 Extraction: table + form + CSV/RIS.
- D6 RoB: RoB2/NOS/PROBAST forms.
- D7 Meta: settings + Run → results + forest/funnel images.
- D8 PRISMA: checklist + flow + GRADE + export.

### Phase E — Persistence (multi-day MA guarantee)
- E1: `ProjectStore.Save` = atomic write (temp file + rename) + rolling `.bak`.
- E2: Auto-save on every mutation (debounced 300ms).
- E3: Load-on-start; validate; restore `.bak` if corrupt.
- **Acceptance test:** start MA, 50 screening decisions, force-close, reopen → all 50 present.

### Phase F — Native Installers (all OS, self-contained)
- F1: `tauri.conf.json` `bundle.targets`: Windows `msi`+`nsis`; macOS `dmg`; Linux `deb`+`appimage`.
- F2: Embed C# AOT sidecar in `resources/`; Windows WebView2 **fixed runtime** bundled in installer.
- F3: GitHub Actions matrix (windows-latest x64/x86/arm64, macos x64/arm64, ubuntu x64) → 6 native installers, each self-contained.
- F4: Keep Python suite green (engine parity oracle) + add sidecar `/health` smoke in CI.

### Phase G — Workflow (your rule)
- G1: PR `feat/web-overhaul` → `develop`; CI green (Node + .NET + 6 Tauri builds).
- G2: Merge to `develop` only after green.
- G3: `develop`→`main`, tag `v0.4.0`, release with 6 native installers.

## 4. Files Likely to Change
- **New:** `src-tauri/**`, `frontend/**`, `engine/**`, `.github/workflows/build.yml` (extend).
- **Keep (temp):** `src/poolr/**` until C# parity; delete in later cleanup PR.
- **Engine parity oracle:** port `tests/verification/test_meta_analysis.py` expectations into `engine/` C# xUnit or a Python-vs-sidecar harness.

## 5. Tests / Validation
- Engine: xUnit (C#) OR Python harness calling sidecar, asserting pinned numbers (MD CI=(-0.820,0.550) non-sig; OR CI>1 sig; etc.).
- Frontend: `tsc --noEmit`, eslint, Vitest (shell + screening virtualization).
- Integration: CI boots sidecar, hits `/health` + `/api/meta` smoke.
- Persistence: force-close/reopen test (E3).
- Manual: packaged MSI on a **clean Windows VM (no Python, no WebView2)** → installs, launches, runs a meta-analysis end-to-end.

## 6. Risks / Trade-offs
- **Reimpl risk:** C# stats must match Python pins — B2/B3 are the gate; no UI ships before green.
- **Bundle size:** C# AOT + WebView2 ≈ 80–120MB (like today); acceptable.
- **WebView2 on clean Windows:** use fixed runtime in installer; verify on bare VM.
- **Signing:** unsigned → SmartScreen warning. Plan: code-sign in CI (cert as secret) — open Q: do we have a cert? If not, ship unsigned + docs for now.
- **Scope:** large; execute phase-by-phase, PR to `develop` per phase or at end (per user). This turn executes Phase A.
