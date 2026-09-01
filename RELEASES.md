# poolr Releases

## Latest Release

**poolr v0.5.7** — Complete SRMA platform: all 26 phases implemented
Release date: 2026-09-01

> The biggest release in poolr history. Every standard meta-analysis type is now implemented, plus UI polish, collaboration, analytics, and reporting infrastructure. 67 engine tests guard the numerics.

### What's New in v0.5.7

**Meta-Analysis Engines (26 phases)**
- **Network Meta-Analysis**: frequentist WLS (Rücker 2012) + Bayesian MCMC, league matrix, P-score/SUCRA ranking, node-split inconsistency
- **Multilevel / Multivariate / RVE**: three-level MA (Cheung 2014), Gleser-Olkin multivariate, cluster-robust RVE with Satterthwaite df
- **Diagnostic Test Accuracy**: bivariate Reitsma (2005) + HSROC, pooled sens/spec, DOR, AUC
- **IPD Meta-Analysis**: two-stage + one-stage Cox frailty, PH test
- **Dose-Response**: linear, E_max parametric, cubic spline (Greenland-Dennek)
- **Proportion GLMM**: logit-normal, double-arcsine, Miller back-transform
- **Prediction Intervals + Model Averaging**: t-dist PI, Akaike-weighted averaging across 6 estimators
- **Survival Extensions**: RMST meta-analysis, IPD reconstruction from KM curves
- **Living Systematic Review**: cumulative MA, ML priority screening, stopping rules
- **Reporting**: LaTeX manuscript, interactive HTML report, Python/Stata replication scripts
- **Collaboration**: project snapshots, diff, restore
- **Niche MA**: Hunter-Schmidt correlations, variability ratios, SCED (Tau-U), Poisson GLMM, agreement (kappa/ICC)
- **Specialized MA**: QoL, Economic (ICER), Genetics, Ecology, Education, Adverse Events
- **Advanced MA**: Prognostic, Qualitative, Bibliometric, Sequential/TSA, Decision Curve

**UI & Infrastructure**
- Settings page with font size live preview, color blindness modes, project templates
- What's New dialog on version change
- Crash reporting (local log + send)
- Telemetry/analytics (opt-in, privacy-first, local-only)
- Window size memory
- Export preview modal
- Effect size conversions in Meta page
- RoB AI reasoning display
- Study count limit warnings
- Duplicate project detection
- Rayyan/Covidence import support
- Bulk PDF upload queue

**Statistics Engine**
- 67 xUnit tests (up from 22)
- All new numerics validated against published reference outputs

### Validation

All CI gates pass: C# format verification, frontend lint/type/build/Vitest, the engine xUnit suite (67 tests), Rust fmt + clippy (-D warnings), and the .NET vulnerability scan.

### Downloads (native installers)

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr_0.5.7_x64_en-US.msi` | Recommended for most PCs. Also ships `poolr_0.5.7_x64-setup.exe` (NSIS) installer. |
| Windows x86 | `poolr_0.5.7_x86_en-US.msi` | 32-bit Windows. |
| Windows ARM64 | `poolr_0.5.7_arm64_en-US.msi` | Windows on ARM. |
| macOS Apple Silicon | `poolr_0.5.7_aarch64.dmg` | Contains `poolr.app`. |
| macOS Intel | `poolr_0.5.7_x64.dmg` | Contains `poolr.app`. |
| Linux x86_64 | `poolr_0.5.7_amd64.deb` + `poolr-0.5.7-1.x86_64.rpm` | Debian or RPM package. |

---

**poolr v0.5.3** — Interface overhaul
Release date: 2026-08-26

> The same rigorous SRMA engine behind a completely reworked interface: light and dark themes with a persisted toggle, a floating dock instead of a sidebar, a boot splash and first-run personalization, a Ctrl+K command palette, live computation states while the engine works, a screening funnel with reviewer-team selection, and a live PRISMA flow diagram.

### What's New in v0.5.3

**Theming**
- Light and dark themes across every surface (pages, charts, canvas background field, native controls). One-click toggle in the header; choice persists between sessions. Dark remains poolr's signature monochrome look.
- All UI primitives rebuilt on design tokens so components and charts follow the theme automatically.

**Navigation & shell**
- Floating dock navigation (magnifying icon dock with tooltips and an active indicator) replaces the fixed sidebar; more room for content on every page.
- Boot splash greets you in multiple languages while local services start; optional first-run setup lets you pick an avatar and name (stored locally).
- Command palette on Ctrl+K for jumping to any page or running file actions.
- Profile menu (bottom-right): profile, appearance toggle, settings, and version/license information in one quiet place.
- Workspace options drawer: demo data, new workspace, theme — contextual panels without leaving your page.

**Working surfaces**
- Screening: animated PRISMA screening funnel plus a reviewer-count selector for dual screening.
- Meta-Analysis: shimmer state on the Run button while pooling computes, and a live stage panel showing exactly what the engine is doing (pooling, sensitivity, publication bias, figures).
- PRISMA: live Sankey flow diagram driven by your recorded numbers, plus a checklist/flow options drawer.

### Validation

All CI gates pass: C# format verification, frontend lint/type/build/Vitest, the engine xUnit suite, Rust fmt + clippy (-D warnings), and the .NET vulnerability scan. Packaged install smoke-tested end-to-end on Windows x64.

### Downloads (native installers)

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr_0.5.3_x64_en-US.msi` | Recommended for most PCs. Also ships `poolr_0.5.3_x64-setup.exe` (NSIS) installer. |
| Windows x86 | `poolr_0.5.3_x86_en-US.msi` | 32-bit Windows. |
| Windows ARM64 | `poolr_0.5.3_arm64_en-US.msi` | Windows on ARM. |
| macOS Apple Silicon | `poolr_0.5.3_aarch64.dmg` | Contains `poolr.app`. |
| macOS Intel | `poolr_0.5.3_x64.dmg` | Contains `poolr.app`. |
| Linux x86_64 | `poolr_0.5.3_amd64.deb` + `poolr-0.5.3-1.x86_64.rpm` | Debian or RPM package. |

---

**poolr v0.5.2** — Quality & correctness pass
Release date: 2026-08-26

> A focused maintenance release on top of v0.5.1's complete classical meta-analysis toolset: no more console-window flash on Windows launch, a truthful version string and connection indicator in the shell, and visible errors when the bundled demo project fails to load.

### What's New in v0.5.2

**Fixed**
- Launching poolr on Windows no longer opens (or flashes) a terminal window alongside the app. The bundled C# engine sidecar is spawned windowless (`CREATE_NO_WINDOW`, stdio detached) while keeping its crash-safe JobObject cleanup.
- The sidebar footer and copyright line now show the real app version from a single shared constant — they no longer display a stale hardcoded "v0.4.0".
- The connection indicator no longer sticks on "offline" right after launch: the shell polls the engine with backoff during cold start instead of giving up after one 1.5-second probe.
- Loading the bundled demo project surfaces an explicit error banner if it fails, instead of failing silently.

### Validation

All CI gates pass: C# format verification, frontend lint/type/build/Vitest, the engine xUnit suite, Rust fmt + clippy (-D warnings), and the .NET vulnerability scan. The packaged install was smoke-tested end-to-end: silent launch with no console window, engine health reporting 0.5.2, and demo-project load working.

### Downloads (native installers)

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr_0.5.2_x64_en-US.msi` | Recommended for most PCs. Also ships `poolr_0.5.2_x64-setup.exe` (NSIS) installer. |
| Windows x86 | `poolr_0.5.2_x86_en-US.msi` | 32-bit Windows. |
| Windows ARM64 | `poolr_0.5.2_arm64_en-US.msi` | Windows on ARM. |
| macOS Apple Silicon | `poolr_0.5.2_aarch64.dmg` | Contains `poolr.app`. |
| macOS Intel | `poolr_0.5.2_x64.dmg` | Contains `poolr.app`. |
| Linux x86_64 | `poolr_0.5.2_amd64.deb` + `poolr-0.5.2-1.x86_64.rpm` | Debian or RPM package. |

---

**poolr v0.5.1** — Complete classical meta-analysis
Release date: 2026-08-25

> Everything a standard pairwise systematic review needs: Knapp-Hartung CIs, Mantel-Haenszel and Peto poolers validated against metafor's published outputs, leave-one-out/cumulative sensitivity, real trim-and-fill, PET/PEESE/p-curve/selection models/Henmi-Copas, proportions/rates/correlations/generic-IV outcomes, robvis-style RoB figures for six tools (now including ROBINS-I, QUADAS-2, AMSTAR-2), a GRADE Summary-of-Findings generator with OIS-based imprecision, R/metafor replication scripts, BibTeX/RIS citation export, structured exclusion reasons with automatic import de-duplication, a PRISMA 27-item checklist tracker, and a bundled demo project.

### What's New in v0.5.1

**Statistics engine**
- **Knapp-Hartung-Sidik-Jonman confidence intervals** (t-distribution on k-1 df) — recommended for random-effects pooling.
- **Mantel-Haenszel OR** (Robins-Breslow-Greenland variance) and **Peto one-step OR** — the RevMan defaults, numerically validated to match `metafor::rma.mh` / `rma.peto` on the classic BCG dataset (MH OR 0.6229 [0.5748, 0.6750]; Peto OR 0.6222).
- **Sensitivity suite**: leave-one-out table with influence ranking, cumulative meta-analysis by year, fixed-vs-random side-by-side comparison.
- **Publication-bias depth**: Egger + Begg, computed **trim-and-fill** (Duval-Tweedie L0), Peters & Harbord regressions, PET/PEESE, p-curve (right/left-skew tests), Henmi-Copas limit meta-analysis, and an experimental step-function selection model (3PSM). Fail-safe N (Rosenthal + Orwin).
- **Heterogeneity extensions**: H² statistic and I² 95% confidence interval (non-central chi-square method) alongside Q/I²/τ².
- **Subgroup analysis overhauled**: model-consistent per-group pooling with within-group heterogeneity and the **Q-between interaction test**.
- **New outcome types**: single-arm proportions (logit/arcsine), incidence rates (IRR/IRD), correlations (Fisher z), and generic inverse-variance entry; **Glass's delta** SMD variant.
- **Effect-size conversions**: OR↔RR↔RD↔NNT at a given control rate, SMD↔OR (Hasselblad-Hedges), median+IQR/range → mean/SD (Wan 2014), CI→SE.

**Workflow**
- Structured exclusion reasons (PICO-failure tags) that feed PRISMA flow reporting.
- Automatic de-duplication on import (PMID / DOI / normalized-title matching) with duplicate counts surfaced.
- ROBINS-I, QUADAS-2 and AMSTAR-2 join RoB 2 / NOS / PROBAST as built-in tools.

**Figures & reporting**
- **robvis-style traffic-light plot** and **weighted summary bar chart** for any RoB tool.
- Contour-enhanced funnel plot (p<.01/.05/.10 significance regions), Galbraith (radial), L'Abbe and Baujat plots in the engine API.
- **GRADE Summary-of-Findings generator**: Cochrane-style SoF tables with absolute-risk column, OIS-based imprecision assessment and explicit downgrade reasons.
- **R replication script export**: every analysis regenerable in `metafor` from the raw data.
- **Citation export**: BibTeX + RIS of included studies. Methods-section paragraph generator.

**App**
- Meta-Analysis page: measure picker extended (MH/Peto/Glass/proportions/rates/correlations/generic IV), Knapp-Hartung toggle, sensitivity table with most-influential-study highlighting, I² CI + H² tiles, Q-between display, contour funnel card.
- Screening page: exclusion-reason dropdown on exclude decisions, dedup-aware imports.
- Risk of Bias page: six tools with correct domain sets incl. Critical overall rating.
- PRISMA page: interactive 27-item checklist tracker (auto-saved with the project).
- Bundled demo project (BCG vaccine dataset) loadable from the header — one click to explore a full review.

### Validation

Engine numerics are guarded by the xUnit suite (24 tests): MH and Peto poolers reproduce metafor's published BCG results; KH adjustment, subgroup Q-between, Wan 2014 conversions, OIS math and the noncentral-chi-square I² interval are benchmark-tested. The frontend parser/API suites (38 Vitest tests) continue to gate CI.

### Downloads (native installers)

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr-windows-x64.msi` | Recommended for most PCs. Also ships `poolr-windows-x64.exe` (NSIS) installer. |
| Windows x86 | `poolr-windows-x86.msi` | 32-bit Windows. |
| Windows ARM64 | `poolr-windows-arm64.msi` | Windows on ARM. |
| macOS Apple Silicon | `poolr-macos-arm64.dmg` | Contains `poolr.app`. |
| macOS Intel | `poolr-macos-x64.dmg` | Contains `poolr.app`. |
| Linux x86_64 | `poolr-linux-x86_64.deb` + `poolr-linux-x86_64.rpm` | Debian or RPM package. |

---

**poolr v0.5.0** — Quality & polish release  
Release date: 2026-08-24

> Hardened CI with real gates, frontend unit-test suite, premium Bklit UI charts (screening rings, I² gauge, RoB radar, study-weight rings), pure-MIT license fix, and repo-professionalism pass.

### What's New in v0.5.0

- **Bklit UI charts** themed to poolr's monochrome palette: animated screening-progress rings + I² heterogeneity gauge on the Dashboard, per-study weight rings on Meta-Analysis, RoB domain-coverage radar.
- **Frontend unit tests** (Vitest, 38): citation parsers + engine API bridge — wired into CI as a required gate.
- **CI hardened**: every gate fails the build now (C# format without bypass, oxlint, Vitest, cargo fmt --check, clippy -D warnings, vulnerability scan that exits non-zero).
- **Fixed**: CSV import losing the first record when a header-less file mentioned "abstract"; Rust `static mut` undefined behaviour replaced with a safe `OnceLock`.
- **License**: pure MIT (contradictory footer removed) — GitHub now recognises the license correctly.

### Downloads (native installers)

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr-windows-x64.msi` | Recommended for most PCs. Also ships `poolr-windows-x64.exe` (NSIS) installer. |
| Windows x86 | `poolr-windows-x86.msi` | 32-bit Windows. |
| Windows ARM64 | `poolr-windows-arm64.msi` | Windows on ARM. |
| macOS Apple Silicon | `poolr-macos-arm64.dmg` | Contains `poolr.app`. |
| macOS Intel | `poolr-macos-x64.dmg` | Contains `poolr.app`. |
| Linux x86_64 | `poolr-linux-x86_64.deb` + `poolr-linux-x86_64.rpm` | Debian or RPM package. |

---


---

**poolr v0.4.0** — Native Tauri + React + C# overhaul  
Release date: 2026-08-02

> This release replaces the old Python / CustomTkinter app with a fully native desktop build: a **Tauri 2 (Rust)** window, a **React + TypeScript** UI, and a bundled **C# 12 / .NET 8** statistical engine sidecar. No Python runtime is required — the app runs on any stock machine. Project data auto-saves (`poolr.json` + rolling `.bak`) so multi-day reviews survive a force-close.

### Downloads (native installers — full, not portable zips)

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr-windows-x64.msi` | Recommended for most PCs. |
| macOS Apple Silicon | `poolr-macos-arm64.dmg` | Contains `poolr.app`. |
| macOS Intel | `poolr-macos-x64.dmg` | Contains `poolr.app`. |
| Linux x86_64 | `poolr-linux-x86_64.deb` + `poolr-linux-x86_64.rpm` | Debian or RPM package. |

### What's New in v0.4.0

- **Fully native stack**: Tauri 2 (Rust) shell + React/TypeScript UI + C# 12 / .NET 8 engine sidecar (localhost HTTP API). **100% Python-free**.
- **All 8 pages reimplemented** in React; screening import from PubMed/CSV/RIS/EndNote; in-app forest/funnel plots; auto-GRADE; 6-OS installers.

---
