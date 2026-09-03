# Security Policy

The Poolr team takes security seriously. Because Poolr is used in clinical research, medical synthesis, and academic evidence aggregation, safeguarding users, local data privacy, and mathematical integrity is paramount.

## Supported Versions

Only the latest release receives security patches and updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.5.x   | :white_check_mark: |
| < 0.5.0 | :x:                |

## Data Privacy & Architecture Guarantee

- **100% Offline-First**: Your systematic review files (`poolr.json`), search queries, extracted data, risk of bias judgments, and patient cohorts remain on your local computer. Poolr never uploads project data to any remote cloud servers.
- **No Python Execution**: Poolr does not embed or invoke Python scripts, avoiding Python dependency supply-chain risks. The statistics engine is a bundled, strongly typed C# 12 / .NET 8 binary that communicates strictly over a local-only loopback port (`127.0.0.1:5180`).
- **Telemetry**: Poolr contains zero invasive tracking or advertising SDKs.

## Reporting a Vulnerability

If you discover a security vulnerability or sensitive data exposure issue, please **do not open a public GitHub issue**.

Instead, please report it directly through one of the following channels:
1. **GitHub Security Advisories**: Use the "Report a vulnerability" button on our [Advisories page](https://github.com/harisawan-bit/poolr/security/advisories).
2. **Direct Email**: Send encrypted or plain details to **m.harisawan@icloud.com** with the subject `[SECURITY] Poolr Vulnerability Report`.

Please include:
- A description of the vulnerability and its potential impact.
- Step-by-step instructions or proof-of-concept to reproduce the behavior.
- Operating system and Poolr release version.

### Response Timeline
- **Initial acknowledgment**: Within 24-48 hours.
- **Triage & validation**: Within 5 business days.
- **Fix & public disclosure**: Coordinated release within 30 days of validation.
