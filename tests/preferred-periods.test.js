import test from 'node:test';
import assert from 'node:assert/strict';
import { preferredPeriodFor } from '../src/preferred-periods.js';

const maghrib = new Date('2026-11-12T18:00:00+06:00');
const fajr = new Date('2026-11-13T05:00:00+06:00');
const event = (kind, key, start) => ({ kind, key, start: new Date(start) });

test('Isha preferred period ends at the first third of the local night', () => {
  const isha = event('fard', 'isha', '2026-11-12T19:30:00+06:00');
  const early = preferredPeriodFor(isha, { maghrib, nextFajr: fajr, school: 'hanafi', now: new Date('2026-11-12T20:00:00+06:00') });
  assert.equal(early.active, true);
  assert.equal(early.end.getTime(), maghrib.getTime() + (fajr.getTime() - maghrib.getTime()) / 3);
  assert.deepEqual(early.source, ['Sahih al-Bukhari 569', 'Sahih al-Bukhari 572']);
  const late = preferredPeriodFor(isha, { maghrib, nextFajr: fajr, school: 'shafii', now: new Date('2026-11-13T00:30:00+06:00') });
  assert.equal(late.active, false);
});

test('last third is highlighted for night prayer and Witr only during that interval', () => {
  const witr = event('voluntary', 'witr', '2026-11-12T19:30:00+06:00');
  const before = preferredPeriodFor(witr, { maghrib, nextFajr: fajr, school: 'hanbali', now: new Date('2026-11-13T00:00:00+06:00') });
  const during = preferredPeriodFor(witr, { maghrib, nextFajr: fajr, school: 'maliki', now: new Date('2026-11-13T02:00:00+06:00') });
  assert.equal(before.active, false);
  assert.equal(during.active, true);
  assert.equal(during.end.getTime(), fajr.getTime());
  assert.match(during.note, /if you fear you will not wake, pray it earlier before sleeping/);
  assert.deepEqual(during.source, ['Sahih Muslim 755a', 'Sahih al-Bukhari 1145']);
});

test('Jaafari profile is not assigned an unverified Sunni preferred-time rule', () => {
  const isha = event('fard', 'isha', '2026-11-12T19:30:00+06:00');
  assert.equal(preferredPeriodFor(isha, { maghrib, nextFajr: fajr, school: 'jafari', now: new Date('2026-11-12T20:00:00+06:00') }), null);
});
