# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Galbraith/Baujat NullReferenceException**: Added null guards for `PlotInput.Effs`, `Vars`, and `Names` in `DiagnosticFigures.cs` to prevent HTTP 500 crashes when model binder receives incomplete JSON
- **Cluster Detection IndexOutOfRange**: Added validation that `variances` count matches `effects` count in `ClusterDetectionEngine.cs`
- **League Matrix IndexOutOfRange**: Added null/empty matrix validation in `LeagueMatrixEngine.cs`
- **Multilevel NMA Arithmetic Overflow**: Added minimum study count guard (>= 2 treatments AND >= 2 valid studies) BEFORE matrix operations in `MultilevelHsrocEngine.cs`
- **Multi-Arm NMA Arithmetic Overflow**: Added minimum edge count guard BEFORE matrix operations in `MultiArmNmaEngine.cs`

### Changed
- **Version sync**: Updated `Poolr.Engine.Api.csproj` from `0.5.7` to `0.6.1` to match actual app version
- **Compiler warnings**: Eliminated all 33 `CS8629 Nullable value type may be null` warnings across Bayesian, multilevel, prognostic, and grade engines

## [0.6.1] - 2026-09-15

### Added
- **Multi-Study Support**: Added `StudyManager` with localStorage persistence and interactive `StudySelector` to effortlessly switch between active systematic reviews.
- **AnalysisHub (34+ Specialized Engines)**: Tabbed workspace integrating Bayesian MCMC, GOSH diagnostics, Permutation tests, Bootstrap CIs, Test of Excess Significance (TES), RevMan 5 bidirectional import/export, and reference manager sync (Zotero/Mendeley).
- **Quality Assessment Workflows**: Added dedicated interfaces and backend engines for RoB 2, ROBINS-I, QUADAS-2, AMSTAR-2, Newcastle-Ottawa Scale (NOS), and GRADE Evidence Profiles.
- **Statistical Parity Suite**: Expanded xUnit regression benchmark tests to 226 tests covering all new engines with zero failures.

### Fixed
- Code formatting across .NET engines enforcing zero-warning standards.
- Clean TypeScript and React 19 build across all analysis pages and components.

## [0.6.0] - 2026-09-09

### Fixed
- **Import parsers (critical)**: MEDLINE/RIS/EndNote parsers now split on 2+ consecutive newlines instead of whitespace lines
- **PubMed search**: Replaced inline efetch parser with shared `parseMedline`
- **Blocking dialogs eliminated**: All `alert()`/`confirm()`/`prompt()` calls replaced with inline banners
- **React stability**: Fixed stale closure in Meta.tsx auto-run; stabilized render-unstable arrays via `useRef`
- **Grey Literature**: Replaced mock data with real Google Scholar/ClinicalTrials.gov/OpenAlex API calls

## [0.5.3] - 2026-08-26

### Added
- Theming, navigation floating dock, boot experience, command palette, screening PRISMA chart, meta-analysis live computation, profile menu

### Changed
- UI primitives token-driven, version unified at 0.5.3

## [0.5.2] - 2026-08-26

### Fixed
- Windows console window flash eliminated, version display fixed, connection indicator polling, demo project error handling

### Changed
- Version unified at 0.5.2

## [0.5.1] - 2026-08-25

### Added
- Knapp-Hartung CI adjustment, Mantel-Haenszel/Peto poolers, sensitivity pack, trim-and-fill, publication bias tests, p-curve, fail-safe N, H²/I² CI, subgroup Q-between, new outcome types, effect-size conversions
- Figures: contour-enhanced funnel, Galbraith, L'Abbé, Baujat, robvis RoB plots
- GRADE Summary-of-Findings, export suite, expanded frontend features

### Changed
- Version unified at 0.5.1

## [0.5.0] - 2026-08-24

### Added
- Bklit UI charts, frontend unit tests, issue/PR templates, README overhaul

### Changed
- CI hardened (all gates fail build), LICENSE pure MIT, Rust shell identity

### Fixed
- CSV citation import header detection, Rust unsafe static mut, C# formatting

## [0.4.0] - 2026-08-02

### Added
- Native desktop overhaul (Tauri 2 + React/TypeScript + C# .NET 8 engine sidecar), 100% Python-free

## [0.3.2] - 2026-07-31

### Fixed
- Page navigation crash, PRISMA modal hang, meta-analysis significance test null value, macOS DMG naming

## [0.3.1] - 2026-07-31

### Added
- Version display window, tagged releases

### Fixed
- 8 runtime bugs

## [0.3.0] - 2026-07-30

### Added
- Initial modular architecture, GUI, meta-analysis engine, plots, PRISMA, GRADE, exports, installers

## [0.1.0] - 2026-07-30

### Added
- Initial proof-of-concept release

---

## Release Template

## [X.Y.Z] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Removed
### Security
