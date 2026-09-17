## What's Fixed

### 6 Stress-Test Crashes Resolved (HTTP 500 → 400)
- **DiagnosticFigures**: Null guards for PlotInput Effs/Vars/Names in Galbraith() and Baujat() methods
- **ClusterDetectionEngine**: Validation that variances count matches effects count
- **LeagueMatrixEngine**: Null/empty matrix validation
- **MultilevelNmaEngine**: Minimum study count guard (>= 2 treatments AND >= 2 valid studies) before matrix operations
- **MultiArmNmaEngine**: Minimum edge count guard before matrix operations

### Auto-Updater (New)
- Rust: tauri-plugin-updater v2 registered in lib.rs with UpdaterState for rate-limiting
- Frontend: useUpdater() hook with daily check, UpdateModal for user confirmation
- App.tsx: Animated update banner with one-click update trigger
- Settings: Updates tab with auto-update toggle and manual check button

### Maintenance
- Version sync: Poolr.Engine.Api.csproj 0.5.7 → 0.6.1 (matches actual app version)
- Eliminated all 33 CS8629 Nullable value type may be null warnings
- 214 unit tests pass, build clean

## Installers
- Windows: MSI (x64, x86, ARM64) + NSIS (x64, x86, ARM64)
- macOS: DMG (Apple Silicon, Intel)
- Linux: DEB (Ubuntu/Debian/Mint), RPM (Fedora/RHEL/openSUSE)

**Full Changelog**: https://github.com/harisawan-bit/poolr/compare/v0.6.0...v0.6.1
