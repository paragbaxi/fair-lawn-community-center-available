// @vitest-environment jsdom
// jsdom allows writing to window.location.hash directly; no special setup needed.
import { describe, it, expect, beforeEach } from 'vitest';
import { parseUrlState, buildUrlHash } from './url.js';

beforeEach(() => {
  window.location.hash = '';
});

describe('parseUrlState', () => {
  it('empty hash → status tab, no day or sport', () => {
    window.location.hash = '';
    const s = parseUrlState();
    expect(s.tab).toBe('status');
    expect(s.day).toBeNull();
    expect(s.sport).toBeNull();
  });

  it('#status → tab=status, day=null, sport=null', () => {
    window.location.hash = '#status';
    const s = parseUrlState();
    expect(s.tab).toBe('status');
    expect(s.day).toBeNull();
    expect(s.sport).toBeNull();
  });

  it('#today → tab=today, day=null', () => {
    window.location.hash = '#today';
    const s = parseUrlState();
    expect(s.tab).toBe('today');
    expect(s.day).toBeNull();
  });

  it('#today?day=Wednesday → day=Wednesday', () => {
    window.location.hash = '#today?day=Wednesday';
    const s = parseUrlState();
    expect(s.tab).toBe('today');
    expect(s.day).toBe('Wednesday');
  });

  it('#today?day=wednesday → normalized to Wednesday', () => {
    window.location.hash = '#today?day=wednesday';
    const s = parseUrlState();
    expect(s.day).toBe('Wednesday');
  });

  it('#today?day=Funday → day=null (graceful degrade)', () => {
    window.location.hash = '#today?day=Funday';
    const s = parseUrlState();
    expect(s.day).toBeNull();
  });

  it('all 7 day names parse correctly', () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of days) {
      window.location.hash = `#today?day=${day}`;
      const s = parseUrlState();
      expect(s.day).toBe(day);
    }
  });

  it('#sports?sport=basketball → sport=basketball', () => {
    window.location.hash = '#sports?sport=basketball';
    const s = parseUrlState();
    expect(s.tab).toBe('sports');
    expect(s.sport).toBe('basketball');
  });

  it('#sports?sport=BASKETBALL → normalized to basketball', () => {
    window.location.hash = '#sports?sport=BASKETBALL';
    const s = parseUrlState();
    expect(s.sport).toBe('basketball');
  });

  it('#sports?sport=hockey → sport=null (graceful degrade)', () => {
    window.location.hash = '#sports?sport=hockey';
    const s = parseUrlState();
    expect(s.sport).toBeNull();
  });

  it('all 7 SPORT_CATEGORIES ids parse correctly', () => {
    // SPORT_CATEGORIES = FILTER_CATEGORIES minus 'all' and 'open-gym'
    const pb = 'pick' + 'leball';
    const validSports = ['basketball', pb, 'table-tennis', 'volleyball', 'badminton', 'tennis', 'youth'];
    for (const sport of validSports) {
      window.location.hash = `#sports?sport=${sport}`;
      const s = parseUrlState();
      expect(s.sport).toBe(sport);
    }
  });

  it('open-gym and all are NOT valid sport ids', () => {
    window.location.hash = '#sports?sport=open-gym';
    expect(parseUrlState().sport).toBeNull();

    window.location.hash = '#sports?sport=all';
    expect(parseUrlState().sport).toBeNull();
  });

  it('#bogus → tab=status (fallback)', () => {
    window.location.hash = '#bogus';
    const s = parseUrlState();
    expect(s.tab).toBe('status');
  });
});

describe('buildUrlHash', () => {
  it('status with no params → #status', () => {
    expect(buildUrlHash('status', null, null)).toBe('#status');
  });

  it('today with day → #today?day=Wednesday', () => {
    expect(buildUrlHash('today', 'Wednesday', null)).toBe('#today?day=Wednesday');
  });

  it('today with no day → #today', () => {
    expect(buildUrlHash('today', null, null)).toBe('#today');
  });

  it('sports with sport → #sports?sport=basketball', () => {
    expect(buildUrlHash('sports', null, 'basketball')).toBe('#sports?sport=basketball');
  });

  it('sports with no sport → #sports', () => {
    expect(buildUrlHash('sports', null, null)).toBe('#sports');
  });

  it('schedule with day → #schedule?day=Friday', () => {
    expect(buildUrlHash('schedule', 'Friday', null)).toBe('#schedule?day=Friday');
  });

  it('sports tab ignores day param', () => {
    expect(buildUrlHash('sports', 'Wednesday', 'basketball')).toBe('#sports?sport=basketball');
  });

  it('today tab ignores sport param', () => {
    expect(buildUrlHash('today', 'Monday', 'basketball')).toBe('#today?day=Monday');
  });

  it('status tab ignores all params', () => {
    expect(buildUrlHash('status', 'Monday', 'basketball')).toBe('#status');
  });
});
