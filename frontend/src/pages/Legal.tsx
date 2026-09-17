import { useState } from "react";
import { Card, Button } from "../components/ui";
import { FileText, Shield, Scale, ArrowLeft } from "lucide-react";

type LegalPage = "menu" | "tos" | "privacy" | "eula";

const TOS_SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: `By accessing or using Poolr ("the Software"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, you may not access or use the Software. These Terms constitute a legally binding agreement between you and Muhammad Haris Awan ("Licensor", "we", "us", or "our").`,
  },
  {
    title: "2. Description of Service",
    body: `Poolr is a desktop application for conducting systematic reviews and meta-analyses (SRMA). It provides tools for protocol definition, literature search, screening, data extraction, statistical analysis, and manuscript generation. The Software is designed to operate entirely offline on the user's local machine.`,
  },
  {
    title: "3. License Grant",
    body: `Subject to your compliance with these Terms and a valid End User License Agreement (EULA), the Licensor grants you a limited, non-exclusive, non-transferable, revocable license to install and use the Software on a single computer for your personal or internal business research purposes. This license does not include the right to redistribute, sublicense, or make the Software available to third parties.`,
  },
  {
    title: "4. User Responsibilities",
    body: `You agree to: (a) use the Software only for lawful purposes and in accordance with these Terms; (b) maintain the security and confidentiality of any license keys or credentials issued to you; (c) not reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Software; (d) not remove, alter, or obscure any proprietary notices on the Software; (e) not use the Software to provide commercial hosting, service bureau, or time-sharing services to third parties.`,
  },
  {
    title: "5. Intellectual Property",
    body: `The Software, including all code, graphics, user interfaces, design, documentation, and associated intellectual property, is the exclusive property of the Licensor and is protected by copyright, trademark, and other intellectual property laws. Nothing in these Terms grants you any right, title, or interest in the Software except for the limited license expressly stated herein.`,
  },
  {
    title: "6. User Data",
    body: `You retain all rights to the data you input into the Software ("User Data"). The Software processes and stores User Data locally on your machine. The Licensor does not access, collect, or transmit your User Data. You are solely responsible for maintaining backups of your User Data.`,
  },
  {
    title: "7. Updates and Modifications",
    body: `The Licensor may, at its sole discretion, release updates, patches, or new versions of the Software. Continued use of the Software after any modification constitutes acceptance of the modified Terms. The Licensor reserves the right to modify, suspend, or discontinue the Software at any time without liability.`,
  },
  {
    title: "8. Disclaimer of Warranties",
    body: `THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THE LICENSOR DOES NOT WARRANT THAT THE SOFTWARE WILL BE ERROR-FREE, UNINTERRUPTED, OR FREE OF HARMFUL COMPONENTS. YOU ACKNOWLEDGE THAT RESEARCH SOFTWARE SHOULD NOT BE RELIED UPON AS THE SOLE BASIS FOR CLINICAL OR SCIENTIFIC DECISIONS.`,
  },
  {
    title: "9. Limitation of Liability",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE USE OF THE SOFTWARE, WHETHER IN CONTRACT, TORT, OR OTHERWISE.`,
  },
  {
    title: "10. Indemnification",
    body: `You agree to indemnify, defend, and hold harmless the Licensor from and against any claims, liabilities, damages, losses, and expenses arising out of or related to your use of the Software, your User Data, or your violation of these Terms.`,
  },
  {
    title: "11. Termination",
    body: `These Terms are effective until terminated. Your rights under these Terms will terminate automatically without notice if you fail to comply with any provision. Upon termination, you must cease all use of the Software and destroy all copies. Sections regarding intellectual property, disclaimer of warranties, limitation of liability, and governing law shall survive termination.`,
  },
  {
    title: "12. Governing Law",
    body: `These Terms shall be governed by and construed in accordance with the laws of Pakistan, without regard to conflict of law principles. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in Pakistan.`,
  },
  {
    title: "13. Contact Information",
    body: `For questions about these Terms, please contact: m.harisawan@icloud.com`,
  },
];

const PRIVACY_SECTIONS = [
  {
    title: "1. Introduction",
    body: `This Privacy Policy explains how Poolr ("we", "us", "our") handles information when you use our desktop application. Poolr is designed with privacy as a core principle — your research data never leaves your computer unless you explicitly choose to share it.`,
  },
  {
    title: "2. Information We Collect",
    body: `Poolr operates entirely offline and does NOT collect, transmit, or store any personal information on external servers. All project data, screening decisions, extraction records, and analysis results are stored locally on your machine in standard JSON files. Optional features that require internet access (such as PubMed search or AI provider APIs) send queries only to those external services — not to us.`,
  },
  {
    title: "3. Local Storage",
    body: `The Software stores the following locally on your device: (a) Project metadata (review title, PICO parameters, objectives); (b) Screening decisions and conflict records; (c) Data extraction records; (d) Risk of bias assessments; (e) Meta-analysis configurations and results; (f) Application settings and preferences; (g) AI provider API keys (if configured, stored in browser localStorage). None of this data is transmitted to the Licensor.`,
  },
  {
    title: "4. External Services",
    body: `When you use features that connect to external services, the following data may be transmitted: (a) NCBI Entrez E-utilities: search queries for literature retrieval; (b) OpenAlex / Crossref / ClinicalTrials.gov: bibliographic search queries; (c) Configured AI provider APIs: screening or analysis prompts for AI-assisted features. These transmissions are governed by the respective service providers' privacy policies. We recommend reviewing their policies before use.`,
  },
  {
    title: "5. Analytics and Telemetry",
    body: `Poolr does NOT include analytics, telemetry, crash reporting, or usage tracking. We do not monitor how you use the Software, how often you use it, or what features you access. No usage data is collected or transmitted.`,
  },
  {
    title: "6. Updates",
    body: `If the update feature is enabled, the Software may periodically check for available updates by connecting to GitHub's release infrastructure. No personal information is transmitted during update checks.`,
  },
  {
    title: "7. Data Security",
    body: `Since all data is stored locally, the security of your research data depends on the security of your computer. We recommend: (a) using full-disk encryption; (b) maintaining regular backups; (c) using strong passwords for your user account; (d) keeping your operating system and antivirus software up to date.`,
  },
  {
    title: "8. Data Retention and Deletion",
    body: `Your research data persists on your local machine until you delete it. To remove all data: delete your project files (poolr.json), clear the application's localStorage via your browser or the Settings panel, and uninstall the application.`,
  },
  {
    title: "9. Third-Party Libraries",
    body: `Poolr uses open-source libraries (React, Tauri, Vite, lucide-react, and others). These libraries operate within the application and do not independently transmit data.`,
  },
  {
    title: "10. Children's Privacy",
    body: `The Software is not directed to children under 13. We do not knowingly collect personal information from children.`,
  },
  {
    title: "11. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. Any changes will be posted within the Software and on our repository. Continued use of the Software after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "12. Contact",
    body: `For privacy-related inquiries, please contact: m.harisawan@icloud.com`,
  },
];

const EULA_SECTIONS = [
  {
    title: "1. Grant of License",
    body: `Subject to the terms of this End User License Agreement ("EULA"), Muhammad Haris Awan ("Licensor") grants you a limited, non-exclusive, non-transferable license to install and use Poolr ("the Software") on a single computer or device that you own or control. This EULA does not grant you any rights to the Software's source code, trade secrets, or intellectual property beyond the right to use the Software as permitted herein.`,
  },
  {
    title: "2. Permitted Uses",
    body: `You may use the Software for: (a) personal academic research; (b) commercial research and consulting; (c) educational instruction and training; (d) publication of research results generated using the Software. You may create unlimited projects and analyses using the Software.`,
  },
  {
    title: "3. Prohibited Uses",
    body: `You shall NOT: (a) redistribute, sublicense, lease, rent, or loan the Software to third parties; (b) reverse engineer, decompile, disassemble, or otherwise attempt to discover the source code; (c) modify, translate, or create derivative works based on the Software; (d) circumvent or disable any license key, activation mechanism, or copy protection; (e) use the Software to provide commercial hosting, application service provider, or time-sharing services; (f) remove or alter any proprietary notices or labels; (g) use the Software for any illegal purpose.`,
  },
  {
    title: "4. Intellectual Property Ownership",
    body: `The Software and all copies thereof are the exclusive property of the Licensor. This EULA does not convey to you any ownership interest in the Software, but only a limited right of use revocable in accordance with this EULA. All title, copyrights, and other intellectual property rights in the Software are owned by the Licensor.`,
  },
  {
    title: "5. User Data Ownership",
    body: `You retain all rights, title, and interest in your research data ("User Data") input into the Software. The Licensor claims no ownership over User Data. You are solely responsible for the accuracy, quality, and legality of User Data.`,
  },
  {
    title: "6. Citation Requirement",
    body: `If you publish research results obtained using Poolr, you are requested (but not legally required) to cite the Software. Suggested citation: Awan, M. H. (2026). Poolr: Desktop platform for systematic reviews & meta-analyses (Version 0.6.0). https://github.com/harisawan-bit/poolr`,
  },
  {
    title: "7. No Warranty",
    body: `THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSOR DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. THE LICENSOR DOES NOT WARRANT THAT THE SOFTWARE WILL MEET YOUR REQUIREMENTS OR THAT OPERATION WILL BE UNINTERRUPTED OR ERROR-FREE.`,
  },
  {
    title: "8. Limitation of Liability",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSOR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES WHATSOEVER RESULTING FROM THE USE OF OR INABILITY TO USE THE SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN NO EVENT SHALL THE LICENSOR'S TOTAL LIABILITY EXCEED THE AMOUNT PAID BY YOU FOR THE SOFTWARE (IF ANY).`,
  },
  {
    title: "9. Research Use Disclaimer",
    body: `THE SOFTWARE IS A RESEARCH TOOL AND IS NOT A SUBSTITUTE FOR PROFESSIONAL CLINICAL, SCIENTIFIC, OR STATISTICAL JUDGMENT. USERS ARE SOLELY RESPONSIBLE FOR VERIFYING ALL OUTPUTS BEFORE PUBLICATION OR CLINICAL APPLICATION.`,
  },
  {
    title: "10. Termination",
    body: `This EULA is effective until terminated. Your rights under this EULA will terminate automatically without notice if you fail to comply with any term. Upon termination, you must cease all use of the Software and destroy all copies in your possession. Sections regarding intellectual property, disclaimer of warranties, limitation of liability, and governing law shall survive termination.`,
  },
  {
    title: "11. Governing Law and Dispute Resolution",
    body: `This EULA shall be governed by the laws of Pakistan. Any disputes arising from this EULA shall be resolved through binding arbitration in Pakistan in accordance with applicable arbitration rules.`,
  },
  {
    title: "12. Severability",
    body: `If any provision of this EULA is held to be unenforceable, the remaining provisions shall remain in full force and effect.`,
  },
  {
    title: "13. Entire Agreement",
    body: `This EULA constitutes the entire agreement between you and the Licensor regarding the Software and supersedes all prior agreements and understandings.`,
  },
  {
    title: "14. Contact",
    body: `For licensing inquiries: m.harisawan@icloud.com`,
  },
];

export default function LegalCenter() {
  const [page, setPage] = useState<LegalPage>("menu");

  const sections = page === "tos" ? TOS_SECTIONS : page === "privacy" ? PRIVACY_SECTIONS : page === "eula" ? EULA_SECTIONS : [];

  return (
    <div className="space-y-3">
      {page !== "menu" && (
        <Button variant="ghost" size="sm" onClick={() => setPage("menu")}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Legal Center
        </Button>
      )}

      {page === "menu" && (
        <>
          <Card title="Legal Center">
            <p className="mb-4 text-[12.5px] text-[var(--color-text-muted)]">
              Poolr v0.6.0 — Phase 2 Commercial Platform. Please review our legal documents.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              className="card p-5 text-left transition-colors hover:bg-[var(--hover-surface)]"
              onClick={() => setPage("tos")}
            >
              <Scale className="mb-2 h-6 w-6 text-[var(--color-accent)]" />
              <h3 className="mb-1 text-[14px] font-semibold">Terms of Service</h3>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Rules and conditions for using Poolr. Covers license grant, user responsibilities, intellectual property, and liability.
              </p>
            </button>

            <button
              className="card p-5 text-left transition-colors hover:bg-[var(--hover-surface)]"
              onClick={() => setPage("privacy")}
            >
              <Shield className="mb-2 h-6 w-6 text-[var(--color-accent)]" />
              <h3 className="mb-1 text-[14px] font-semibold">Privacy Policy</h3>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                How Poolr handles your data. Spoiler: all data stays on your device. No tracking, no telemetry, no cloud uploads.
              </p>
            </button>

            <button
              className="card p-5 text-left transition-colors hover:bg-[var(--hover-surface)]"
              onClick={() => setPage("eula")}
            >
              <FileText className="mb-2 h-6 w-6 text-[var(--color-accent)]" />
              <h3 className="mb-1 text-[14px] font-semibold">End User License Agreement</h3>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                The full legal agreement between you and the Licensor. Includes permitted uses, restrictions, warranties, and termination.
              </p>
            </button>
          </div>

          <Card title="License Notice">
            <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              Poolr is proprietary software. © 2026 Muhammad Haris Awan. All rights reserved.
              Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.
              This software is provided under a proprietary license — see the EULA for complete terms.
            </p>
          </Card>
        </>
      )}

      {page !== "menu" && (
        <Card title={page === "tos" ? "Terms of Service" : page === "privacy" ? "Privacy Policy" : "End User License Agreement"}>
          <p className="mb-4 text-[11px] text-[var(--color-text-muted)]">
            Effective Date: September 17, 2026 · Last Updated: September 17, 2026
          </p>
          <div className="max-h-[calc(100vh-280px)] space-y-5 overflow-y-auto pr-2">
            {sections.map((section, i) => (
              <div key={i}>
                <h3 className="mb-2 text-[13px] font-semibold text-[var(--color-text)]">{section.title}</h3>
                <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">{section.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
            <p className="text-[10.5px] text-[var(--color-text-muted)]">
              © 2026 Muhammad Haris Awan. All rights reserved.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setPage("menu")}>
              Back to Legal Center
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
