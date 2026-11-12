import test from 'node:test';
import assert from 'node:assert/strict';
import { backupDataFromPayload, mergeBackupHistory, mergeBackupState } from '../src/backup.js';

test('backup payload validation accepts supported versions and rejects malformed/future files', () => {
  assert.deepEqual(backupDataFromPayload({ version: 1, data: { history: {} } }), { history: {} });
  assert.throws(() => backupDataFromPayload({ version: 3, data: {} }), /not supported/);
  assert.throws(() => backupDataFromPayload({ version: 2, data: [] }), /not a valid/);
  assert.throws(() => backupDataFromPayload(null), /not a valid/);
});

test('merge adds non-conflicting records, preserves local conflicts and reports each conflict', () => {
  const local = { '2026-11-12': { fard: { fajr: true }, voluntary: { duha: true }, at: { 'fard:fajr': [2, 300] } } };
  const imported = {
    '2026-11-12': { fard: { fajr: false, dhuhr: true }, voluntary: { duha: false, witr: true }, at: { 'fard:fajr': [3, 301] } },
    '2026-11-13': { fard: { fajr: true }, voluntary: {} }
  };
  const result = mergeBackupHistory(local, imported);
  assert.deepEqual(result.history['2026-11-12'].fard, { fajr: true, dhuhr: true });
  assert.deepEqual(result.history['2026-11-12'].voluntary, { duha: true, witr: true });
  assert.deepEqual(result.history['2026-11-12'].at['fard:fajr'], [2, 300]);
  assert.deepEqual(result.history['2026-11-13'].fard, { fajr: true });
  assert.equal(result.conflicts.length, 2);
});


test('state merge imports settings where the local value is still default and keeps custom local conflicts', () => {
  const defaults = { theme: 'Obsidian', clock: '24h', lat: null, history: {} };
  const local = { theme: 'Midnight', clock: '24h', lat: null, history: {} };
  const incoming = { theme: 'Light', clock: '12h', lat: 23.8, history: { '2026-11-12': { fard: { fajr: true }, voluntary: {} } } };
  const result = mergeBackupState(local, incoming, defaults);
  assert.equal(result.data.theme, 'Midnight');
  assert.equal(result.data.clock, '12h');
  assert.equal(result.data.lat, 23.8);
  assert.ok(result.conflicts.includes('settings.theme'));
  assert.deepEqual(result.data.history['2026-11-12'].fard, { fajr: true });
});

test('merge unions notification dedupe markers and merges map settings by item', () => {
  const defaults = { history: {}, cards: { sky: true, history: true }, transitionSent: {}, reminderSent: {} };
  const local = { history: {}, cards: { sky: false, history: true }, transitionSent: { a: 100 }, reminderSent: {} };
  const incoming = { history: {}, cards: { sky: true, history: false }, transitionSent: { b: 200 }, reminderSent: { r: 300 } };
  const result = mergeBackupState(local, incoming, defaults);
  assert.deepEqual(result.data.cards, { sky: false, history: false });
  assert.deepEqual(result.data.transitionSent, { a: 100, b: 200 });
  assert.deepEqual(result.data.reminderSent, { r: 300 });
  assert.ok(result.conflicts.includes('settings.cards.sky'));
});
