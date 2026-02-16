export function activityEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('basketball'))   return '\u{1F3C0}'; // 🏀
  if (lower.includes('pickleball'))   return '\u{1F3D3}'; // 🏓
  if (lower.includes('table tennis')) return '\u{1F3D3}'; // 🏓
  if (lower.includes('volleyball'))   return '\u{1F3D0}'; // 🏐
  if (lower.includes('badminton'))    return '\u{1F3F8}'; // 🏸
  if (/\bdance\b/.test(lower))        return '\u{1F483}'; // 💃
  if (lower.includes('youth center')) return '\u{1F31F}'; // 🌟
  return '';
}
