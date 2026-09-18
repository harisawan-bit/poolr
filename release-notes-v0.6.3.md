## Poolr v0.6.3 — Commercial Platform & Team Collaboration Release

Poolr v0.6.3 delivers a comprehensive commercial overhaul of Google Identity, Bring-Your-Own-Storage (BYOS) Google Drive cloud synchronization, enterprise Role-Based Access Control (RBAC), concurrent editing protections, and audit-grade research governance.

---

### 1. Google OAuth & Identity Resolution
- **Prominent Google Sign-in**: Placed directly in the application header, first-run onboarding screen, and user profile dropdown.
- **Real Token Validation**: Replaced brittle JWT client-side decoding with live Bearer verification against `https://www.googleapis.com/oauth2/v3/userinfo` to reliably retrieve user profiles and Google avatars.
- **Dynamic Configuration**: Users and institutions can configure their own Google Client ID in **Settings → Cloud & Accounts**.

### 2. Structured Google Drive BYOS Engine
- **Clean Workspace Organization**: Reviews are stored under `My Drive/Poolr Workspace/Projects/{Title}_{UUID}/` to prevent cluttering users' personal drives.
- **Multipart MIME Uploads**: Implemented RFC 2387 multipart uploads for creating (`POST`) and updating (`PATCH`) files, preventing data loss and payload truncation.
- **Dedicated Subfiles**: Automatically organizes and synchronizes:
  - `changelog.json`: PRISMA 2020 revision delta history
  - `permissions.json`: Role-Based Access Control matrix
  - `comments.json`: Cross-phase reviewer discussion threads
  - `authorship.json`: ICMJE & CRediT active-time tracking ledger
  - `manuscript.json`: Collaborative manuscript workspace state
- **Team Permissions & Discovery**: Integrates with Google Drive Permissions API (`POST /files/{id}/permissions`) for sharing with colleagues (`writer`, `commenter`, `reader`) and discovering team reviews (`sharedWithMe`).

### 3. Role-Based Access Control (RBAC)
- **Four Distinct Roles**:
  - **Owner**: Full project governance, team invitations, permissions management, and Google Drive sharing.
  - **Lead Methodologist / Editor**: PICO definition, data extraction, synthesis adjustments, and manuscript authorship.
  - **Reviewer**: Title/abstract screening, full-text screening, and risk of bias assessments.
  - **Auditor / Viewer**: Read-only oversight for external auditors, journal reviewers, and students.
- Enforced across all primary synthesis actions and export workflows.

### 4. Concurrent Edit Protection & Conflict Resolution
- **Section Soft Locks**: Informs collaborators when a section (e.g. Data Extraction, RoB, Meta-Analysis) is being actively edited.
- **Append-Only Delta Logging**: Every modification is recorded as a structured `ChangeDelta` containing timestamp, author, section, field, and diff description for Cochrane/PRISMA compliance.
- **3-Way Visual Conflict Resolver**: Automatically detects conflicting concurrent updates and displays an interactive modal (`[Keep Mine]`, `[Accept Teammate's]`, or `[Custom Merge]`).

### 5. Reviewer Discussions & Universal Commenting
- **Inline Step Drawers**: Embedded `StepCommentsButton` in the headers of Protocol, Screening, Extraction, Risk of Bias, Meta-Analysis, and Manuscript.
- Allows co-reviewers to discuss inclusion ambiguities, discrepancy resolutions, and extraction questions with threaded replies and resolution states.

### 6. ICMJE & CRediT Authorship Tracking
- Automatic background heartbeat monitors active time per contributor by review section.
- Generates publication-ready authorship reports adhering to International Committee of Medical Journal Editors (ICMJE) and Contributor Roles Taxonomy (CRediT) guidelines, with 1-click Markdown export.

### 7. Collaborative Manuscript Studio
- Transformed `ManuscriptHelper` into a live authoring studio featuring Markdown editor, formatting toolbar, data/citation insertion from review phases, section contributor assignment, word count, and reading time metrics.
- Export options include Markdown (.md), Microsoft Word (.doc), and browser print / PDF.

### 8. Windows WebView2 Transparent Window Bugfix
- Resolved transparent window / white screen issue on Windows WebView2 startup by setting `"transparent": false` in `tauri.conf.json` and adding solid dark/light fallback background colors to `html`, `body`, and `#root`.

### 9. Proprietary License & Legal Shield
- Updated closed-source proprietary license and legal documents for **Muhammad Haris Awan (d/b/a The Method Lab)**.
- Includes corporate successor assignment clauses, unilateral rights to introduce paid subscription plans and paywalls without grandfathering, Bring-Your-Own-Storage disclaimers, and scientific/medical evidence synthesis disclaimers.

---

### Installers & Distribution
- **Windows**: MSI (x64, x86, ARM64) + NSIS (.exe) installer
- **macOS**: DMG (Apple Silicon & Intel)
- **Linux**: DEB & RPM packages
- All native engines bundled self-contained with zero runtime dependencies.
