# Poolr Roadmap

Poolr is a desktop evidence synthesis platform (Tauri 2 + React 19 + .NET 8/C# 12).
This roadmap tracks shipped releases and planned engineering, methodological, and trust milestones toward **v1.0.0 LTS**.

---

## Shipped Highlights

### v0.6.6 — Unified Pipeline, Provenance & Workspace UI (November 2026)
- [x] **End-to-End 8-Stage Pipeline**: Connected workflow from Protocol -> Search & Library -> Screening -> Study Manager -> Risk of Bias -> Analysis -> PRISMA & GRADE -> Manuscript.
- [x] **Reference & Citation Manager**: Bibliographic dossier panel, deduplication triggers, full-text PDF/URL references, and `.bib`/`.ris`/`.csv` exports.
- [x] **Source Provenance & Extraction Converters**: Highlight-to-field excerpt assignment (`StudySourceViewer`), Median/IQR -> Mean/SD helper, and live screening/extraction sync.
- [x] **Full-Width Responsive Analysis Hub**: Stacked compact method strip giving 100% workspace width across all 14 synthesis modules, plus interactive Funnel point inspector and fixed Trial Sequential Analysis (`TSA`) payload types.
- [x] **Live PRISMA & Auto-GRADE Synchronization**: Live counts synced across pipeline stages with one-click GRADE SoF drafting and unified Team Workspace.

### v0.6.5 — Core Platform & Statistical Parity (November 2026)
- [x] **.NET 8 Engine**: Pairwise (DL/REML/PM/SJ/HE/EB), Network (NMA/CNMA/SUCRA), IPD, Multilevel, Diagnostic (Reitsma/HSROC/PRISMA-DTA), Bayesian Gibbs MCMC, Dose-Response, Survival RMST, Publication Bias, and GRADE/SoF.
- [x] **Cross-Platform Desktop Installers**: Signed binaries for Windows (`x64`, `arm64`, `x86`), macOS (`aarch64`, `x64`), and Linux (`.deb`, `.AppImage`, `.rpm`) with Ed25519 Tauri auto-updater (`C1C149B7917EDEF0`).
- [x] **RevMan `.rm5` Roundtrip, PRISMA-DTA / PRISMA-ScR, Local Ollama AI Support**.

---

## Near-Term: v0.6.7 — Security, Quality & Architecture Hardening

Focus: Close structural, security, and CI gaps before expanding external connectors.

### Security & Trust Boundaries
- [ ] Replace permissive `AllowAnyOrigin()` CORS policy in `Program.cs` with strict loopback origin allowlist + per-launch ephemeral bearer token shared between Tauri shell and .NET sidecar.
- [ ] Move LLM provider API keys out of browser `localStorage` into OS keychain (`tauri-plugin-stronghold` / platform keystore).
- [ ] Standardize structured API error envelopes and eliminate silent exception swallows.
- [ ] Add GitHub Actions CodeQL, Dependency Review, and CycloneDX SBOM generation on release tags.
- [ ] Pursue OS binary signing & notarization (Apple Developer ID + Windows EV/Trusted Signing) to prevent SmartScreen / Gatekeeper warnings in hospital and university IT environments.

### Build, Testing & Maintainability
- [ ] Single source-of-truth `VERSION` file with CI drift gate across `package.json`, `tauri.conf.json`, `Cargo.toml`, `.csproj`, `Program.cs`, and `CITATION.cff`.
- [ ] Decompose `Meta.tsx` into modular plot, TSA, model averaging, and results panes; expand shared `useMetaAnalysis` regression coverage.
- [ ] Integrate Playwright end-to-end UI regression tests and statistical benchmark (`stress_test.py`) into CI.
- [ ] External parity validation suite verifying Poolr estimates against reference `R metafor` and Cochrane RevMan datasets (`BCG`, `Olkin95`, `dat.molloy2014`) published as a reproducible verification report.
- [ ] Resolve open onboarding/fixture backlog (issues `#76` Windows dev quickstart, `#77` PRISMA expected-counts fixture, `#78` citation alignment, `#79` PubMed NBIB dedup regression).

---

## v0.7.0 — High-Throughput Screening & Evidence Retrieval

- [ ] **Priority Screening & Active Learning**: TF-IDF + Logistic / SVM ranker learning live from reviewer Include/Exclude decisions, targeting benchmarked recall thresholds (`>=95%` relevant studies surfaced within `<=40%` screening effort on SYNERGY datasets).
- [ ] **Screening Completion Curve**: Cumulative inclusion plateau estimator predicting remaining relevant records and safe stopping points.
- [ ] **Integrated PDF Full-Text Vault**: Local hash-indexed PDF store, Unpaywall / PMC OA auto-resolver, and direct `pdfjs` viewer inside Extraction & RoB (building on `StudySourceViewer`).
- [ ] **Covidence / Rayyan Migration Pack**: Native ZIP/CSV conflict-history importers alongside existing `.ris`/`.bib`/`.rm5` pipelines.
- [ ] **Extended Grey Literature & Trial Registries**: Native ClinicalTrials.gov API v2, WHO ICTRP, OSF Preprints, and medRxiv/bioRxiv search tabs.

---

## v0.7.x — Living Systematic Reviews & Semi-Automated Extraction

- [ ] **Living Surveillance Scheduler**: Scheduled background PubMed/OpenAlex delta checks with deduplication against existing project libraries and configurable alert thresholds.
- [ ] **Interactive Kaplan-Meier / Graph Digitizer**: Axis-calibrated canvas click/trace curve extraction reconstructing IPD via Guyot et al. (2012) algorithms.
- [ ] **PICO-Schema Quoted AI Extraction**: Strict span-anchored extraction requiring exact verbatim source quotes (never ungrounded generation) with dual-reviewer diffing.
- [ ] **Statistical Effect & Sanity Guards**: Pre-run checks flagging SD/SE mixups, sample size swaps, zero-cell explosions, and duplicate cohort IDs before pooling.

---

## v0.8.0 — Auditability, Protocol Lock & Team Analytics

- [ ] **Hash-Chained Provenance & Decision Ledger**: Immutable append-only audit log signing screening votes, conflict resolutions, extraction edits, and statistical runs with `SHA-256` hashes and Ed25519 reviewer signatures.
- [ ] **SAP Deviation Monitor & Automated Methods Auditor**: Compares locked PROSPERO/protocol choices against final analysis parameters and flags undocumented post-hoc switches.
- [ ] **Citation Style Language (CSL) Engine**: 1-click formatting across Vancouver, APA, AMA, BMJ, Lancet, and JAMA styles in Manuscript Studio.
- [ ] **Synthesis Without Meta-Analysis (SWiM)** structured narrative tables & visual harvest plots when quantitative pooling is inappropriate.
- [ ] **Team Productivity & Inter-Rater Dashboards**: Reviewer calibration drift, daily throughput metrics, and per-reviewer $\kappa$ breakdown.

---

## v1.0.0 LTS — Institutional Research Standard

- [ ] **Zero known `High`/`Critical` security issues**, OS-signed installers across Windows/macOS/Linux, and offline air-gapped institutional deployment documentation.
- [ ] **Published Statistical Validation Dossier** comparing all 14 Poolr synthesis engines against gold-standard `R` (`metafor`, `netmeta`, `mada`, `rjags`) and Stata packages.
- [ ] **Semantic Versioning Stability Guarantee** for `poolr.json` schema v1 and encrypted `.poolr` collaboration vaults, with automated forward migrations.

---

## Quantified Exit Gates & SLOs

| Domain | Target Metric | Release Gate |
|---|---|---|
| **Desktop Startup** | `< 1.2s` Tauri shell + `.NET` `/health` ready | `v0.6.7` |
| **Virtualization & UI** | `< 100ms` filter/scroll frame time at `10,000` citations | `v0.7.0` |
| **Statistical Precision** | `<= 1e-6` delta vs `R metafor::rma()` across `BCG`, `Olkin95`, `dat.molloy2014` | `v0.6.7` |
| **Active Learning Recall** | `>= 95%` relevant studies surfaced within `<= 40%` screening effort (SYNERGY) | `v0.7.0` |
| **Security & Integrity** | `0` Critical/High CVEs, `0` hardcoded secrets, signed installers on all 3 OSes | `v1.0.0` |

## Critical-Path Sequencing

1. `v0.6.7` hardening (`Program.cs` bearer auth + loopback CORS + `Meta.tsx` split + `VERSION` single source of truth) must land before expanding external integrations (`v0.7.0`).
2. `poolr.json` **Schema v1 freeze** + OS keychain storage must precede hash-chained audit ledgers and `.poolr` encrypted archival bundles (`v0.8.0`).
3. SYNERGY benchmark validation gates Active Learning ship readiness (`v0.7.0`).

## Risk Register & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **PubMed / Unpaywall rate-limit throttling** | High | Shared backoff queue + disk metadata cache + optional user NCBI API key in OS keychain |
| **PROSPERO / HTML scraping breakage** | Medium | Treat PROSPERO web lookup as advisory helper; prioritize structured XML/API sources |
| **Google Drive 1 MiB chunk / sync conflict limits** | Medium | Keep snapshots compact + Ed25519 manifest diffing + offline local queue |
| **SmartScreen / Gatekeeper blocks in clinical IT** | High | Dedicated Apple Developer ID notarization + Windows EV / Trusted Signing pipeline |

## Live Backlog Traceability (`harisawan-bit/poolr`)

- **#76** Windows dev quickstart (`CONTRIBUTING.md` / `v0.6.7`)
- **#77 / PR #80** PRISMA expected counts sample review fixture (`v0.6.7`)
- **#78** Citation metadata updated to `v0.6.6` (`README.md`, `CITATION.cff`, `Legal.tsx`)
- **#79** PubMed NBIB duplicate-citation regression test fixture (`v0.6.7`)

