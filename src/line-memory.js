export const LINE_MEMORY_DAYS = 90;
export const LINE_MEMORY_MS = LINE_MEMORY_DAYS * 24 * 60 * 60 * 1000;

const validEntry = item => item && typeof item.id === 'string' && item.id.length > 0 && Number.isFinite(Number(item.at));

/** Migrate the old capped string list and retain every known line for a full 90-day window. */
export function normalizeLineMemory(raw = {}, now = Date.now(), lang = 'en') {
  const cutoff = now - LINE_MEMORY_MS;
  let entries = Array.isArray(raw.recentMeta) ? raw.recentMeta.filter(validEntry).filter(item => Number(item.at) > cutoff).map(item => ({ id: item.id, at: Number(item.at), lang: item.lang || null, text: typeof item.text === 'string' ? item.text : '' })) : [];
  const known = new Set(entries.map(item => item.id));
  // Old v1.3.x entries had no timestamps. Treat them as recent from migration time
  // rather than risk repeating one whose original age cannot be established.
  for (const id of Array.isArray(raw.recent) ? raw.recent : []) {
    if (typeof id === 'string' && id && !known.has(id)) {
      entries.push({ id, at: now, lang: null, text: '' });
      known.add(id);
    }
  }
  entries.sort((a, b) => a.at - b.at);
  return {
    recentMeta: entries,
    recent: [...new Set(entries.map(item => item.id))],
    recentTexts: entries.filter(item => item.lang === lang && item.text).map(item => item.text),
    current: raw.current && typeof raw.current === 'object' ? raw.current : null,
    sugg: raw.sugg && typeof raw.sugg === 'object' ? raw.sugg : {}
  };
}

export function rememberLine(memory, result, now = Date.now(), lang = 'en') {
  const entries = [...(memory.recentMeta || [])];
  if (!entries.some(item => item.id === result.id)) entries.push({ id: result.id, at: now, lang, text: result.text });
  const normalized = normalizeLineMemory({ ...memory, recentMeta: entries, recent: entries.map(item => item.id), current: { sig: result.sig, id: result.id } }, now, lang);
  return normalized;
}

export function serializeLineMemory(memory, now = Date.now()) {
  const normalized = normalizeLineMemory(memory, now, 'en');
  return {
    recent: normalized.recent,
    recentMeta: normalized.recentMeta,
    current: memory.current || null,
    sugg: memory.sugg || {}
  };
}

export function normalizeLineText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
