import test from 'node:test';
import assert from 'node:assert/strict';
import { skyColors, zoneSpans, timeArcPoint } from '../src/sky.js';
import { notificationNotes, notificationPlan, tickPlan, NOTIFICATION_VOLUME } from '../src/sound.js';
import { prohibitedIntervals } from '../src/forbidden-times.js';
import { readText } from './helpers/read-text.js';

const css = readText('../src/styles.css', import.meta.url);
const html = readText('../index.html', import.meta.url);
const app = readText('../src/app.js', import.meta.url);
const rust = readText('../src-tauri/src/main.rs', import.meta.url);

const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

test('sky colour follows the sun altitude: dark at night, bright at midday, warm at sunrise/sunset, continuous in between', () => {
  const night = skyColors(-30, true), noon = skyColors(60, true), rise = skyColors(0.5, true), set = skyColors(0.5, false);
  assert.ok(lum(night[1]) < 40 && lum(noon[1]) > 150, 'night is dark, midday is bright');
  assert.ok(parseInt(rise[2].slice(1, 3), 16) > parseInt(rise[2].slice(5, 7), 16) + 40, 'sunrise horizon is warm (red above blue)');
  assert.ok(parseInt(set[2].slice(1, 3), 16) > parseInt(set[2].slice(5, 7), 16) + 60, 'sunset horizon is warm');
  assert.notDeepEqual(skyColors(15, true), skyColors(15, false), 'morning and golden afternoon differ');
  assert.deepEqual(skyColors(40, true), skyColors(40, false), 'midday is shared');
  for (const rising of [true, false]) {
    let prev = skyColors(-40, rising);
    for (let alt = -39.5; alt <= 60; alt += 0.5) {
      const next = skyColors(alt, rising);
      next.forEach((hex, i) => { for (const c of [1, 3, 5]) assert.ok(Math.abs(parseInt(hex.slice(c, c + 2), 16) - parseInt(prev[i].slice(c, c + 2), 16)) <= 24, `no jump at ${alt}`); });
      prev = next;
    }
  }
  assert.deepEqual(skyColors(NaN, true), skyColors(-90, true));
});

test('forbidden zones are exactly the intervals from forbidden-times.js (no padding), as fractions of sunrise to sunset', () => {
  const rise = Date.UTC(2026, 10, 13, 0, 0), set = rise + 11 * 3600000;
  const times = { sunrise: new Date(rise), sunset: new Date(set), zawalStart: new Date(rise + 5.5 * 3600000), dhuhr: new Date(rise + 5.75 * 3600000), asr: new Date(rise + 8 * 3600000) };
  const intervals = prohibitedIntervals(times);
  const zones = zoneSpans(intervals, times.sunrise, times.sunset);
  assert.equal(zones.length, intervals.length);
  zones.forEach((zone, i) => {
    assert.ok(Math.abs(zone.f0 - Math.max(0, (intervals[i].start.getTime() - rise) / (set - rise))) < 1e-9);
    assert.ok(Math.abs(zone.f1 - Math.min(1, (intervals[i].end.getTime() - rise) / (set - rise))) < 1e-9);
  });
  assert.equal(timeArcPoint(0, 800, 50, 10, 14).x, 14);
  assert.match(app, /zoneSpans\(intervals, times\.sunrise, times\.sunset\)/, 'the sky uses the same function as the rules');
  assert.match(app, /sky-zone-edge/, 'forbidden intervals have precise boundary markers');
});

test('sky shape: new observatory uses a dual solar/lunar instrument, not the former star-and-cloud artwork', () => {
  assert.match(html, /id="skyMoonNightArc"/);
  assert.match(html, /id="skyObservatoryFooter"/);
  assert.match(css, /\.sky-zone-track/);
  assert.match(css, /\.sky-observatory-head/);
  assert.doesNotMatch(html, /skyStar8|sky-cloud|sky-stars/);
  assert.doesNotMatch(css, /sky-drift|sky-twinkle/);
  assert.match(app, /nightArcPoint/);
});

test('notification sound: same Fard voice as the tick, but louder, stronger and still short', () => {
  const notes = notificationNotes();
  assert.equal(notes.length, 3);
  assert.ok(notes.at(-1).at + 0.25 < 1, 'under one second');
  const loud = notificationPlan(3, 'wooden', () => 0.5), tick = tickPlan('fard', 3, 'wooden', () => 0.5);
  assert.ok(loud.volume >= 0.9 && loud.volume === NOTIFICATION_VOLUME && loud.volume > tick.volume * 1.5);
  assert.ok(loud.bodyGain > tick.bodyGain && loud.clickGain > tick.clickGain && loud.duration > tick.duration);
  assert.match(app, /type: 'notify'/);
  assert.match(app, /playNotificationSound\(\);\s+return \{ ok: true, how: typeof how/);
});

test('layout: one spacing scale, bigger clock, location subtitle, proportionate live card with a 33% larger Fard tick', () => {
  assert.match(css, /--sp-1: clamp\([^)]*\)[^}]*--sp-5: clamp\(/);
  assert.match(css, /\.top-date time \{[^}]*font-size: clamp\(1\.4rem/);
  assert.match(app, /`Location: \$\{coords\}`/);
  assert.match(app, /`অবস্থান: \$\{localizeDigits\(coords\)\}`/);
  assert.match(css, /--tk: calc\(var\(--live-fs\) \* 1\.45\)/);
  assert.match(css, /\.live-event \.part-tick i \{ width: var\(--tk\); height: var\(--tk\);/);
  assert.match(css, /\.live-event \.round-check \{ flex: 0 0 calc\(var\(--tk\) \* 1\.33\); width: calc\(var\(--tk\) \* 1\.33\); height: calc\(var\(--tk\) \* 1\.33\);/, 'Fard tick = 1.33 x Sunnah/Nafl tick');
  assert.match(css, /\.live-event::before \{[^}]*mask/);
  assert.match(css, /\.live-event::after \{[^}]*mask/);
  assert.doesNotMatch(css.slice(css.indexOf('===== v1.3.4')), /\.live-name \{ font-size: (2\.[2-9]|[3-9])/, 'name is not oversized');
});

test('fullscreen: Rust leaves the maximised state first and restores it; the page calls it and refreshes the pointer', () => {
  assert.match(rust, /fn set_window_fullscreen\(app: tauri::AppHandle, fullscreen: bool\) -> Result<\(\), String>/);
  assert.match(rust, /window\.unminimize|window\.unmaximize\(\)/);
  assert.match(rust, /WAS_MAXIMIZED\.swap\(false, Ordering::SeqCst\)/);
  assert.match(app, /invoke\('set_window_fullscreen', \{ fullscreen: value \}\)/);
  assert.match(app, /classList\.toggle\('is-fullscreen', value\)/);
});


test('v1.3.5 layout: event cards form a responsive row, settings share the Home card framework, and progress figure styling remains present', () => {
  assert.match(css, /\.live-events \{ display:grid; grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,11\.5rem\),1fr\)\)/);
  assert.match(css, /\.live-events\[data-count=\"6\"\]/);
  assert.match(css, /\.hero-grid \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.settings-card::before/);
  assert.match(css, /\.settings-card \{ position:relative; overflow:hidden/);
  assert.match(css, /\.pf-seg\.fard \{ stroke: var\(--layer-fard\); \}/);
  assert.match(css, /\.pf-seg\.sunnah \{ stroke: var\(--layer-sunnah\); \}/);
  assert.match(css, /\.pf-seg\.nafl \{ stroke: var\(--layer-nafl\); \}/);
  assert.match(css, /\.part-tick\.fard i \{ width: 1\.33rem; height: 1\.33rem;/);
  assert.match(css, /\.live-event \.round-check \{ flex: 0 0 calc\(var\(--tk\) \* 1\.33\)/);
  assert.match(css, /\.part-tick\.sunnah\.done i \{ background: var\(--layer-sunnah\); \}/);
  assert.match(css, /\.part-tick\.nafl\.done i \{ background: var\(--layer-nafl\); \}/);
});
