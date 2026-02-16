import { describe, it, expect } from 'vitest';
import { activityEmoji } from './emoji.js';

describe('activityEmoji', () => {
  it('returns basketball emoji', () => {
    expect(activityEmoji('Basketball')).toBe('\u{1F3C0}');
  });

  it('returns pickleball emoji', () => {
    expect(activityEmoji('Pickleball')).toBe('\u{1F3D3}');
  });

  it('returns table tennis emoji', () => {
    expect(activityEmoji('Table Tennis')).toBe('\u{1F3D3}');
  });

  it('returns volleyball emoji', () => {
    expect(activityEmoji('Volleyball')).toBe('\u{1F3D0}');
  });

  it('returns badminton emoji', () => {
    expect(activityEmoji('Badminton')).toBe('\u{1F3F8}');
  });

  it('returns dance emoji for word boundary match', () => {
    expect(activityEmoji('Line Dance')).toBe('\u{1F483}');
  });

  it('does not match dance inside other words', () => {
    expect(activityEmoji('Advanced Training')).toBe('');
  });

  it('returns ADA emoji for word boundary match', () => {
    expect(activityEmoji('ADA Open Gym')).toBe('\u{1F9D1}\u{200D}\u{1F9BD}');
  });

  it('does not match ADA inside other words', () => {
    expect(activityEmoji('Canada Day')).toBe('');
  });

  it('returns youth center emoji', () => {
    expect(activityEmoji('Youth Center')).toBe('\u{1F31F}');
  });

  it('returns open gym emoji', () => {
    expect(activityEmoji('Open Gym')).toBe('\u{1F45F}');
  });

  it('is case insensitive', () => {
    expect(activityEmoji('BASKETBALL')).toBe('\u{1F3C0}');
    expect(activityEmoji('pickleball')).toBe('\u{1F3D3}');
  });

  it('returns empty string for unknown activity', () => {
    expect(activityEmoji('Swimming')).toBe('');
    expect(activityEmoji('')).toBe('');
  });

  it('matches substrings within longer names', () => {
    expect(activityEmoji('Adult Basketball League')).toBe('\u{1F3C0}');
    expect(activityEmoji('Senior Pickleball')).toBe('\u{1F3D3}');
  });
});
