import test from 'node:test';
import assert from 'node:assert/strict';
import { readText } from './helpers/read-text.js';

const app = readText('../src/app.js', import.meta.url);
const html = readText('../index.html', import.meta.url);
const css = readText('../src/styles.css', import.meta.url);
const preferred = readText('../src/preferred-periods.js', import.meta.url);

test('home order is Available Right Now, Next Prayer, Completed Today, then Progress Cycle', () => {
  const home = html.slice(html.indexOf('<main id="homeView">'));
  const positions = ['live-events-section', 'class="hero-grid"', 'completedTodaySection', 'progressCycleSection'].map(key => home.indexOf(key));
  assert.ok(positions.every(value => value >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('recording window is distinct from actual prayer periods and the previous undo lock', () => {
  assert.match(app, /function getRecordableEvents\(now = new Date\(\)\)/);
  assert.match(app, /!canRecordEvent\(event, fard, now\)\) return false/);
  assert.match(app, /function togglePrayer\(kind, key, dateText\)/);
  assert.match(app, /!alreadyDone && !canRecordEvent\(event, fard, now\)/);
  assert.match(app, /lockState\(kind, key, eventDate\)\.locked\) return/);
});

test('active card descriptions and period details expand in place; completed cards have no countdown', () => {
  assert.match(app, /class="live-description" hidden/);
  assert.match(app, /class="live-event-extra" hidden/);
  assert.match(app, /button\.closest\('\.live-event'\).*querySelector\('\.live-description'\)/);
  const completed = app.slice(app.indexOf('function renderCompletedToday'), app.indexOf('function renderFard'));
  assert.match(completed, /completed-event-card/);
  assert.match(completed, /data-completed-kind/);
  assert.doesNotMatch(completed, /countdown|data-until/);
});

test('clock opens a full-page local temporal view with solar, lunar and restricted-period information', () => {
  assert.match(html, /id="clockInfoButton"/);
  assert.match(html, /id="temporalView"/);
  assert.match(app, /function openTemporalView\(\)/);
  assert.match(app, /sunPosition\(now, state\.lat, state\.lon\)/);
  assert.match(app, /moonPosition\(now, state\.lat, state\.lon\)/);
  assert.match(app, /moonPhase\(now\)/);
  assert.match(app, /moonPass\(now, state\.lat, state\.lon\)/);
  assert.match(app, /prohibitedIntervals\(times\)/);
  assert.match(html, /approximate offline calculations/);
  assert.match(html, /approximate offline calculations/);
});

test('backup UI provides Replace/Merge and a local safety copy with conflict handling', () => {
  assert.match(html, /id="backupImportMode"/);
  assert.match(html, /id="importBackupFile"/);
  assert.match(html, /id="importBackup"/);
  assert.match(app, /localStorage\.setItem\('prayer-times-safety-backup'/);
  assert.match(app, /mergeBackupState\(state, normalized, DEFAULTS, Object.keys\(imported\)\)/);
  assert.match(app, /current device retained/);
  assert.match(app, /if \(!save\(\)\)/);
});

test('recovery is conditional, requires a three-second hold and explicit performance confirmation', () => {
  assert.match(html, /id="prayerRecoverySection" hidden/);
  assert.match(app, /recoveryPrerequisites\(events/);
  assert.match(app, /window\.setTimeout\(\(\) => \{[\s\S]*confirmPrayerRecovery\(\);[\s\S]*\}, 3000\)/);
  assert.match(app, /I performed this prayer but forgot to record it\./);
});

test('recognition is text-only and its durations follow the approved rules', () => {
  assert.match(html, /id="progressRecognition"/);
  assert.match(html, /id="recognitionDurationSelect"/);
  assert.match(app, /recognitionPhrase\(/);
  assert.match(app, /recognitionDuration\(/);
  assert.match(css, /\.recognition-arabic/);
  assert.match(css, /\.recognition-transliteration/);
});

test('the app-facing source contains no prayer Qada or missed-prayer tracking terminology', () => {
  const source = `${app}\n${readText('../src/islamic-content.js', import.meta.url)}\n${html}`;
  assert.doesNotMatch(source, /\bqada\b|missed prayers|missed obligatory prayers|কাযা নামাজ|ছুটে যাওয়া ফরজ/i);
});

test('preferred-period card uses sourced windows and gold styling only when active', () => {
  assert.match(app, /function preferredPeriodHtml\(event/);
  assert.match(app, /preferredPeriodFor\(event/);
  assert.match(app, /preferredActive/);
  assert.match(app, /BEST TIME/);
  assert.match(preferred, /Sahih al-Bukhari 569/);
  assert.match(preferred, /Sahih Muslim 755a/);
  assert.match(app, /is-preferred/);
});
