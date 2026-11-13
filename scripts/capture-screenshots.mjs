import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const screenshotsDir = path.join(repoRoot, 'docs', 'screenshots');
const baseUrl = process.env.POOLR_URL || 'http://127.0.0.1:5173';

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    'playwright-core',
  ].filter(Boolean);
  for (const mod of candidates) {
    try {
      const m = await import(mod);
      if (m.chromium) return m.chromium;
    } catch {
      /* try next */
    }
  }
  throw new Error('Playwright not found. Install playwright or set PLAYWRIGHT_MODULE.');
}

async function main() {
  const chromium = await loadPlaywright();
  console.log(`Capturing v0.6.6 screenshots headlessly from ${baseUrl}...`);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1440,900'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  await context.addInitScript(() => {
    localStorage.setItem('poolr.profile', JSON.stringify({ username: 'Dr Zheng', avatarId: 1 }));
    localStorage.setItem('poolr.theme', 'light');
  });

  const page = await context.newPage();

  const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
  const go = async (target, pause = 700) => {
    await page.evaluate((detail) => {
      window.dispatchEvent(new CustomEvent('poolr:gopage', { detail }));
    }, target);
    await waitMs(pause);
    await page.evaluate(() => {
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    });
    await waitMs(250);
  };
  const snap = async (filename) => {
    const cmdInput = page.getByPlaceholder(/Jump to a page/i);
    if (await cmdInput.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await waitMs(200);
    }
    const dest = path.join(screenshotsDir, filename);
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    if (/\bHaris\b/i.test(bodyText)) {
      console.warn(`WARNING: "${filename}" contains "Haris" text!`);
    }
    await page.screenshot({ path: dest });
    console.log(`Saved ${filename}`);
  };
  const clickQuick = async (locator) => locator.click({ timeout: 4000 }).catch(() => {});

  await page.goto(`${baseUrl}/?nosplash=1`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.includes('engine online'), { timeout: 15000 }).catch(() => {
    console.warn('Warning: engine online badge not detected before timeout.');
  });

  // Load demo-project into regular workspace (keeps Dr Zheng & 8-stage stepper visible)
  await page.evaluate(async () => {
    const res = await fetch('/demo-project.json');
    const demo = await res.json();
    localStorage.setItem(
      'poolr.studies',
      JSON.stringify({
        studies: [{ id: 'study_demo_bcg', name: demo.metadata?.title || 'BCG vaccine for tuberculosis (demo)', project: demo, lastModified: new Date().toISOString() }],
        activeStudyId: 'study_demo_bcg',
      })
    );
    window.dispatchEvent(new CustomEvent('poolr:loadProject', { detail: demo }));
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
  await page.evaluate(async () => {
    const res = await fetch('/demo-project.json');
    const demo = await res.json();
    window.dispatchEvent(new CustomEvent('poolr:loadProject', { detail: demo }));
  });
  await waitMs(800);

  // 1. Run live Meta-Analysis, TSA & Model Averaging first so downstream Dashboard / PRISMA / Manuscript have live outputs
  await go('meta', 600);
  await clickQuick(page.getByRole('button', { name: /^Run$/i }).first());
  await waitMs(1400);
  await clickQuick(page.getByRole('button', { name: /Run TSA/i }));
  await waitMs(800);
  await clickQuick(page.getByRole('button', { name: /Run Model Averaging/i }));
  await waitMs(1000);

  // Frame Forest Plot + Included Studies Characteristics & RoB Traffic Lights cleanly
  await page.evaluate(() => {
    const studio = Array.from(document.querySelectorAll('.card')).find((el) => el.textContent?.includes('Interactive Figure Studio'));
    studio?.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await waitMs(500);
  await snap('meta-forest.png');

  // 2. Interactive Funnel Plot (light-theme native interactive funnel + clicked study inspector)
  await clickQuick(page.getByRole('button', { name: /Funnel \(Std\)/i }));
  await waitMs(700);
  await page.evaluate(() => {
    const studio = Array.from(document.querySelectorAll('.card')).find((el) => el.textContent?.includes('Interactive Figure Studio'));
    if (studio) {
      const dot = Array.from(studio.querySelectorAll('svg circle')).find((c) => !c.closest('button'));
      if (dot) dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      studio.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });
  await waitMs(600);
  await snap('meta-funnel.png');

  // 3. Diagnostics (Galbraith Radial + Trial Sequential Analysis computed below it)
  await clickQuick(page.getByRole('button', { name: /Galbraith Radial/i }));
  await waitMs(1200);
  await page.evaluate(() => {
    const studio = Array.from(document.querySelectorAll('.card')).find((el) => el.textContent?.includes('Interactive Figure Studio'));
    studio?.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await waitMs(500);
  await snap('meta-diagnostics.png');

  // 4. PRISMA Sync Live Counts + Auto-GRADE -> Capture PRISMA 2020 Box Diagram
  await go('prisma', 700);
  await clickQuick(page.getByRole('button', { name: /Sync Live Counts/i }));
  await waitMs(600);
  await clickQuick(page.getByRole('button', { name: /Auto-GRADE/i }));
  await waitMs(900);
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  });
  await waitMs(300);
  await snap('prisma-flow.png');

  // 5. Dashboard (after PRISMA & Meta live counts synced)
  await go('dashboard', 700);
  await snap('dashboard.png');

  // 6. Protocol
  await go('protocol', 700);
  await snap('protocol.png');

  // 7. Citation & Search Library (click first citation so Dossier Inspector populates)
  await go('search:library', 700);
  await clickQuick(page.locator('table tbody tr').first());
  await waitMs(400);
  await snap('search-library.png');

  // 8. Screening (with dual reviewer chips)
  await go('screening', 700);
  await snap('screening.png');

  // 9. Screening Conflicts tab (match badge button "Conflicts 1" and scroll to Cohen's kappa + conflict cards)
  await clickQuick(page.getByRole('button', { name: /Conflicts/i }).first());
  await waitMs(700);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div, span')).find((d) => d.textContent?.includes("Cohen's Kappa"));
    el?.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await waitMs(400);
  await snap('screening-conflicts.png');

  // 10. Extraction (Study Manager + Source Viewer populated with study abstract)
  await go('extraction', 700);
  await clickQuick(page.getByRole('button', { name: /Load Abstract/i }));
  await waitMs(400);
  await snap('extraction.png');

  // 11. Risk of Bias (robvis chart + distribution)
  await go('rob', 700);
  await page.evaluate(() => {
    const viz = Array.from(document.querySelectorAll('.card')).find((el) => el.textContent?.includes('Risk of Bias Visualization'));
    viz?.scrollIntoView({ behavior: 'instant', block: 'end' });
  });
  await waitMs(600);
  await snap('rob-robvis.png');

  // 12. Specialized Methods & Bayesian Workbench inside Analysis Hub
  await go('meta', 600);
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  });
  await clickQuick(page.getByRole('button', { name: /Bayesian methods/i }));
  await waitMs(700);
  await clickQuick(page.getByRole('button', { name: /Run/i }).first());
  await waitMs(1200);
  await snap('specialized-hub.png');

  // 13. Manuscript Studio (Switch to Results / Split view with pooled metrics)
  await go('manuscript', 700);
  await clickQuick(page.getByRole('button', { name: /^Results$/i }));
  await waitMs(500);
  await snap('manuscript.png');

  // 14. Team Collaboration & Roles
  await go('collaboration', 700);
  await snap('collaboration.png');

  // 15. Universal Export Center Modal over Dashboard
  await go('dashboard', 500);
  await clickQuick(page.getByRole('button', { name: /Export/i }).first());
  await waitMs(600);
  await snap('export-center.png');
  // Close Export modal explicitly before Learn screenshot
  await clickQuick(page.locator('div.fixed .border-b button').first());
  await waitMs(400);
  if (await page.locator('text=Universal Export & Publishing Center').isVisible().catch(() => false)) {
    await page.locator('div.fixed button').first().click({ timeout: 2000 }).catch(() => {});
    await waitMs(300);
  }

  // 16. Learn / Guided Interactive Review
  await go('learn', 700);
  await snap('learn.png');

  await browser.close();
  console.log('Finished capturing all 16 v0.6.6 screenshots.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
