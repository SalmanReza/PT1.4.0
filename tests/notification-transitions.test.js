import test from 'node:test';
import assert from 'node:assert/strict';
import { dueTransitions, groupTransitions, transitionId, transitionItemId } from '../src/notification-transitions.js';

const base = Date.UTC(2026, 10, 12, 12);
const ev = (key, start, end, kind = 'fard') => ({ key, kind, start: base + start, end: base + end, date: '2026-11-12' });

test('transition collector catches recent starts and ends, but not future or stale transitions', () => {
  const events = [ev('fajr', -60000, -30000), ev('dhuhr', 30000, 90000)];
  const due = dueTransitions(events, base, 120000);
  assert.deepEqual(due.map(item => [item.key, item.type]), [['fajr', 'start'], ['fajr', 'end']].filter(x => x[1] === 'end' || x[1] === 'start'));
  assert.equal(due.some(item => item.key === 'dhuhr'), false);
  assert.equal(dueTransitions([ev('asr', -300000, -240000)], base, 120000).length, 0);
});

test('simultaneous prayer-event transitions combine into one group and deduplicate', () => {
  const events = [ev('isha', -1000, 5000, 'fard'), ev('witr', -1000, 8000, 'voluntary'), ev('qiyam', -1000, 9000, 'voluntary')];
  const groups = groupTransitions(dueTransitions(events, base, 2000));
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].starts.map(item => item.key).sort(), ['isha', 'qiyam', 'witr']);
  assert.equal(transitionId(groups[0]), transitionId(groups[0]));
});

test('individual transition markers stay stable if the system clock or timezone shifts', () => {
  const event = { key: 'fajr', kind: 'fard', date: new Date(2026, 10, 12) };
  assert.equal(transitionItemId('start', event), 'start|fard|fajr|2026-11-12');
});
