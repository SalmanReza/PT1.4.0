export const RECOGNITION_PHRASES = Object.freeze({
  first: { arabic: 'شُكْرًا لِلَّهِ', transliteration: 'Shukran Lillah', bnTransliteration: 'শুকরান লিল্লাহ', meaning: 'Thanks be to Allah.', bn: 'আল্লাহর প্রতি কৃতজ্ঞতা।' },
  fard: { arabic: 'مَا شَاءَ اللَّهُ', transliteration: 'Mashallah', bnTransliteration: 'মাশাআল্লাহ', meaning: 'What Allah has willed.', bn: 'আল্লাহ যা ইচ্ছা করেছেন।' },
  sunnah: { arabic: 'الْحَمْدُ لِلَّهِ', transliteration: 'Alhamdulillah', bnTransliteration: 'আলহামদুলিল্লাহ', meaning: 'All praise is due to Allah.', bn: 'সকল প্রশংসা আল্লাহর জন্য।' },
  fullSunnah: { arabic: 'تَبَارَكَ اللَّهُ', transliteration: 'Tabarakallah', bnTransliteration: 'তাবারাকাল্লাহ', meaning: 'Blessed is Allah.', bn: 'বরকতময় আল্লাহ।' },
  voluntary: { arabic: 'سُبْحَانَ اللَّهِ', transliteration: 'Subhanallah', bnTransliteration: 'সুবহানাল্লাহ', meaning: 'Glory be to Allah.', bn: 'আল্লাহ পবিত্র ও মহিমান্বিত।' },
  complete: { arabic: 'اللَّهُ أَكْبَرُ', transliteration: 'Allahu Akbar', bnTransliteration: 'আল্লাহু আকবার', meaning: 'Allah is the Greatest.', bn: 'আল্লাহ সর্বশ্রেষ্ঠ।' },
  flexible: { arabic: 'جَزَاكَ اللَّهُ خَيْرًا', transliteration: 'Jazakallahu Khayran', bnTransliteration: 'জাযাকাল্লাহু খাইরান', meaning: 'May Allah reward you with goodness.', bn: 'আল্লাহ আপনাকে উত্তম প্রতিদান দিন।' }
});

export const FARD_RECOGNITION_SECONDS = Object.freeze([0, 5, 10, 15, 20, 30]);


export function recognitionKeyForTick({ kind = '', summary = {}, fardDone = 0, sunnah = {}, nafl = {} } = {}) {
  if (kind === 'flexible') return 'flexible';
  if (summary.great) return 'complete';
  if (kind === 'fard') return fardDone >= 5 ? 'fard' : 'first';
  if (kind === 'sunnah') return sunnah.complete ? (nafl.complete ? 'fullSunnah' : 'sunnah') : null;
  if (kind === 'nafl') return sunnah.complete && nafl.complete ? 'fullSunnah' : 'voluntary';
  if (kind === 'voluntary') return 'voluntary';
  return null;
}

export function recognitionPhrase({ recognitionKey = '', summary, fardDone = 0, latestKind = '', latestKey = '' } = {}) {
  if (recognitionKey && RECOGNITION_PHRASES[recognitionKey]) return RECOGNITION_PHRASES[recognitionKey];
  if (latestKey === 'flexible' || latestKind === 'flexible') return RECOGNITION_PHRASES.flexible;
  if (summary?.great) return RECOGNITION_PHRASES.complete;
  if (summary?.complete?.sunnah && summary?.complete?.nafl) return RECOGNITION_PHRASES.fullSunnah;
  if (summary?.complete?.sunnah) return RECOGNITION_PHRASES.sunnah;
  if (latestKind === 'voluntary' || latestKind === 'nafl') return RECOGNITION_PHRASES.voluntary;
  if (fardDone >= 5) return RECOGNITION_PHRASES.fard;
  if (fardDone > 0) return RECOGNITION_PHRASES.first;
  return null;
}

export function recognitionDuration({ latestKind = '', fardDone = 0, counts = {}, preference = 'auto' } = {}) {
  if (latestKind === 'fard') return FARD_RECOGNITION_SECONDS[Math.max(0, Math.min(5, fardDone))] || 0;
  if (preference !== 'auto') {
    const fixed = Number(preference);
    if ([5, 10, 15, 20, 30].includes(fixed)) return fixed;
  }
  return Math.max(1, (Number(counts.nafl) || 0) + (Number(counts.voluntary) || 0) + 2 * (Number(counts.sunnah) || 0));
}
