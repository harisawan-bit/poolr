# Poolr Product Roadmap

Our mission is to establish Poolr as the world's most accessible, reliable, and comprehensive open-source desktop platform for systematic reviews and meta-analyses.

---

## Current Release: v0.5.7 (September 2026) :white_check_mark:
- [x] Full PRISMA 2020 8-stage pipeline from PICO to publication.
- [x] Zero-warning C# engine with 67 xUnit mathematical benchmark tests.
- [x] 100% Python-free desktop distribution across Windows (MSI/NSIS), macOS (Apple Silicon/Intel), and Linux (DEB/RPM).
- [x] Authentic literature search: NCBI PubMed MEDLINE pipeline, OpenAlex, Crossref, ClinicalTrials.gov.
- [x] Dual independent screening with inter-rater reliability (Cohen's Kappa $\kappa$, $95\%$ CI) and conflict resolution.
- [x] Cochrane robvis-style vector SVG figures (Traffic Light and Weighted Summary Bar).
- [x] Interactive Figure Studio: Contour-Enhanced Funnel, Galbraith radial, L'Abbé, Baujat plots with 1-click SVG export.
- [x] Advanced Statistical Rigor: Higgins 95% Prediction Interval, Trial Sequential Analysis (TSA), and AICc Multimodel Inference.
- [x] Specialized Analyses Hub: Dose-Response (Emax spline), Survival RMST, Health Economics (ICER/INMB), Adverse Events, DCA.
- [x] Universal Export Center: Word PRISMA manuscript (.docx), LaTeX (.tex), Standalone HTML (.html), R (.R), Stata (.do), Python (.py), BibTeX, RIS.

---

## Near-Term Horizon (v0.6.x — Q4 2026) :construction:
- [ ] **RevMan Interoperability**: Full two-way import and export of Cochrane RevMan 5 and RevMan Web (`.rm5`) project archives.
- [ ] **Direct Reference Manager Sync**: Live bi-directional integration with Zotero and Mendeley libraries via local APIs.
- [ ] **Living Systematic Review Automation**: Scheduled background alerts for PubMed/OpenAlex search updates with deduplication against existing screened cohorts.
- [ ] **Enhanced AI Screening**: Local Ollama / llama.cpp integration for 100% offline, private LLM-assisted zero-shot title/abstract relevance scoring.

---

## Mid-Term Horizon (v0.7.x — 2027) :crystal_ball:
- [ ] **WebAssembly (Wasm) Engine Mode**: Compile the C# engine to Wasm via .NET Wasm SDK to enable zero-install, in-browser execution with local browser storage.
- [ ] **Bayesian MCMC Meta-Analysis**: Integrated Gibbs sampling / Hamiltonian Monte Carlo engine for complex non-linear multi-parameter evidence synthesis.
- [ ] **PRISMA-DTA & PRISMA-ScR Extensions**: Specialized automated flows and checklists for Diagnostic Test Accuracy and Scoping Reviews.

---

## Long-Term Horizon (v1.0.0 LTS) :rocket:
- [ ] **Multi-Center Collaborative Sync**: Peer-to-peer encrypted CRDT synchronization enabling multi-investigator teams to screen and extract simultaneously without central servers.
- [ ] **Cochrane & Campbell Endorsement**: Full accreditation and compliance certification with Cochrane Methodological Innovation guidelines.
