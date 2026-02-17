import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSchedule } from './parse.js';
import { validateSchedule } from './validate.js';
import type { ScheduleData } from '../src/lib/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');

const URLS = [
  'https://www.fairlawn.org/index.asp?SEC=AB4BD866-5BC6-4394-9CD8-C08771922C86&DE=39A74192-1BC3-4690-ADB6-9457340D7A21',
  'https://www.fairlawn.org/community-center',
  'https://www.fairlawn.org/park-rec',
];

async function scrape(): Promise<void> {
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
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
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
      console.error(`Failed to load ${url}:`, err);
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
  console.log(JSON.stringify(data, null, 2));
}

scrape().catch((err) => {
  console.error('Scraper failed:', err);
  process.exit(1);
});
