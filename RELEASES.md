1|# poolr Releases
2|
3|## Latest Release
4|
5|**poolr v0.5.1** — Complete classical meta-analysis
6|Release date: 2026-08-25
7|
8|> Everything a standard pairwise systematic review needs: Knapp-Hartung CIs, Mantel-Haenszel and Peto poolers validated against metafor's published outputs, leave-one-out/cumulative sensitivity, real trim-and-fill, PET/PEESE/p-curve/selection models/Henmi-Copas, proportions/rates/correlations/generic-IV outcomes, robvis-style RoB figures for six tools (now including ROBINS-I, QUADAS-2, AMSTAR-2), a GRADE Summary-of-Findings generator with OIS-based imprecision, R/metafor replication scripts, BibTeX/RIS citation export, structured exclusion reasons with automatic import de-duplication, a PRISMA 27-item checklist tracker, and a bundled demo project.
9|
10|### What's New in v0.5.1
11|
12|**Statistics engine**
13|- **Knapp-Hartung-Sidik-Jonman confidence intervals** (t-distribution on k-1 df) — recommended for random-effects pooling.
14|- **Mantel-Haenszel OR** (Robins-Breslow-Greenland variance) and **Peto one-step OR** — the RevMan defaults, numerically validated to match `metafor::rma.mh` / `rma.peto` on the classic BCG dataset (MH OR 0.6229 [0.5748, 0.6750]; Peto OR 0.6222).
15|- **Sensitivity suite**: leave-one-out table with influence ranking, cumulative meta-analysis by year, fixed-vs-random side-by-side comparison.
16|- **Publication-bias depth**: Egger + Begg, computed **trim-and-fill** (Duval-Tweedie L0), Peters & Harbord regressions, PET/PEESE, p-curve (right/left-skew tests), Henmi-Copas limit meta-analysis, and an experimental step-function selection model (3PSM). Fail-safe N (Rosenthal + Orwin).
17|- **Heterogeneity extensions**: H² statistic and I² 95% confidence interval (non-central chi-square method) alongside Q/I²/τ².
18|- **Subgroup analysis overhauled**: model-consistent per-group pooling with within-group heterogeneity and the **Q-between interaction test**.
19|- **New outcome types**: single-arm proportions (logit/arcsine), incidence rates (IRR/IRD), correlations (Fisher z), and generic inverse-variance entry; **Glass's delta** SMD variant.
20|- **Effect-size conversions**: OR↔RR↔RD↔NNT at a given control rate, SMD↔OR (Hasselblad-Hedges), median+IQR/range → mean/SD (Wan 2014), CI→SE.
21|
22|**Workflow**
23|- Structured exclusion reasons (PICO-failure tags) that feed PRISMA flow reporting.
24|- Automatic de-duplication on import (PMID / DOI / normalized-title matching) with duplicate counts surfaced.
25|- ROBINS-I, QUADAS-2 and AMSTAR-2 join RoB 2 / NOS / PROBAST as built-in tools.
26|
27|**Figures & reporting**
28|- **robvis-style traffic-light plot** and **weighted summary bar chart** for any RoB tool.
29|- Contour-enhanced funnel plot (p<.01/.05/.10 significance regions), Galbraith (radial), L'Abbe and Baujat plots in the engine API.
30|- **GRADE Summary-of-Findings generator**: Cochrane-style SoF tables with absolute-risk column, OIS-based imprecision assessment and explicit downgrade reasons.
31|- **R replication script export**: every analysis regenerable in `metafor` from the raw data.
32|- **Citation export**: BibTeX + RIS of included studies. Methods-section paragraph generator.
33|
34|**App**
35|- Meta-Analysis page: measure picker extended (MH/Peto/Glass/proportions/rates/correlations/generic IV), Knapp-Hartung toggle, sensitivity table with most-influential-study highlighting, I² CI + H² tiles, Q-between display, contour funnel card.
36|- Screening page: exclusion-reason dropdown on exclude decisions, dedup-aware imports.
37|- Risk of Bias page: six tools with correct domain sets incl. Critical overall rating.
38|- PRISMA page: interactive 27-item checklist tracker (auto-saved with the project).
39|- Bundled demo project (BCG vaccine dataset) loadable from the header — one click to explore a full review.
40|
41|### Validation
42|
43|Engine numerics are guarded by the xUnit suite (24 tests): MH and Peto poolers reproduce metafor's published BCG results; KH adjustment, subgroup Q-between, Wan 2014 conversions, OIS math and the noncentral-chi-square I² interval are benchmark-tested. The frontend parser/API suites (38 Vitest tests) continue to gate CI.
44|
45|### Downloads (native installers)
46|
47|| Platform | File | Notes |
48||----------|------|-------|
49|| Windows x64 | `poolr-windows-x64.msi` | Recommended for most PCs. Also ships `poolr-windows-x64.exe` (NSIS) installer. |
50|| Windows x86 | `poolr-windows-x86.msi` | 32-bit Windows. |
51|| Windows ARM64 | `poolr-windows-arm64.msi` | Windows on ARM. |
52|| macOS Apple Silicon | `poolr-macos-arm64.dmg` | Contains `poolr.app`. |
53|| macOS Intel | `poolr-macos-x64.dmg` | Contains `poolr.app`. |
54|| Linux x86_64 | `poolr-linux-x86_64.deb` + `poolr-linux-x86_64.rpm` | Debian or RPM package. |
55|
56|---
57|
58|
59|**poolr v0.5.0** — Quality & polish release  
60|Release date: 2026-08-24
61|
62|> Hardened CI with real gates, frontend unit-test suite, premium Bklit UI charts (screening rings, I² gauge, RoB radar, study-weight rings), pure-MIT license fix, and repo-professionalism pass.
63|
64|### What's New in v0.5.0
65|
66|- **Bklit UI charts** themed to poolr's monochrome palette: animated screening-progress rings + I² heterogeneity gauge on the Dashboard, per-study weight rings on Meta-Analysis, RoB domain-coverage radar.
67|- **Frontend unit tests** (Vitest, 38): citation parsers + engine API bridge — wired into CI as a required gate.
68|- **CI hardened**: every gate fails the build now (C# format without bypass, oxlint, Vitest, cargo fmt --check, clippy -D warnings, vulnerability scan that exits non-zero).
69|- **Fixed**: CSV import losing the first record when a header-less file mentioned "abstract"; Rust `static mut` undefined behaviour replaced with a safe `OnceLock`.
70|- **License**: pure MIT (contradictory footer removed) — GitHub now recognises the license correctly.
71|
72|### Downloads (native installers)
73|
74|| Platform | File | Notes |
75||----------|------|-------|
76|| Windows x64 | `poolr-windows-x64.msi` | Recommended for most PCs. Also ships `poolr-windows-x64.exe` (NSIS) installer. |
77|| Windows x86 | `poolr-windows-x86.msi` | 32-bit Windows. |
78|| Windows ARM64 | `poolr-windows-arm64.msi` | Windows on ARM. |
79|| macOS Apple Silicon | `poolr-macos-arm64.dmg` | Contains `poolr.app`. |
80|| macOS Intel | `poolr-macos-x64.dmg` | Contains `poolr.app`. |
81|| Linux x86_64 | `poolr-linux-x86_64.deb` + `poolr-linux-x86_64.rpm` | Debian or RPM package. |
82|
83|---
84|
85|

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

