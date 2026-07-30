# poolr

[![Build Status](https://github.com/harisawan-bit/poolr/workflows/CI/badge.svg)](https://github.com/harisawan-bit/poolr/actions)
[![Release](https://img.shields.io/github/v/release/harisawan-bit/poolr)](https://github.com/harisawan-bit/poolr/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/harisawan-bit/poolr/releases)

**poolr** is a free, open-source, no-code desktop application for conducting **Systematic Reviews and Meta-Analyses (SRMA)**. It guides you through the entire PRISMA 2020-compliant pipeline — from PICO definition to publication-ready manuscript — with a modern, intuitive GUI.

No programming required. No cloud dependency. Your data stays on your machine.

---

## ✨ Features

### 📋 **Protocol & Planning**
- **PICO Builder** for Population, Intervention, Comparator, Outcomes with placeholders
- Protocol registration fields (PROSPERO ID, study designs, date range, languages)
- Auto-saves to local `poolr.json` — fully portable projects

### 🔍 **Search Strategy Builder**
- Auto-generates search strings for **PubMed/MEDLINE, Embase, Cochrane CENTRAL, Scopus, Web of Science** from your PICO
- Editable syntax-highlighted text areas per database
- Export all strategies as `.txt` for protocol appendix

### ☑️ **Dual Independent Screening**
- **Title/Abstract** and **Full-Text** screening modes
- Two-reviewer workflow with **conflict detection and resolution UI**
- CSV import/export for Rayyan/Covidence interoperability
- PRISMA flow numbers auto-calculated from decisions

### 📝 **Structured Data Extraction**
- Comprehensive forms: Study ID, Design, Population, Intervention/Control groups (binary, continuous, time-to-event), Outcomes, Neurosurgery-specific fields
- CSV and **RIS (EndNote/Zotero/Mendeley)** import/export
- Add/edit/delete studies with validation

### ⚠️ **Risk of Bias Assessment**
- **RoB 2** (RCTs), **NOS** (cohort/case-control), **PROBAST** (diagnostic/prognostic)
- Domain-level judgments with overall rating
- Summary tables auto-generated

### 📈 **Advanced Meta-Analysis Engine**
| Outcome Type | Effect Measures | Models | Methods |
|--------------|----------------|--------|---------|
| Binary | OR, RR, RD | Fixed / Random-effects | DerSimonian-Laird, REML, Paule-Mandel, Hunter-Schmidt |
| Continuous | MD, SMD (Hedges' g) | Fixed / Random-effects | Inverse variance, DL, REML |
| Time-to-event | HR | Fixed / Random-effects | Generic inverse variance |

- **Subgroup analysis** by design, country, year, or custom fields
- **Meta-regression** (year, sample size, continuous covariates)
- **Publication bias**: Egger's test, Begg's test, funnel plot asymmetry
- **Heterogeneity**: Cochran's Q, I², τ², prediction intervals

### 📊 **Publication-Ready Figures**
- **Forest plots**: Weight-proportional squares, diamond pooled estimate, log/linear scale, SVG/PNG/PDF export
- **Funnel plots**: Pseudo-95% CI contours, study weights as bubble size, color-coded
- **PRISMA 2020 Flow Diagram**: Interactive canvas with auto-population from screening data, SVG export

### 📋 **GRADE Evidence Profiles**
- Auto-populated from meta-analysis results + RoB assessments
- Five-domain assessment (Risk of Bias, Inconsistency, Indirectness, Imprecision, Publication Bias)
- Starting certainty (RCT=High, Observational=Low) with automatic downgrade logic
- Export as Word table, LaTeX, JSON

### 📄 **Manuscript Export**
- **Word (.docx)**: Full PRISMA-structured manuscript with tables, figures, references
- **LaTeX (.tex)**: Journal-ready with `booktabs`, `forestplot`, `pgfplots` support
- **JSON**: Complete project archive for reproducibility

### 🔬 **PubMed Direct Import**
- Search PubMed via NCBI Entrez API (with API key support for 10 req/s)
- Import records directly into screening with PMID, abstract, MeSH, keywords
- Date range filters, query history

### 🖥️ **Cross-Platform Desktop App**
| Platform | Architectures | Installer |
|----------|---------------|-----------|
| **Windows** | x64, x86, ARM64 | `.exe` (NSIS), portable `.zip` |
| **macOS** | Intel (x64), Apple Silicon (ARM64) | `.dmg` (notarized), `.app` bundle |
| **Linux** | x64, ARM64 | `.AppImage`, `.deb`, `.rpm`, Flatpak |

---

## 🚀 Quick Start

### Download (Recommended)
1. Go to [Releases](https://github.com/harisawan-bit/poolr/releases/latest)
2. Download the installer for your platform:
   - **Windows**: `poolr-x64-setup.exe` (or `poolr-x86-setup.exe`, `poolr-arm64-setup.exe`)
   - **macOS**: `poolr-universal.dmg` (runs on both Intel and Apple Silicon)
   - **Linux**: `poolr-x86_64.AppImage` (or ARM64)
3. Install and launch — no Python, no dependencies needed

### Releases
See [RELEASES.md](./RELEASES.md) for version history, migration notes, and download links.

### From Source (Developers)
```bash
# Requirements: Python 3.9+, Git
git clone https://github.com/harisawan-bit/poolr.git
cd poolr

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install in development mode
pip install -e ".[dev]"

# Run GUI
poolr

# Or run CLI
poolr-cli --help
```

### CLI for Automation (CI/CD)
```bash
# Run meta-analysis and export Word report headlessly
poolr-cli ./my_srma_project --run-meta --export word --output ./reports/

# Export all formats
poolr-cli ./my_srma_project --export all --output ./dist/
```

---

## 📁 Project Structure

```
poolr/
├── src/poolr/                 # Main package
│   ├── main.py               # GUI entry point
│   ├── cli.py                # Headless CLI
│   ├── pages/                # GUI pages (one per SRMA phase)
│   │   ├── dashboard.py      # Overview, quick actions, project info
│   │   ├── protocol.py       # PICO + protocol metadata
│   │   ├── search.py         # Search strategy builder
│   │   ├── screening.py      # Dual-reviewer screening
│   │   ├── extraction.py     # Data extraction forms
│   │   ├── rob.py            # RoB 2 / NOS / PROBAST
│   │   ├── meta.py           # Meta-analysis settings + results
│   │   └── prisma.py         # PRISMA checklist + flow + GRADE
│   ├── meta/                 # Statistical engine
│   │   ├── analysis.py       # Meta-analysis (OR, RR, MD, SMD, HR)
│   │   └── grade.py          # GRADE evidence profiling
│   ├── plotting/             # Publication figures
│   │   └── figures.py        # Forest, funnel, PRISMA flow (matplotlib)
│   ├── export/               # Manuscript export
│   │   └── reports.py        # Word, LaTeX, JSON
│   ├── import_/              # Data import
│   │   ├── pubmed.py         # NCBI Entrez API client
│   │   └── ris.py            # RIS format (EndNote/Zotero)
│   └── grade.py              # GRADE table generator
├── assets/                   # Icons, themes, templates
├── tests/                    # Unit + integration tests
├── scripts/                  # Build/packaging scripts
├── .github/workflows/        # CI/CD (Windows, macOS, Linux)
├── pyproject.toml            # Package config
└── README.md                 # This file
```

---

## 🧪 Testing

```bash
# Run all tests
pytest -v

# With coverage
pytest --cov=poolr --cov-report=html

# Specific test suites
pytest tests/test_meta_analysis.py -v
pytest tests/test_grade.py -v
pytest tests/test_import_export.py -v
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Run the test suite: `pytest`
5. Submit a Pull Request to `develop`

### Code Style
- **Formatter**: `black` (line length 100)
- **Linter**: `ruff`
- **Type hints**: Required for new functions
- **Docstrings**: NumPy style

---

## 📜 License

MIT License — free for academic and commercial use. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **PRISMA 2020** statement authors for reporting guidelines
- **Cochrane** for RoB 2 and GRADE methodology
- **NCBI** for PubMed/Entrez API access
- **matplotlib**, **pandas**, **statsmodels**, **scipy** for statistical computing
- **CustomTkinter** for the modern GUI framework

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/harisawan-bit/poolr/issues)
- **Discussions**: [GitHub Discussions](https://github.com/harisawan-bit/poolr/discussions)
- **Email**: poolr-support@example.com

---

**Made with ❤️ for the evidence-based medicine community**

> *"Systematic reviews are the cornerstone of evidence-based practice. poolr makes them accessible to everyone."*