import test from 'node:test';
import assert from 'node:assert/strict';
import { LINE_MEMORY_DAYS, LINE_MEMORY_MS, normalizeLineMemory, rememberLine, serializeLineMemory, normalizeLineText } from '../src/line-memory.js';

const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 12);

test('line memory retains a strict 90-day window and removes only entries older than it', () => {
  const memory = normalizeLineMemory({ recentMeta: [
    { id: 'new', at: now - 89 * day, lang: 'en', text: 'A line.' },
    { id: 'edge', at: now - LINE_MEMORY_MS, lang: 'en', text: 'Edge.' },
    { id: 'old', at: now - 91 * day, lang: 'en', text: 'Old line.' }
  ] }, now, 'en');
  assert.equal(LINE_MEMORY_DAYS, 90);
  assert.deepEqual(memory.recent, ['new']);
  assert.equal(memory.recentTexts.length, 1);
});

test('legacy IDs without timestamps are conservatively retained for 90 days after migration', () => {
  const memory = normalizeLineMemory({ recent: ['legacy.one', 'legacy.two'] }, now, 'bn');
  assert.deepEqual(memory.recent, ['legacy.one', 'legacy.two']);
  assert.ok(memory.recentMeta.every(item => item.at === now));
});

test('memory is not capped at 80 lines and records shared semantic IDs across languages', () => {
  const recentMeta = Array.from({ length: 150 }, (_, i) => ({ id: `line.${i}`, at: now - i * 1000, lang: 'en', text: `Text ${i}` }));
  const memory = normalizeLineMemory({ recentMeta }, now, 'en');
  assert.equal(memory.recent.length, 150);
  const updated = rememberLine(memory, { id: 'shared.id', sig: 'same', text: 'A Bangla line' }, now, 'bn');
  const again = rememberLine(updated, { id: 'shared.id', sig: 'same', text: 'An English translation' }, now + 1000, 'en');
  assert.equal(again.recentMeta.filter(item => item.id === 'shared.id').length, 1);
  assert.ok(serializeLineMemory(again, now + 1000).recent.length >= 151);
});

test('line text normalization catches punctuation, case and spacing variants', () => {
  assert.equal(normalizeLineText('  Prayer   is here! '), normalizeLineText('prayer is here'));
});
