const instant = value => value instanceof Date ? value.getTime() : Number(value);

/** Hadith-based preferred windows; these are not prayer-validity or recording cutoffs. */
export function preferredPeriodFor(event, { maghrib, nextFajr, school = 'hanafi', now = Date.now() } = {}) {
  const nightStart = instant(maghrib);
  const nightEnd = instant(nextFajr);
  const current = instant(now);
  if (!Number.isFinite(nightStart) || !Number.isFinite(nightEnd) || nightEnd <= nightStart || !Number.isFinite(current)) return null;
  // The Ja'fari profile is intentionally excluded until its school-specific preferred-time
  // treatment is verified separately; do not silently apply Sunni timing guidance.
  if (String(school).toLowerCase() === 'jafari' || String(school).toLowerCase() === 'jaafari') return null;
  const firstThirdEnd = nightStart + (nightEnd - nightStart) / 3;
  const lastThirdStart = nightEnd - (nightEnd - nightStart) / 3;
  if (event?.kind === 'fard' && event.key === 'isha') {
    const start = instant(event.start);
    if (!Number.isFinite(start) || firstThirdEnd <= start) return null;
    return {
      key: 'isha-first-third', start: new Date(start), end: new Date(firstThirdEnd),
      active: current >= start && current < firstThirdEnd,
      note: 'When there is no hardship, delaying Isha into the first third of the night is supported by the Sunnah. This is a recommended timing, not a requirement or the end of Isha validity.',
      source: ['Sahih al-Bukhari 569', 'Sahih al-Bukhari 572'],
      urls: ['https://sunnah.com/bukhari/9/46', 'https://sunnah.com/bukhari/9/48']
    };
  }
  if (event?.kind === 'voluntary' && ['qiyam', 'tahajjud', 'witr'].includes(event.key)) {
    const witr = event.key === 'witr';
    return {
      key: 'night-last-third', start: new Date(lastThirdStart), end: new Date(nightEnd),
      active: current >= lastThirdStart && current < nightEnd,
      note: witr
        ? 'If you are confident you will wake, delaying Witr to the latter part is preferable; if you fear you will not wake, pray it earlier before sleeping.'
        : 'The last third of the night is an especially virtuous time for night prayer and supplication.',
      source: witr ? ['Sahih Muslim 755a', 'Sahih al-Bukhari 1145'] : ['Sahih al-Bukhari 1145', 'Sahih Muslim 758a'],
      urls: witr ? ['https://sunnah.com/muslim/6/195', 'https://sunnah.com/bukhari:1145'] : ['https://sunnah.com/bukhari:1145', 'https://sunnah.com/muslim:758a']
    };
  }
  return null;
}
