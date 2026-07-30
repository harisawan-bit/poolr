# Contributing to poolr

Thank you for your interest in contributing to poolr! This document outlines the process for contributing to the project.

## 🌿 Branch Strategy

We use a **Git Flow**-inspired workflow:

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production releases only | Protected, requires PR + reviews + CI pass |
| `develop` | Integration branch for next release | Protected, requires PR + CI pass |
| `feature/*` | New features | Short-lived, merge to `develop` |
| `bugfix/*` | Bug fixes | Short-lived, merge to `develop` |
| `hotfix/*` | Urgent production fixes | Short-lived, merge to `main` + `develop` |
| `release/*` | Release preparation | Short-lived, merge to `main` + `develop` |

### Branch Naming
- Features: `feature/short-description` (e.g., `feature/pubmed-import-dialog`)
- Bug fixes: `bugfix/issue-description` (e.g., `bugfix/forest-plot-export`)
- Hotfixes: `hotfix/critical-issue` (e.g., `hotfix/security-patch`)

## 🔄 Pull Request Process

### 1. Before Opening a PR
- [ ] Create a feature/bugfix branch from `develop`
- [ ] Write tests for new functionality
- [ ] Run the full test suite locally: `pytest`
- [ ] Run linters: `ruff check .` and `black --check .`
- [ ] Update documentation if needed

### 2. Opening a PR
- Target: `develop` branch (or `main` for hotfixes)
- Use the PR template
- Link related issues: `Fixes #123` or `Relates to #456`
- Request review from at least 1 maintainer

### 3. PR Requirements
- [ ] All CI checks pass (Windows, macOS, Linux)
- [ ] At least 1 approved review
- [ ] No merge conflicts
- [ ] Conventional commit messages in PR title
- [ ] CHANGELOG.md updated (for user-facing changes)

### 4. Merge Strategy
- **Squash and merge** for feature/bugfix branches
- **Merge commit** for release/hotfix branches
- Delete branch after merge

## 📝 Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `chore` | Maintenance, build, deps |
| `ci` | CI/CD changes |

### Examples
```
feat(screening): add conflict resolution UI for dual reviewers

fix(meta): correct I² calculation for single-study meta-analyses

docs(readme): add macOS ARM64 installation instructions

refactor(plotting): extract forest plot logic to separate module
```

---

## 🧪 Testing Standards

### Test Organization
```
tests/
├── unit/                    # Fast, isolated unit tests
│   ├── test_meta_analysis.py
│   ├── test_grade.py
│   ├── test_ris.py
│   └── test_pubmed.py
├── integration/             # Slower, multi-component tests
│   ├── test_cli.py
│   └── test_export.py
├── gui/                     # GUI tests (require display)
│   └── test_pages.py
└── fixtures/                # Test data
    ├── sample_studies.csv
    ├── sample.ris
    └── sample_pubmed.xml
```

### Requirements
- **Coverage**: Aim for >80% on core modules (`meta/`, `grade/`, `import_/`, `export/`)
- **Unit tests**: Must be fast (<100ms each), no network, no GUI
- **Integration tests**: Can use temp directories, sample data
- **GUI tests**: Mark with `@pytest.mark.gui`, run separately

### Running Tests
```bash
# All tests
pytest -v

# Unit only (fast)
pytest tests/unit -v

# With coverage
pytest --cov=poolr --cov-report=term-missing

# GUI tests (requires display)
pytest tests/gui -v -m gui
```

---

## 🎨 Code Style

### Python
- **Formatter**: `black` (line length 100)
- **Linter**: `ruff` (replaces flake8, isort, pydocstyle)
- **Type hints**: Required for all public functions
- **Docstrings**: NumPy style

```bash
# Auto-format
black src tests

# Check only
black --check src tests
ruff check src tests

# Fix auto-fixable
ruff check --fix src tests
```

### Pre-commit Hooks
Install once:
```bash
pip install pre-commit
pre-commit install
```

Runs on every commit:
- `black` formatting
- `ruff` linting
- `pyupgrade` syntax upgrades
- `detect-secrets` for credentials

---

## 📦 Adding Dependencies

### Runtime Dependencies
Add to `pyproject.toml` `[project.dependencies]`:
```toml
dependencies = [
    "new-package>=1.0,<2.0",
]
```

### Development Dependencies
Add to `[project.optional-dependencies.dev]`:
```toml
dev = [
    "pytest>=7.0",
    "pytest-cov>=4.0",
]
```

**Rules**:
- Pin minimum versions, allow patch/minor updates (`>=1.0,<2.0`)
- Prefer standard library over new dependencies
- Justify new dependencies in PR description
- Audit: `pip-audit` runs in CI

---

## 🏷️ Versioning & Releases

### Version Scheme
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

| Change | Version Bump |
|--------|--------------|
| Breaking API changes | MAJOR |
| New features (backward compatible) | MINOR |
| Bug fixes | PATCH |

### Release Process
1. Create `release/vX.Y.Z` branch from `develop`
2. Update version in `pyproject.toml` and `src/poolr/__init__.py`
3. Update `CHANGELOG.md`
4. PR to `main` with title `Release vX.Y.Z`
5. After merge, tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
6. GitHub Actions builds and publishes installers
7. Backport version bump to `develop`

---

## 🐛 Issue Reporting

### Bug Reports
Use the bug report template. Include:
- poolr version (`poolr --version` or Help → About)
- OS + version (Windows 10/11, macOS 13+, Ubuntu 22.04, etc.)
- Python version (if from source)
- Steps to reproduce (minimal)
- Expected vs actual behavior
- Screenshots/logs if applicable

### Feature Requests
Use the feature request template. Include:
- Problem statement (what pain point?)
- Proposed solution
- Alternatives considered
- Priority (Nice to have / Important / Critical)

---

## 🔒 Security

### Reporting Vulnerabilities
**Do not** open public issues for security vulnerabilities.
Email: security@poolr.example.com

### Dependency Scanning
- `pip-audit` runs on every PR
- `dependabot` alerts for vulnerable dependencies
- `bandit` static analysis in CI

---

## 📚 Documentation

### User Documentation
- `README.md` — Quick start, features
- `docs/user-guide/` — Step-by-step tutorials
- `docs/faq.md` — Common questions

### Developer Documentation
- `CONTRIBUTING.md` — This file
- `docs/architecture.md` — System design
- `docs/api.md` — Internal API reference
- Code docstrings (rendered by `pdoc`)

### Building Docs
```bash
cd docs
pip install -r requirements.txt
make html
# Output in docs/_build/html/
```

---

## 🏗️ Architecture Guidelines

### Module Responsibilities
| Module | Responsibility | Dependencies |
|--------|---------------|--------------|
| `pages/` | GUI only, no business logic | `meta`, `grade`, `export`, `import_` |
| `meta/analysis.py` | Statistical computations | `numpy`, `scipy`, `statsmodels` |
| `meta/grade.py` | GRADE logic | `meta.analysis` |
| `plotting/figures.py` | Matplotlib figure generation | `matplotlib`, `meta.analysis` |
| `export/reports.py` | Document generation | `python-docx`, `pylatex`, `meta.grade` |
| `import_/pubmed.py` | NCBI Entrez client | `biopython` |
| `import_/ris.py` | RIS format parser | None (stdlib) |

### Data Flow
```
User Input (GUI) → Project Data (poolr.json) → Meta-Analysis Engine → Results
                                                              ↓
                    Plots / Tables / GRADE / PRISMA ← Export Modules
```

### GUI Principles
- **No business logic in GUI** — pages only collect/display data
- **Async operations** — long tasks run in background threads
- **Auto-save** — `poolr.json` updated on every change
- **Validation** — input validation on save, not on keystroke

---

## 🚀 CI/CD Pipeline

### GitHub Actions Workflows
| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | PR, push to develop/main | lint, type-check, unit tests (Linux) |
| `ci-cross-platform.yml` | PR, push | unit tests (Windows, macOS, Linux) |
| `build.yml` | Tags (`v*`), release branch | Build installers (Win x64/x86/ARM64, macOS Universal, Linux AppImage) |
| `docs.yml` | Push to main | Build & deploy docs |
| `security.yml` | Schedule (daily) | pip-audit, dependabot, bandit |

### Local CI Simulation
```bash
# Run all CI checks locally
tox -p all

# Or manually:
ruff check src tests
black --check src tests
mypy src
pytest tests/unit -v
```

---

## 🏷️ Labels

| Label | Purpose |
|-------|---------|
| `bug` | Confirmed bug |
| `enhancement` | Feature request |
| `documentation` | Docs improvement |
| `good first issue` | Beginner-friendly |
| `help wanted` | Community contribution needed |
| `priority: high/medium/low` | Triage priority |
| `status: needs-triage/in-progress/blocked` | Workflow status |
| `area: gui/meta/export/import/plotting` | Component area |

---

## 🙋 Getting Help

- **GitHub Discussions**: Questions, ideas, general help
- **Discord**: Real-time chat (link in repo description)
- **Maintainer Office Hours**: Weekly, see Discussions

---

## 📜 Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold this code.

**Enforcement**: Report violations to conduct@poolr.example.com

---

*Thank you for contributing to poolr! Your work helps researchers worldwide conduct better systematic reviews.*