# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - develop branch

### Added
- Initial project structure with modular architecture
- GUI with 8-phase SRMA workflow (Dashboard, Protocol, Search, Screening, Extraction, RoB, Meta, PRISMA)
- Advanced meta-analysis engine supporting OR, RR, RD, MD, SMD, HR
- Random-effects (DL, REML, PM, HS, SJ, ML, EB) and fixed-effect models
- Subgroup analysis and meta-regression
- Publication bias tests (Egger, Begg)
- Forest plots and funnel plots with SVG/PNG/PDF export
- PRISMA 2020 checklist and flow diagram generator
- GRADE evidence profiling with auto-population
- Word (.docx) and LaTeX (.tex) manuscript export
- RIS import/export for EndNote/Zotero/Mendeley
- PubMed direct import via NCBI Entrez API
- Dual independent screening with conflict resolution
- Cross-platform installers (Windows, macOS, Linux)

### Changed
- N/A

### Fixed
- N/A

### Removed
- N/A

### Security
- N/A

## [0.1.0] - 2026-07-30

### Added
- Initial proof-of-concept release
- Basic GUI with sidebar navigation
- PICO definition and protocol metadata
- Search strategy builder for 5 databases
- Title/abstract and full-text screening
- Data extraction forms
- RoB 2, NOS, PROBAST assessments
- Basic meta-analysis (OR only, DerSimonian-Laird)
- PRISMA checklist (manual only)
- JSON project persistence

---

## Release Template

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Fixed
- Bug fixes

### Removed
- Removed features

### Security
- Security improvements