import type { TabId } from './types.js';
import { VALID_TABS } from './types.js';
import { DISPLAY_DAYS } from './time.js';
import { findSportById } from './filters.js';

export interface AppUrlState {
  tab: TabId;
  day: string | null;
  sport: string | null;
}

export function parseUrlState(): AppUrlState {
  const raw = location.hash.slice(1); // e.g. "sports?sport=basketball"
  const qIdx = raw.indexOf('?');
  const tabRaw = (qIdx === -1 ? raw : raw.slice(0, qIdx)).toLowerCase();
  const queryStr = qIdx === -1 ? '' : raw.slice(qIdx + 1);

  const tab: TabId = VALID_TABS.includes(tabRaw as TabId) ? (tabRaw as TabId) : 'status';

  const params = new URLSearchParams(queryStr);

  // Day: normalize to title-case, validate against DISPLAY_DAYS
  const dayRaw = params.get('day') ?? '';
  const day = dayRaw
    ? (DISPLAY_DAYS.find(d => d.full.toLowerCase() === dayRaw.toLowerCase())?.full ?? null)
    : null;

  // Sport: validate against SPORT_CATEGORIES ids
  const sportRaw = (params.get('sport') ?? '').toLowerCase();
  const sport = sportRaw ? (findSportById(sportRaw) ? sportRaw : null) : null;

  return { tab, day, sport };
}

export function buildUrlHash(
  tab: TabId,
  day: string | null,
  sport: string | null,
): string {
  const params = new URLSearchParams();
  if (tab === 'today' && day) params.set('day', day);
  if (tab === 'sports' && sport) params.set('sport', sport);
  const qs = params.toString();
  return qs ? `#${tab}?${qs}` : `#${tab}`;
}
