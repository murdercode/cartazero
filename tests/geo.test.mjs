import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { AREAS, DEFAULT_PPM, createGeo, distance, formatAngle, gradeAnswer, mapMillimetres, parseAngle, scaleZoom } from '../dist/geo.js';

const sandbox = {};
vm.runInNewContext(readFileSync(new URL('../dist/vendor/proj4.js', import.meta.url), 'utf8'), sandbox);
const geo = createGeo(sandbox.proj4);
function near(actual, expected, tolerance = 1e-7) { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`); }

test('UTM 33N has the correct origin and axis order', () => {
  const point = geo.toUTM({ lat: 0, lng: 15 });
  near(point.e, 500000, .00001); near(point.n, 0);
});

test('Abruzzo coordinates match independent PROJ cs2cs reference values', () => {
  // PROJ cs2cs: +proj=longlat +datum=WGS84 +to +proj=utm +zone=33 +datum=WGS84
  for (const [lng, lat, e, n] of [
    [13.558, 42.442, 381405.85465305, 4699860.10210662],
    [13.399, 42.35, 368136.43326596, 4689878.77201505],
    [14.039, 42.067, 420495.41983382, 4657661.94561386],
    [13.975, 41.771, 414807.74307827, 4624858.78409802],
  ]) {
    const actual = geo.toUTM({ lat, lng });
    near(actual.e, e, .001); near(actual.n, n, .001);
  }
});

test('all Abruzzo areas survive the WGS84 / UTM round trip', () => {
  for (const area of AREAS) {
    const point = geo.toUTM(area);
    assert.ok(point.e > 300000 && point.e < 500000);
    assert.ok(point.n > 4600000 && point.n < 4800000);
    const restored = geo.fromUTM(point);
    near(restored.lat, area.lat); near(restored.lng, area.lng);
  }
});

test('DMS, DM and decimal degrees accept Italian decimal commas', () => {
  near(parseAngle('42 26 31,2', 'dms', 'lat'), 42.442);
  near(parseAngle('42° 26′ 31.2″', 'dms', 'lat'), 42.442);
  near(parseAngle('13 33,480', 'dm', 'lng'), 13.558);
  near(parseAngle('42,44200', 'dd', 'lat'), 42.442);
});

test('invalid coordinates and malformed input are rejected', () => {
  for (const value of ['', '42 60 0', '42 20 60', '42.5 20 0', '42 20.5 0', '-42 20 0', '42 20', '42 20 nope', '91 0 0']) {
    assert.throws(() => parseAngle(value, 'dms', 'lat'), undefined, value);
  }
  for (const value of ['NaN', 'Infinity', '42foo', '42,4,4', '-1', '91']) assert.throws(() => parseAngle(value, 'dd', 'lat'));
});

test('display rounding carries seconds and minutes into the next degree', () => {
  assert.equal(formatAngle(42 + 59 / 60 + 59.99 / 3600, 'dms', 'lat'), '43° 00′ 00,0″ N');
  assert.equal(formatAngle(13 + 59.9999 / 60, 'dm', 'lng'), '14° 00,000′ E');
  for (const area of AREAS) for (const format of ['dms', 'dm', 'dd']) {
    const restored = { lat: parseAngle(formatAngle(area.lat, format, 'lat', false), format, 'lat'), lng: parseAngle(formatAngle(area.lng, format, 'lng', false), format, 'lng') };
    assert.ok(distance(area, restored) < 2);
  }
});

test('grading uses ground distance and the chosen tolerance', () => {
  const target = AREAS[0], origin = geo.toUTM(target);
  const close = geo.fromUTM({ e: origin.e + 24, n: origin.n });
  const far = geo.fromUTM({ e: origin.e + 80, n: origin.n });
  assert.equal(gradeAnswer(target, target, 25).correct, true);
  assert.equal(gradeAnswer(target, close, 25).correct, true);
  assert.equal(gradeAnswer(target, far, 50).correct, false);
  assert.equal(gradeAnswer(target, far, 100).correct, true);
  near(mapMillimetres(25), 1); near(mapMillimetres(1000), 40);
});

test('1:25000 zoom follows latitude and screen calibration', () => {
  for (const area of AREAS) {
    const zoom = scaleZoom(area.lat);
    const groundMpp = 156543.03392804097 * Math.cos(area.lat * Math.PI / 180) / 2 ** zoom;
    near(groundMpp * DEFAULT_PPM * 10, 250);
    near(scaleZoom(area.lat, DEFAULT_PPM * 2), zoom + 1);
  }
});
