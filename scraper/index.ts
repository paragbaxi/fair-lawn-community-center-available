import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');

const URLS = [
  'https://www.fairlawn.org/index.asp?SEC=AB4BD866-5BC6-4394-9CD8-C08771922C86&DE=39A74192-1BC3-4690-ADB6-9457340D7A21',
  'https://www.fairlawn.org/community-center',
  'https://www.fairlawn.org/park-rec',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Activity {
  name: string;
  start: string;
  end: string;
  isOpenGym: boolean;
}

interface DaySchedule {
  open: string;
  close: string;
  activities: Activity[];
}

interface ScheduleData {
  scrapedAt: string;
  schedule: Record<string, DaySchedule>;
  notices: string[];
}

function isOpenGymActivity(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('open gym') || lower.includes('open play') || lower.includes('free play');
}

// Parse time strings like "9:00 AM", "12:00 PM", "7:00 a.m."
function normalizeTime(raw: string): string {
  let t = raw.trim()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();

  // Ensure format is "H:MM AM/PM"
  const match = t.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/);
  if (match) {
    const h = match[1];
    const m = match[2] || '00';
    const p = match[3];
    return `${h}:${m} ${p}`;
  }
  return t;
}

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

  // Dump HTML for debugging / selector discovery
  const debugDir = path.join(__dirname, '..', '.debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  fs.writeFileSync(path.join(debugDir, 'page.html'), pageHtml);
  fs.writeFileSync(path.join(debugDir, 'page.txt'), pageText);
  console.log(`Dumped page content to .debug/ (${pageText.length} chars)`);

  // Extract schedule from text content
  const schedule = parseScheduleFromText(pageText);

  const data: ScheduleData = {
    scrapedAt: new Date().toISOString(),
    schedule,
    notices: extractNotices(pageText),
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'latest.json'), JSON.stringify(data, null, 2));
  console.log('Wrote public/data/latest.json');
  console.log(JSON.stringify(data, null, 2));
}

function parseScheduleFromText(text: string): Record<string, DaySchedule> {
  const schedule: Record<string, DaySchedule> = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Default hours by day
  const defaultHours: Record<string, { open: string; close: string }> = {
    Monday: { open: '7:00 AM', close: '9:00 PM' },
    Tuesday: { open: '7:00 AM', close: '9:00 PM' },
    Wednesday: { open: '7:00 AM', close: '9:00 PM' },
    Thursday: { open: '7:00 AM', close: '9:00 PM' },
    Friday: { open: '7:00 AM', close: '9:00 PM' },
    Saturday: { open: '9:00 AM', close: '9:00 PM' },
    Sunday: { open: '9:00 AM', close: '9:00 PM' },
  };

  // Strategy: look for day names followed by time ranges and activity names
  // Common patterns:
  //   "Monday: 9:00 AM - 12:00 PM Pickleball"
  //   "Monday"  (as a header, followed by activities on subsequent lines)
  //   "9:00 AM - 12:00 PM  Pickleball"

  let currentDay: string | null = null;
  const timeRangePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.))\s*[-–to]+\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.))/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line starts with a day name
    for (const day of DAYS) {
      if (line.match(new RegExp(`^${day}\\b`, 'i'))) {
        currentDay = day;
        if (!schedule[day]) {
          schedule[day] = {
            open: defaultHours[day].open,
            close: defaultHours[day].close,
            activities: [],
          };
        }

        // Check if there's a time range on the same line
        const timeMatch = line.match(timeRangePattern);
        if (timeMatch) {
          const activityName = line
            .replace(new RegExp(`^${day}:?\\s*`, 'i'), '')
            .replace(timeRangePattern, '')
            .trim()
            .replace(/^[-–:]\s*/, '');

          if (activityName) {
            schedule[day].activities.push({
              name: activityName,
              start: normalizeTime(timeMatch[1]),
              end: normalizeTime(timeMatch[2]),
              isOpenGym: isOpenGymActivity(activityName),
            });
          }
        }
        break;
      }
    }

    // Check for time range patterns (activities under a day header)
    if (currentDay && !DAYS.some(d => line.match(new RegExp(`^${d}\\b`, 'i')))) {
      const timeMatch = line.match(timeRangePattern);
      if (timeMatch) {
        const activityName = line
          .replace(timeRangePattern, '')
          .trim()
          .replace(/^[-–:]\s*/, '')
          .replace(/[-–:]\s*$/, '');

        if (activityName && schedule[currentDay]) {
          schedule[currentDay].activities.push({
            name: activityName,
            start: normalizeTime(timeMatch[1]),
            end: normalizeTime(timeMatch[2]),
            isOpenGym: isOpenGymActivity(activityName),
          });
        }
      }
    }
  }

  return schedule;
}

function extractNotices(text: string): string[] {
  const notices: string[] = [];
  const lower = text.toLowerCase();

  const keywords = ['closed', 'closure', 'cancelled', 'canceled', 'holiday', 'notice', 'important'];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    if (keywords.some(k => lineLower.includes(k)) && line.length < 200) {
      notices.push(line);
    }
  }

  return notices;
}

scrape().catch((err) => {
  console.error('Scraper failed:', err);
  process.exit(1);
});
