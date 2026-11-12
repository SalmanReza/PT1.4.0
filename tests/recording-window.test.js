import test from 'node:test';
import assert from 'node:assert/strict';
import { recordingLockAt, canRecordEvent, recordingWindow } from '../src/recording-window.js';

const base = Date.UTC(2026, 10, 12);
const at = hour => base + hour * 3600000;
const fard = [
  ['fajr', 5], ['dhuhr', 12], ['asr', 15], ['maghrib', 18], ['isha', 19.5],
  ['fajr', 29], ['dhuhr', 36], ['asr', 39]
].map(([key, hour], i) => ({ kind: 'fard', key, start: at(hour), date: i < 5 ? '2026-11-12' : '2026-11-13' }));

test('Fard recording locks at the second following Fard start', () => {
  const expected = { fajr: ['asr', 15], dhuhr: ['maghrib', 18], asr: ['isha', 19.5], maghrib: ['fajr', 29], isha: ['dhuhr', 36] };
  for (const [key, [by, hour]] of Object.entries(expected)) {
    const event = fard.find(item => item.key === key && item.start < at(30));
    assert.deepEqual(recordingLockAt(event, fard), { at: at(hour), by });
  }
});

test('voluntary event recording closes at the second Fard start after its own start', () => {
  const duha = { kind: 'voluntary', key: 'duha', start: at(7), end: at(11) };
  const awwabin = { kind: 'voluntary', key: 'awwabin', start: at(18), end: at(19.5) };
  assert.deepEqual(recordingLockAt(duha, fard), { at: at(15), by: 'asr' });
  assert.deepEqual(recordingLockAt(awwabin, fard), { at: at(29), by: 'fajr' });
});

test('recording window includes its start and excludes the lock instant', () => {
  const event = fard[1];
  assert.equal(canRecordEvent(event, fard, at(12)), true);
  assert.equal(canRecordEvent(event, fard, at(17.999)), true);
  assert.equal(canRecordEvent(event, fard, at(18)), false);
  assert.deepEqual(recordingWindow(event, fard), { start: at(12), end: at(18), lockedBy: 'maghrib' });
});

test('missing event context does not guess a recording deadline', () => {
  assert.equal(recordingLockAt({ kind: 'fard', key: 'fajr', start: at(5) }, []), null);
  assert.equal(recordingLockAt({ kind: 'fard', key: 'missing', start: at(5) }, fard), null);
  assert.equal(canRecordEvent({ kind: 'fard', key: 'fajr', start: at(5) }, [], at(6)), false);
});
