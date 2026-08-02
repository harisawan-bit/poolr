# poolr

[![Build Status](https://github.com/harisawan-bit/poolr/workflows/CI/badge.svg)](https://github.com/harisawan-bit/poolr/actions)
[![Release](https://img.shields.io/github/v/release/harisawan-bit/poolr)](https://github.com/harisawan-bit/poolr/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![.NET 8](https://img.shields.io/badge/.NET-8-512BD4.svg)](https://dotnet.microsoft.com/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/harisawan-bit/poolr/releases)

**poolr** is a free, open-source, no-code desktop application for conducting **Systematic Reviews and Meta-Analyses (SRMA)**. It guides you through the entire PRISMA 2020-compliant pipeline — from PICO definition to publication-ready manuscript — with a modern, intuitive GUI.

No programming required. No cloud dependency. Your data stays on your machine.

> **New in v0.4.0 — Native Tauri + React + C# overhaul.** The app is now a fully native desktop build (Tauri 2 / Rust shell, React + TypeScript UI, bundled C# 12 / .NET 8 engine sidecar) — no Python runtime required. All 8 pages reimplemented, screening import from PubMed/CSV/RIS/EndNote, in-app forest/funnel plots, GRADE, and 6-OS native installers. See [RELEASES.md](./RELEASES.md) for details.

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
| Platform | Architectures | Package |
|----------|---------------|---------|
| **Windows** | x64, x86, ARM64 | native `.msi` installer + `.exe` (NSIS) with WebView2 embedded |
| **macOS** | Intel (x64), Apple Silicon (ARM64) | `.dmg` (drag `poolr.app` to Applications) |
| **Linux** | x64 | native `.deb` (+ `.rpm`) |

---

## 🚀 Quick Start

### Download (Recommended)
1. Go to [Releases](https://github.com/harisawan-bit/poolr/releases/latest)
2. Download the native installer for your platform:
   - **Windows**: `poolr-windows-x64.msi` (or `x86` / `arm64`) — also ships `poolr-windows-x64.exe` (NSIS)
   - **macOS**: `poolr-macos-arm64.dmg` (Apple Silicon) or `poolr-macos-x64.dmg` (Intel) — drag `poolr.app` to Applications
   - **Linux**: `poolr-linux-x86_64.AppImage` (portable) or `poolr-linux-x86_64.deb` (Debian/Ubuntu)
3. No Python, no dependencies needed — the C# engine and WebView2 (Windows) are bundled.

### Releases
See [RELEASES.md](./RELEASES.md) for version history, migration notes, and download links.

### From Source (Developers)
```bash
# Requirements: Node 24, .NET 8 SDK, Rust (stable), Git
git clone https://github.com/harisawan-bit/poolr.git
cd poolr

# Install frontend deps
cd frontend
npm install
npm run dev        # launches the React UI in a browser (engine runs separately)

# In another terminal — run the C# engine sidecar (localhost:5180)
cd engine
dotnet run --project Poolr.Engine.Api

# Or run the full native shell (Tauri + bundled engine)
cd src-tauri
cargo tauri dev
```

> The Python package (`src/poolr`) is retained only as the numerical parity oracle for the C# engine; it is **not** part of the shipped product.

### Engine API (for Automation / CI)

The bundled C# engine exposes a local REST API (default `http://127.0.0.1:5180`). You can drive meta-analyses headlessly without the GUI:

```bash
# Health check
curl http://127.0.0.1:5180/health

# Run a meta-analysis (binary OR, random-effects, DerSimonian-Laird)
curl -X POST http://127.0.0.1:5180/api/meta \
  -H "Content-Type: application/json" \
  -d '{"model":"random","measure":"OR","method":"DL",
       "data":[{"study":"A","type":"binary","int_events":10,"int_n":50,"ctrl_events":5,"ctrl_n":50}]}'
```

> The Python package (`src/poolr`) is retained only as the numerical **parity oracle** for the C# engine; it is **not** part of the shipped product and has no `poolr-cli` entry point.

---

## 📁 Project Structure

```
poolr/
├── frontend/                  # React + TypeScript UI (Vite)
│   ├── src/
│   │   ├── pages/             # 8 SRMA pages (Dashboard, Protocol, Search, Screening,
│   │   │                      #   Extraction, Risk of Bias, Meta, PRISMA)
│   │   ├── lib/               # engine API bridge, screening-import parser, project store
│   │   └── components/        # shared UI (sidebar, header, status bar)
│   └── package.json
├── src-tauri/                # Tauri 2 (Rust) shell
│   ├── src/                  # Rust app + C# engine spawner (JobObject reaping)
│   ├── resources/engine/     # bundled self-contained C# sidecar (gitignored, built in CI)
│   ├── icons/                # app icons (png/ico/icns)
│   ├── tauri.conf.json        # bundle config: msi/nsis/dmg/deb/rpm + WebView2 embed
│   └── package.json           # @tauri-apps/cli (build script)
├── engine/                   # C# 12 / .NET 8 meta-analysis engine (sidecar)
│   ├── Poolr.Engine.Api/     # ASP.NET localhost HTTP API (:5180)
│   └── Poolr.Engine/         # Math.NET stats (OR/RR/MD/SMD/HR, I², GRADE, subgroups)
├── src/poolr/                # Python parity oracle only (NOT shipped) — see note below
├── tests/verification/       # parity tests: C# engine vs Python reference (CI)
├── .github/workflows/        # CI (lint/type/test) + Build Installers (6-OS matrix)
├── pyproject.toml            # parity-oracle packaging (not part of the product)
├── README.md · RELEASES.md · CHANGELOG.md · LICENSE
```

> **Note:** The product ships as a native Tauri + React + C# app. `src/poolr` (Python) and
> `pyproject.toml` exist **only** to validate the C# engine's numerics against an independent
> reference in CI. They are not installed or bundled into the released app.

---

## 🧪 Testing

```bash
# C# engine ↔ Python reference parity (CI: Python Engine Tests job)
pip install -e ".[dev]"
pytest tests/verification -q

# Frontend type-check + build
cd frontend && npm ci && npm run build

# Rust shell check
cd src-tauri && cargo check
```

> The old CustomTkinter GUI smoke test (`tests/gui_smoke_test.py`) is no longer applicable
> to the native shell and is excluded from CI.

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

MIT License — free for academic and commercial use. © M. Haris Awan. All rights reserved. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **PRISMA 2020** statement authors for reporting guidelines
- **Cochrane** for RoB 2 and GRADE methodology
- **NCBI** for PubMed/Entrez API access
- **Tauri 2** (Rust) for the native desktop shell
- **React** + **TypeScript** + **Vite** for the UI
- **.NET 8 / C# 12** (Math.NET Numerics, SkiaSharp) for the statistics engine
- **matplotlib**, **pandas**, **statsmodels**, **scipy** for the Python parity oracle

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/harisawan-bit/poolr/issues)
- **Discussions**: [GitHub Discussions](https://github.com/harisawan-bit/poolr/discussions)
- **Email**: m.harisawan@icloud.com

---

**Made with ❤️ for the evidence-based medicine community**

> *"Systematic reviews are the cornerstone of evidence-based practice. poolr makes them accessible to everyone."*