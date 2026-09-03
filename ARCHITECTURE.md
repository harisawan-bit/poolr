# Poolr System Architecture

This document describes the design principles, process topology, and multi-tier technology stack that powers **Poolr**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri 2 Native Desktop Shell                    │
│                 (Rust / Windows WebView2, WebKitGTK, WKWebView)        │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼                                       ▼
┌─────────────────────────────────┐   HTTP REST   ┌──────────────────────────────┐
│       Frontend User Interface   │ ────────────> │     C# 12 / .NET 8 Engine    │
│  React 19 · TypeScript · Vite   │ <──────────── │  ASP.NET Core (127.0.0.1:5180│
│  Tailwind CSS · Bklit UI Charts │ (JSON/Vector) │  Math.NET · SkiaSharp SVG    │
└─────────────────────────────────┘               └──────────────────────────────┘
                 │                                               │
                 ▼                                               ▼
     ┌────────────────────────┐                    ┌────────────────────────────┐
     │  Local File Storage    │                    │ Process Lifecycle Sentinel │
     │  Project `poolr.json`   │                    │ Win32 JobObject / POSIX    │
     │  Autosave & LocalStore │                    │ Auto-reaping on App Close  │
     └────────────────────────┘                    └────────────────────────────┘
```

---

## Architectural Principles

1. **100% Python-Free & Standalone**:
   Unlike legacy academic synthesis tools that require external Python installations, R dependencies, or fragile virtual environments, Poolr is 100% self-contained. The stats engine is a compiled, ahead-of-time (AOT) / self-contained .NET 8 binary bundled directly with the application.
2. **Offline-First & Local Privacy**:
   Health data and unpublished synthesis datasets must not leak to third-party clouds. All computations, project state saves, and exports occur locally on the researcher's workstation.
3. **Mathematical Parity**:
   All statistical engines are calibrated and tested against published, gold-standard R packages (`metafor`, `robvis`, `netmeta`) through automated xUnit regression suites in CI.
4. **Dual-Tier Inter-Process Communication (IPC)**:
   The UI communicates with the backend engine via a localhost HTTP REST API (`127.0.0.1:5180`). This decoupled design allows the C# engine to run both headlessly in automated pipelines and as a desktop sidecar.

---

## Process Topology & Lifecycle

- **Shell Tier (`src-tauri/`)**:
  Built on **Tauri 2 (Rust)**. It manages window creation, system menus, file dialogs, and spawns the C# engine sidecar at application boot.
  - **Windows Process Management**: Uses Win32 `CreateJobObject` with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. When the Poolr window terminates or crashes, the Windows kernel automatically guarantees the sidecar process is terminated cleanly, preventing zombie processes.
  - **Windowless Execution**: The engine sidecar is executed with `CREATE_NO_WINDOW` and redirected null stdio, ensuring zero console window flashes during application startup.
- **Engine Tier (`engine/Poolr.Engine.Api/`)**:
  A lightweight ASP.NET Core minimal API running on .NET 8.
  - **Numerics**: Powered by **Math.NET Numerics** for numerical integration, matrix decomposition, probability distributions, and optimization.
  - **Figure Rendering**: Powered by **SkiaSharp** to output publication-grade vector graphics (SVG) for Cochrane robvis traffic light and summary bar plots, contour-enhanced funnels, Galbraith radial plots, L'Abbé plots, and Baujat diagnostic plots.
- **Frontend Tier (`frontend/`)**:
  Built with **React 19**, **TypeScript**, and **Vite**.
  - **Design System**: Monochrome, high-contrast accessible tokens with live light and dark mode toggling.
  - **Visualization**: Specialized data visualization components using SVG, Visx, and Framer Motion.
  - **State Model**: Reactive, single-source-of-truth project state matching the PRISMA 2020 schema, auto-persisting to `poolr.json` with debounced saves.

---

## Directory Structure

```
poolr/
├── frontend/                  # React 19 + TypeScript + Vite UI
│   ├── src/
│   │   ├── pages/             # 8 Core PRISMA stages + specialized analysis pages
│   │   ├── components/        # Modals, drawers, UI primitives, conflict dashboard
│   │   ├── components/charts/ # Bklit UI interactive vector charts
│   │   ├── lib/               # Engine REST API bridge, project store, NCBI search
│   │   └── __tests__/         # Vitest unit test suite
│   └── package.json
├── src-tauri/                 # Tauri 2 (Rust) desktop shell
│   ├── src/                   # Rust application entry, sidecar supervisor
│   ├── tauri.conf.json        # Bundle configuration (MSI, NSIS, DMG, DEB, RPM)
│   └── Cargo.toml
├── engine/                    # C# 12 / .NET 8 High-Performance Statistics Engine
│   ├── Poolr.Engine.Api/      # ASP.NET Core HTTP REST service (:5180)
│   │   ├── MetaEngine.cs      # Classical pairwise meta-analysis (DL, REML, PM, HS)
│   │   ├── AdvancedEngine.cs  # Trial sequential analysis, model averaging, DCA
│   │   ├── SpecializedEngine.cs # Dose-response, survival RMST, health economics
│   │   ├── FigureEngine.cs    # SkiaSharp vector SVG generator (robvis, Galbraith, Baujat)
│   │   ├── GradeEngine.cs     # Summary of Findings (SoF) & OIS imprecision scoring
│   │   └── Program.cs         # API route registration and CORS binding
│   └── Poolr.Engine.Tests/    # xUnit gold-standard mathematical benchmarks
├── docs/                      # Screenshots and documentation assets
└── .github/                   # CI matrix, issue templates, dependabot, workflows
```
