import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryPrerequisites, recoveryCandidates } from '../src/prayer-recovery.js';

const events = [
  { key: 'fajr', start: 100 }, { key: 'dhuhr', start: 200 },
  { key: 'asr', start: 300 }, { key: 'maghrib', start: 400 }
];
const done = new Set(['fajr', 'dhuhr']);

test('recovery requires the two immediately preceding Fard events to be complete', () => {
  assert.equal(recoveryPrerequisites(events, event => done.has(event.key), 250), true);
  assert.equal(recoveryPrerequisites(events, event => done.has(event.key), 450), false, 'the latest two are Asr and Maghrib, not older Fajr and Dhuhr');
  assert.equal(recoveryPrerequisites(events.slice(0, 1), () => true, 150), false, 'two prior events are required');
});

test('recovery candidates must be earlier, incomplete and already locked', () => {
  const candidates = recoveryCandidates(events, event => done.has(event.key), event => event.key === 'asr' || event.key === 'maghrib', 450);
  assert.deepEqual(candidates.map(event => event.key), ['maghrib', 'asr']);
  assert.deepEqual(recoveryCandidates(events, () => true, () => true, 450), []);
});
