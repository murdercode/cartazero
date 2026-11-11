import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geographicTicks, geographicLabel } from '../dist/geographic-frame.js';

test('geographic frame includes exact minute boundaries despite floating point degrees', () => {
  const ticks = geographicTicks(42 + 26 / 60, 42 + 27 / 60);
  assert.equal(ticks.length, 7);
  assert.equal(ticks[0].seconds, 152760);
  assert.equal(ticks.at(-1).seconds, 152820);
  assert.ok(ticks[0].major && ticks.at(-1).major);
});

test('panning a fractional viewport preserves absolute ten-second graduation positions', () => {
  const a = geographicTicks(13.558, 13.571);
  const b = geographicTicks(13.559, 13.572);
  assert.equal(a[0].seconds, 48810);
  assert.equal(b[0].seconds, 48820);
  assert.deepEqual(a.slice(1).map(t => t.seconds), b.map(t => t.seconds));
  for (const tick of a) assert.equal(tick.major, tick.seconds % 60 === 0);
});

test('frame labels distinguish longitude and latitude and carry across degree boundaries', () => {
  assert.equal(geographicLabel(13 * 3600 + 59 * 60, 'lng'), '13° 59′ E');
  assert.equal(geographicLabel(14 * 3600, 'lng'), '14° 00′ E');
  assert.equal(geographicLabel(42 * 3600 + 26 * 60, 'lat'), '42° 26′ N');
  assert.equal(geographicLabel(42 * 3600 + 26 * 60 + 30, 'lat'), '42° 26′ 30″ N');
});
