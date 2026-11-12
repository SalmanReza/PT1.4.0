import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOGNITION_PHRASES, FARD_RECOGNITION_SECONDS, recognitionPhrase, recognitionDuration, recognitionKeyForTick } from '../src/recognition.js';

test('recognition phrases match the approved Arabic, transliteration and meaning', () => {
  assert.deepEqual([RECOGNITION_PHRASES.first.transliteration, RECOGNITION_PHRASES.fard.transliteration, RECOGNITION_PHRASES.sunnah.transliteration, RECOGNITION_PHRASES.fullSunnah.transliteration, RECOGNITION_PHRASES.voluntary.transliteration, RECOGNITION_PHRASES.complete.transliteration, RECOGNITION_PHRASES.flexible.transliteration], ['Shukran Lillah', 'Mashallah', 'Alhamdulillah', 'Tabarakallah', 'Subhanallah', 'Allahu Akbar', 'Jazakallahu Khayran']);
  for (const phrase of Object.values(RECOGNITION_PHRASES)) assert.ok(phrase.arabic && phrase.transliteration && phrase.bnTransliteration && phrase.meaning && phrase.bn);
});

test('recognition selects the highest achieved structured milestone', () => {
  assert.equal(recognitionPhrase({ fardDone: 1, latestKind: 'fard' }), RECOGNITION_PHRASES.first);
  assert.equal(recognitionPhrase({ fardDone: 5, latestKind: 'fard' }), RECOGNITION_PHRASES.fard);
  assert.equal(recognitionPhrase({ summary: { complete: { sunnah: true, nafl: false } } }), RECOGNITION_PHRASES.sunnah);
  assert.equal(recognitionPhrase({ summary: { complete: { sunnah: true, nafl: true } } }), RECOGNITION_PHRASES.fullSunnah);
  assert.equal(recognitionPhrase({ summary: { great: true } }), RECOGNITION_PHRASES.complete);
});

test('Fard durations are fixed and non-Fard durations use the approved default formula or a setting override', () => {
  assert.deepEqual(FARD_RECOGNITION_SECONDS, [0, 5, 10, 15, 20, 30]);
  for (let count = 1; count <= 5; count++) assert.equal(recognitionDuration({ latestKind: 'fard', fardDone: count }), [0, 5, 10, 15, 20, 30][count]);
  assert.equal(recognitionDuration({ latestKind: 'sunnah', counts: { sunnah: 2, nafl: 1 } }), 5);
  assert.equal(recognitionDuration({ latestKind: 'nafl', counts: { nafl: 2 } }), 2);
  assert.equal(recognitionDuration({ latestKind: 'sunnah', counts: { sunnah: 2 }, preference: '15' }), 15);
});


test('recognition is tied to the completion that achieved the milestone', () => {
  assert.equal(recognitionKeyForTick({ kind: 'fard', fardDone: 1 }), 'first');
  assert.equal(recognitionKeyForTick({ kind: 'fard', fardDone: 5 }), 'fard');
  assert.equal(recognitionKeyForTick({ kind: 'sunnah', sunnah: { complete: true }, nafl: { complete: false } }), 'sunnah');
  assert.equal(recognitionKeyForTick({ kind: 'nafl', sunnah: { complete: true }, nafl: { complete: true } }), 'fullSunnah');
  assert.equal(recognitionKeyForTick({ kind: 'voluntary' }), 'voluntary');
  assert.equal(recognitionKeyForTick({ kind: 'flexible' }), 'flexible');
  assert.equal(recognitionPhrase({ recognitionKey: 'flexible' }), RECOGNITION_PHRASES.flexible);
});
