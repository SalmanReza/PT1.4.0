import test from 'node:test';
import assert from 'node:assert/strict';
import { julianDay, sunPosition, moonPhase, phaseName, moonEquatorial, moonPosition, sunTimes, moonPass, passFraction, sunIntensity, moonLitPath, timeArcPoint, timeArcPath, zoneSpans, zonePath } from '../src/sky.js';
import { calculatePrayerTimes } from '../src/prayer-engine.js';
import { readText } from './helpers/read-text.js';

const utc = (...a) => new Date(Date.UTC(...a));

test('Julian day: J2000.0 and the Unix epoch', () => {
  assert.equal(julianDay(utc(2000, 0, 1, 12)), 2451545.0);
  assert.equal(julianDay(utc(1970, 0, 1)), 2440587.5);
});

test('sun declination at the equinoxes and solstices (astronomical almanac values)', () => {
  assert.ok(Math.abs(sunPosition(utc(2024, 2, 20, 3, 6), 0, 0).declination) < 0.1, 'March equinox 2024-03-20 03:06 UTC');
  assert.ok(Math.abs(sunPosition(utc(2024, 8, 22, 12, 44), 0, 0).declination) < 0.1, 'September equinox 2024-09-22 12:44 UTC');
  assert.ok(Math.abs(sunPosition(utc(2024, 5, 20, 20, 51), 0, 0).declination - 23.44) < 0.05, 'June solstice');
  assert.ok(Math.abs(sunPosition(utc(2024, 11, 21, 9, 21), 0, 0).declination + 23.44) < 0.05, 'December solstice');
  assert.ok(Math.abs(sunPosition(utc(2026, 10, 13, 6), 0, 0).declination + 18.0) < 0.5, '13 Nov 2026 is about 18 degrees south (almanac: -18.1)');
});

test('sun altitude: near the zenith at the equator at the equinox, below the horizon at local midnight', () => {
  const noon = sunPosition(utc(2024, 2, 20, 12, 7), 0, 0); // equation of time about -7.5 min, so true solar noon is 12:07 UTC
  assert.ok(noon.altitude > 88, `altitude ${noon.altitude}`);
  const midnight = sunPosition(utc(2024, 2, 20, 0, 7), 0, 0);
  assert.ok(midnight.altitude < -85);
});

test('sun at solar noon in Dhaka on 13 Nov 2026: altitude = 90 - (lat - dec), due south', () => {
  // Dhaka 23.81 N 90.41 E; solar noon is about 05:48 UTC (11:48 in UTC+6)
  let best = null;
  for (let m = 5 * 60 + 30; m <= 6 * 60 + 10; m++) {
    const p = sunPosition(utc(2026, 10, 13, 0, m), 23.8103, 90.4125);
    if (!best || p.altitude > best.p.altitude) best = { m, p };
  }
  const dec = best.p.declination;
  assert.ok(Math.abs(best.p.altitude - (90 - (23.8103 - dec))) < 0.3, `${best.p.altitude}`);
  assert.ok(best.p.altitude > 47 && best.p.altitude < 49.5);
  assert.ok(Math.abs(best.p.azimuth - 180) < 2, `azimuth ${best.p.azimuth}`);
  assert.ok(best.m >= 5 * 60 + 40 && best.m <= 5 * 60 + 52, `solar noon at ${best.m} min after 00:00 UTC`);
});

test('sun azimuth at the equinox sunrise and sunset at the equator is due east and due west', () => {
  assert.ok(Math.abs(sunPosition(utc(2024, 2, 20, 6, 0), 0, 0).azimuth - 90) < 4);
  assert.ok(Math.abs(sunPosition(utc(2024, 2, 20, 18, 14), 0, 0).azimuth - 270) < 4);
});

test('moon phase against known new and full moons', () => {
  const news = [utc(2000, 0, 6, 18, 14), utc(2024, 3, 8, 18, 21), utc(2026, 10, 9, 21, 2)];
  const fulls = [utc(2000, 0, 21, 4, 40), utc(2024, 3, 23, 23, 49), utc(2026, 10, 24, 14, 53)];
  for (const d of news) assert.ok(moonPhase(d).illumination < 0.01, `${d.toISOString()} ${moonPhase(d).illumination}`);
  for (const d of fulls) assert.ok(moonPhase(d).illumination > 0.99, `${d.toISOString()} ${moonPhase(d).illumination}`);
});

test('moon phase: Meeus example 48.a (1992 April 12, 0h TD) gives k = 0.679', () => {
  const p = moonPhase(utc(1992, 3, 12, 0, 0));
  assert.ok(Math.abs(p.illumination - 0.6786) < 0.01, `${p.illumination}`);
  assert.equal(p.waxing, true, 'new moon 3 April, full moon 17 April: waxing gibbous');
});

test('moon quarters are half lit; waxing between new and full, waning after', () => {
  const firstQ = moonPhase(utc(2024, 3, 15, 19, 13));
  const lastQ = moonPhase(utc(2024, 4, 1, 11, 27));
  assert.ok(Math.abs(firstQ.illumination - 0.5) < 0.03 && firstQ.waxing);
  assert.ok(Math.abs(lastQ.illumination - 0.5) < 0.03 && !lastQ.waxing);
  assert.equal(phaseName(firstQ), 'first-quarter');
  assert.equal(phaseName(lastQ), 'last-quarter');
  assert.equal(phaseName(moonPhase(utc(2024, 3, 8, 18, 21))), 'new');
  assert.equal(phaseName(moonPhase(utc(2024, 3, 23, 23, 49))), 'full');
  assert.equal(phaseName(moonPhase(utc(2024, 3, 11))), 'waxing-crescent');
  assert.equal(phaseName(moonPhase(utc(2024, 3, 19))), 'waxing-gibbous');
  assert.equal(phaseName(moonPhase(utc(2024, 3, 26))), 'waning-gibbous');
  assert.equal(phaseName(moonPhase(utc(2024, 4, 3))), 'waning-crescent');
});

test('one synodic month later the phase repeats (29.53 days, within the moon’s usual 14 hour wobble)', () => {
  const a = moonPhase(utc(2025, 0, 29, 12, 36)); // new moon
  assert.ok(a.illumination < 0.01);
  for (let day = 0; day < 40; day++) { const p = moonPhase(utc(2025, 0, 1 + day)); assert.ok(p.illumination >= 0 && p.illumination <= 1); }
});

test('sunrise and sunset against references: London 21 June 2024 (03:43 / 20:21 UTC) and the equinox at the equator (about 06:04 / 18:10 UTC)', () => {
  const london = sunTimes(utc(2024, 5, 21), 51.5074, -0.1278);
  const minutes = d => d.getUTCHours() * 60 + d.getUTCMinutes();
  assert.ok(Math.abs(minutes(london.sunrise) - (3 * 60 + 43)) <= 2, london.sunrise.toISOString());
  assert.ok(Math.abs(minutes(london.sunset) - (20 * 60 + 21)) <= 2, london.sunset.toISOString());
  const eq = sunTimes(utc(2024, 2, 20), 0, 0);
  assert.ok(Math.abs(minutes(eq.sunrise) - (6 * 60 + 4)) <= 3 && Math.abs(minutes(eq.sunset) - (18 * 60 + 10)) <= 3);
  const polar = sunTimes(utc(2024, 5, 21), 78.2, 15.6); // Svalbard: midnight sun
  assert.deepEqual(polar, { sunrise: null, sunset: null });
});

test('sunrise and sunset agree with the app’s prayer engine for Dhaka (within 2 minutes)', () => {
  // The engine reports device-local clock times, so compare clock minutes (Dhaka = UTC+6) rather than instants: independent of the machine zone.
  const mine = sunTimes(new Date(Date.UTC(2026, 10, 12, 18, 0, 0)), 23.8103, 90.4125); // 00:00 in UTC+6
  const engine = calculatePrayerTimes(new Date(2026, 10, 13, 12), 23.8103, 90.4125, 360, { fajrAngle: 18, ishaAngle: 18, asrFactor: 2 });
  const dhakaMin = d => (((d.getUTCHours() * 60 + d.getUTCMinutes() + 360) % 1440) + 1440) % 1440;
  const localMin = d => d.getHours() * 60 + d.getMinutes();
  assert.ok(Math.abs(dhakaMin(mine.sunrise) - localMin(engine.sunrise)) <= 2, `${mine.sunrise.toISOString()} ${engine.sunrise}`);
  assert.ok(Math.abs(dhakaMin(mine.sunset) - localMin(engine.sunset)) <= 2, `${mine.sunset.toISOString()} ${engine.sunset}`);
});

test('moon position: Meeus example 47.a (12 April 1992) within the low-precision series’ tolerance (about 2 degrees)', () => {
  const e = moonEquatorial(utc(1992, 3, 12, 0, 0, 0));
  assert.ok(Math.abs(e.ra - 134.688) < 2.2, `ra ${e.ra}`);
  assert.ok(Math.abs(e.dec - 13.768) < 0.8, `dec ${e.dec}`);
  assert.ok(Math.abs(e.distance - 368410) < 6000, `distance ${e.distance}`);
});

test('moon rise and set around the full moon of 23 April 2024 (London): rises near sunset, sets near sunrise, culminates high in the south at night', () => {
  const lat = 51.5074, lon = -0.1278;
  const pass = moonPass(utc(2024, 3, 23, 21, 0), lat, lon);
  assert.equal(pass.up, true);
  const h = d => d.getUTCHours() + d.getUTCMinutes() / 60 + (d.getUTCDate() - 23) * 24;
  assert.ok(h(pass.rise) > 17.5 && h(pass.rise) < 20.5, `rise ${pass.rise.toISOString()} (sunset is 19:45 UTC)`);
  assert.ok(h(pass.set) > 28 && h(pass.set) < 30.5, `set ${pass.set.toISOString()} (sunrise is 04:50 UTC)`);
  const mid = new Date((pass.rise.getTime() + pass.set.getTime()) / 2);
  const p = moonPosition(mid, lat, lon);
  assert.ok(p.altitude > 18 && p.altitude < 32, `altitude ${p.altitude}`);
  assert.ok(Math.abs(p.azimuth - 180) < 12, `azimuth ${p.azimuth}`);
  assert.ok(moonPosition(pass.rise, lat, lon).altitude < -0.5 && moonPosition(new Date(pass.rise.getTime() + 1800000), lat, lon).altitude > -0.8);
  const f = passFraction(pass.rise, pass.set, mid);
  assert.ok(Math.abs(f - 0.5) < 1e-6);
});

test('moon pass when the moon is down: the next rise, then its set; a new moon rises and sets with the sun', () => {
  const lat = 23.8103, lon = 90.4125;
  const down = moonPass(utc(2026, 10, 13, 16, 0), lat, lon); // 22:00 in Dhaka, after moonset
  assert.equal(down.up, false);
  assert.ok(down.rise > utc(2026, 10, 13, 16, 0) && down.set > down.rise);
  const newMoon = sunTimes(utc(2026, 10, 9, 0, 0), lat, lon);
  const pass = moonPass(utc(2026, 10, 9, 8, 0), lat, lon);
  assert.ok(Math.abs(pass.rise - newMoon.sunrise) < 3 * 3600000, 'new moon rises near sunrise');
});

test('sun glow is strongest at the day’s highest point and dim at the horizon', () => {
  assert.equal(sunIntensity(48, 48), 1);
  assert.ok(sunIntensity(20, 48) < sunIntensity(40, 48));
  assert.ok(sunIntensity(2, 48) <= 0.4);
  assert.ok(sunIntensity(-5, 48) < 0.01);
});

test('moon drawing: full is a whole disc, new is empty, quarters have a straight terminator, waxing is lit on the right (mirrored in the south)', () => {
  assert.match(moonLitPath(0.5, true, 10, 10, 8), /A0 8 0 0 [01] 10 2Z$/, 'straight terminator at half');
  assert.match(moonLitPath(1, true, 10, 10, 8), /A8 8 0 0 1 10 2Z$/, 'full: the terminator is the far limb');
  assert.match(moonLitPath(0, true, 10, 10, 8), /A8 8 0 0 0 10 2Z$/, 'new: zero area');
  assert.match(moonLitPath(0.3, true, 10, 10, 8), /^M10 2A8 8 0 0 1 10 18A3.2 8 0 0 0 10 2Z$/, 'waxing crescent: lit on the right, thin');
  assert.match(moonLitPath(0.3, false, 10, 10, 8), /^M10 2A8 8 0 0 0 10 18A3.2 8 0 0 1 10 2Z$/, 'waning crescent: lit on the left');
  assert.equal(moonLitPath(0.3, true, 10, 10, 8, true), moonLitPath(0.3, false, 10, 10, 8), 'southern hemisphere mirrors');
});

const HZ = 100, APEX = 20, MARGIN = 10, WIDTH = 1010;

test('time axis: x is linear in time and the path is a smooth half-wave peaking at the middle', () => {
  for (const f of [0, 0.1, 0.25, 0.5, 0.9, 1]) assert.ok(Math.abs(timeArcPoint(f, WIDTH, HZ, APEX, MARGIN).x - (MARGIN + 990 * f)) < 1e-9);
  assert.equal(timeArcPoint(0, WIDTH, HZ, APEX, MARGIN).y, HZ);
  assert.ok(Math.abs(timeArcPoint(1, WIDTH, HZ, APEX, MARGIN).y - HZ) < 1e-9);
  assert.equal(timeArcPoint(0.5, WIDTH, HZ, APEX, MARGIN).y, APEX);
  assert.ok(timeArcPath(WIDTH, HZ, APEX, MARGIN).startsWith('M10 100L'));
});

test('forbidden zones: each zone’s width is exactly proportional to its real duration on the time axis', () => {
  const T = Date.UTC(2026, 10, 13, 0, 8, 0), MIN = 60000; // sunrise 06:08 Dhaka
  const rise = new Date(T), set = new Date(T + 10 * 3600000 + 48 * MIN); // a 10 h 48 min day
  const iv = [
    { key: 'sunrise', start: rise, end: new Date(T + 20 * MIN) },
    { key: 'zawal', start: new Date(T + 5 * 3600000 + 18 * MIN), end: new Date(T + 5 * 3600000 + 30 * MIN) },
    { key: 'sunset', start: new Date(set.getTime() - 15 * MIN), end: set }
  ];
  const zones = zoneSpans(iv, rise, set);
  assert.deepEqual(zones.map(z => z.key), ['sunrise', 'zawal', 'sunset']);
  const day = set - rise;
  const widths = zones.map(z => (WIDTH - 2 * MARGIN) * (z.f1 - z.f0));
  zones.forEach((z, i) => {
    const dur = iv[i].end - iv[i].start;
    assert.ok(Math.abs((z.f1 - z.f0) - dur / day) < 1e-12, `${z.key}: f-extent = duration / daylight`);
    assert.ok(Math.abs(widths[i] - (WIDTH - 2 * MARGIN) * dur / day) < 1e-9, `${z.key}: pixel width = duration share of the axis`);
  });
  // proportional across zones: width ratio equals duration ratio
  assert.ok(Math.abs(widths[0] / widths[1] - 20 / 12) < 1e-9);
  assert.ok(Math.abs(widths[2] / widths[1] - 15 / 12) < 1e-9);
  // and positioned where the sun is at that time: the sun at the start second sits at the zone's left edge
  zones.forEach((z, i) => assert.ok(Math.abs(timeArcPoint((iv[i].start - rise) / day, WIDTH, HZ, APEX, MARGIN).x - (MARGIN + (WIDTH - 2 * MARGIN) * z.f0)) < 1e-9));
  // the highlight path starts and ends exactly at the zone ends
  const d = zonePath(zones[1].f0, zones[1].f1, WIDTH, HZ, APEX, MARGIN);
  const first = d.match(/^M([\d.]+) ([\d.]+)/), last = d.match(/L([\d.]+) ([\d.]+)$/);
  assert.ok(Math.abs(Number(first[1]) - (MARGIN + (WIDTH - 2 * MARGIN) * zones[1].f0)) < 0.01);
  assert.ok(Math.abs(Number(last[1]) - (MARGIN + (WIDTH - 2 * MARGIN) * zones[1].f1)) < 0.01);
});

test('zones outside the daylight span are clipped and empty or invalid input gives no zones', () => {
  const rise = new Date(1000000), set = new Date(1000000 + 3600000);
  assert.deepEqual(zoneSpans([{ key: 'x', start: new Date(1000000 - 600000), end: new Date(1000000 + 360000) }], rise, set).map(z => [z.f0, z.f1]), [[0, 0.1]]);
  assert.deepEqual(zoneSpans([{ key: 'x', start: new Date(set.getTime() + 1), end: new Date(set.getTime() + 999) }], rise, set), []);
  assert.deepEqual(zoneSpans([], rise, set), []);
  assert.deepEqual(zoneSpans(null, rise, set), []);
  assert.deepEqual(zoneSpans([{ key: 'x', start: rise, end: set }], set, rise), []);
});

test('wiring: redesigned celestial observatory replaces the former sky scene in the same home position', () => {
  const html = readText('../index.html', import.meta.url);
  const app = readText('../src/app.js', import.meta.url);
  const css = readText('../src/styles.css', import.meta.url);
  const panel = html.slice(html.indexOf('id="skyPanel"'), html.indexOf('</section>', html.indexOf('id="skyPanel"')));
  assert.ok(html.indexOf('</header>') < html.indexOf('id="skyPanel"') && html.indexOf('id="skyPanel"') < html.indexOf('<main id="homeView">'), 'observatory stays between header and Home content');
  assert.equal((panel.match(/<svg\b/g) || []).length, 1, 'one compact SVG instrument');
  for (const id of ['skyArcDay','skyArcNight','skyMoonArc','skyMoonNightArc','skyZones','skySun','skyMoon','skyObservatoryFooter']) assert.ok(panel.includes(`id="${id}"`), `missing ${id}`);
  assert.match(panel, /CELESTIAL OBSERVATORY/);
  assert.match(panel, /skyObservatoryFooter/);
  assert.doesNotMatch(panel, /sky-cloud|sky-stars|skyStar8|skyGLive/, 'old sky scene is not retained');
  assert.match(css, /\.sky-panel \{[^}]*height:7\.4rem/s, 'slightly taller than the former banner, still compact');
  assert.match(css, /\.sky-zone-track/);
  assert.match(css, /\.sky-zone-chip\.is-active/);
  assert.match(app, /zoneSpans\(intervals, times\.sunrise, times\.sunset\)/, 'uses exact prohibited intervals from the shared rule engine');
  assert.match(app, /PROHIBITED_LABELS\[item\.key\]/, 'labels all three prohibited periods inside the panel');
  assert.match(app, /function nightArcPoint/);
  assert.match(app, /moonPass\(new Date\(now\.getTime\(\) - 24 \* 3600000\)/, 'moon is positioned below the horizon between its set and next rise');
  assert.match(app, /function updateSky\(force = false\)/);
  assert.match(app, /Math\.floor\(now\.getTime\(\) \/ 60000\)/, 'updates at minute resolution');
  assert.match(app, /if \(!force && key === lastSkyKey\) return;/, 'avoids unnecessary redraws');
  assert.doesNotMatch(app.slice(app.indexOf('function updateSky'), app.indexOf('function fardDisplayName')), /fetch\(|XMLHttpRequest|https?:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.sky-body \{ transition:none; \} \}/);
});
