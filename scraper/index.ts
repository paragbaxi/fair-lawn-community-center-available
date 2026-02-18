import { chromium } from 'playwright';
import type { Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSchedule } from './parse.js';
import { validateSchedule } from './validate.js';
import type { ScheduleData } from '../src/lib/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');

const DRY_RUN = process.argv.includes('--dry-run');

// Fail loudly on typos (e.g. --dryrun) rather than silently running in live mode.
const knownFlags = ['--dry-run'];
const unknownFlags = process.argv.slice(2).filter(a => a.startsWith('-') && !knownFlags.includes(a));
if (unknownFlags.length > 0) {
  console.error(`Unknown flag(s): ${unknownFlags.join(', ')}. Supported flags: --dry-run`);
  process.exit(1);
}

const URLS = [
  'https://www.fairlawn.org/index.asp?SEC=AB4BD866-5BC6-4394-9CD8-C08771922C86&DE=39A74192-1BC3-4690-ADB6-9457340D7A21',
  'https://www.fairlawn.org/community-center',
  'https://www.fairlawn.org/park-rec',
];

function classifyError(err: unknown): { msg: string; errorType: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const errorType = /ENOTFOUND|ECONNREFUSED|ERR_NAME_NOT_RESOLVED/.test(msg)
    ? 'dns'
    : /timeout/i.test(msg)
      ? 'timeout'
      : 'unknown';
  return { msg, errorType };
}

async function gotoWithRetry(page: Page, url: string, retries = 1): Promise<void> {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      if (response !== null) {
        const status = response.status();
        if (status >= 500) {
          // 5xx is transient — throw so the retry loop engages
          throw new Error(`HTTP ${status} from ${url}`);
        } else if (status >= 400) {
          console.warn(`[scraper] error_type=http_4xx status=${status} url=${url} attempt=${attempt}/${retries + 1}`);
        }
      }
      return;
    } catch (err) {
      const { msg, errorType } = classifyError(err);
      if (attempt <= retries) {
        console.warn(`[scraper] error_type=${errorType} url=${url} attempt=${attempt}/${retries + 1} (retrying in 5s…)`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }
}

async function scrape(): Promise<void> {
  if (DRY_RUN) console.log('[dry-run] Mode active — pipeline will run but public/data/latest.json will NOT be written');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  let pageText = '';
  let pageHtml = '';

  for (const url of URLS) {
    try {
      const page = await context.newPage();
      console.log(`Navigating to ${url}...`);
      await gotoWithRetry(page, url);
      await page.waitForTimeout(2000);

      // Try to expand all accordion sections for full content
      try {
        const expandAll = page.locator('text=EXPAND ALL').first();
        await expandAll.click({ timeout: 3000 });
        await page.waitForTimeout(1000);
      } catch {
        // No expand button found, that's OK
      }

      const text = await page.innerText('body');
      const html = await page.content();

      if (text.length > pageText.length) {
        pageText = text;
        pageHtml = html;
      }

      await page.close();
    } catch (err) {
      const { msg, errorType } = classifyError(err);
      console.error(`[scraper] error_type=${errorType} url=${url} message=${msg}`);
    }
  }

  await browser.close();

  if (!pageText) {
    console.error('Could not retrieve any page content');
    process.exit(1);
  }

  // Dump content for debugging
  const debugDir = path.join(__dirname, '..', '.debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  fs.writeFileSync(path.join(debugDir, 'page.html'), pageHtml);
  fs.writeFileSync(path.join(debugDir, 'page.txt'), pageText);
  console.log(`Dumped page content to .debug/ (${pageText.length} chars)`);

  const { schedule, notices } = parseSchedule(pageText);

  const data: ScheduleData = {
    scrapedAt: new Date().toISOString(),
    schedule,
    notices,
  };

  const validation = validateSchedule(data);

  if (DRY_RUN) {
    const { daysWithActivities, totalActivities } = validation.stats;
    if (!validation.valid) {
      console.error('[dry-run] Validation FAILED:');
      for (const err of validation.errors) console.error(`  - ${err}`);
    } else {
      console.log('[dry-run] Validation PASSED');
    }
    console.log(`[dry-run] Days: ${Object.keys(data.schedule).length} parsed, ${daysWithActivities} with activities`);
    console.log(`[dry-run] Total activities: ${totalActivities}`);
    if (!validation.valid) process.exit(1);
    console.log('[dry-run] Skipping write to public/data/latest.json');
    return;
  }

  if (!validation.valid) {
    console.error('Schedule validation failed:');
    for (const err of validation.errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'latest.json'), JSON.stringify(data, null, 2));
  console.log('Wrote public/data/latest.json');
}

scrape().catch((err) => {
  console.error('Scraper failed:', err);
  process.exit(1);
});
