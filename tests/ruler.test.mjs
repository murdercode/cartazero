import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createGeo } from '../dist/geo.js';
import { rulerCell, rulerSteps } from '../dist/ruler.js';

const sandbox = {};
vm.runInNewContext(readFileSync(new URL('../dist/vendor/proj4.js', import.meta.url), 'utf8'), sandbox);
const geo = createGeo(sandbox.proj4);
const near = (a, b, tolerance = .000001) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('UTM ruler anchors to the southwest corner of the hovered kilometre square', () => {
  const point = geo.fromUTM({ e: 381425, n: 4699765 });
  const cell = rulerCell(point, 'utm', geo);
  assert.equal(cell.x, 381000); assert.equal(cell.y, 4699000);
  near(cell.offsetX, 425); near(cell.offsetY, 765);
  const corner = geo.toUTM(cell.point(0, 0));
  const east = geo.toUTM(cell.point(25, 0));
  const north = geo.toUTM(cell.point(0, 25));
  near(east.e - corner.e, 25); near(north.n - corner.n, 25);
  near(east.n, corner.n); near(north.e, corner.e);
});

test('crossing a UTM grid line moves the origin to the adjacent square', () => {
  const before = rulerCell(geo.fromUTM({ e: 381999.99, n: 4699999.99 }), 'utm', geo);
  const after = rulerCell(geo.fromUTM({ e: 382000.01, n: 4700000.01 }), 'utm', geo);
  assert.equal(after.x - before.x, 1000); assert.equal(after.y - before.y, 1000);
  near(before.offsetX, 999.99); near(after.offsetX, .01);
});

test('geographic ruler uses arc seconds within the current minute, with latitude increasing upwards', () => {
  const cell = rulerCell({ lat: 42.442, lng: 13.558 }, 'geo', geo);
  assert.equal(cell.span, 60); assert.equal(cell.unit, '″');
  near(cell.offsetX, 28.8); near(cell.offsetY, 31.2);
  near(cell.point(0, 0).lat, 42 + 26 / 60);
  near(cell.point(0, 0).lng, 13 + 33 / 60);
  near(cell.point(60, 60).lat, 42 + 27 / 60);
  near(cell.point(60, 60).lng, 13 + 34 / 60);
});

test('graduations remain legible across screen calibrations', () => {
  assert.deepEqual(rulerSteps(151, 1000), { minor: 25, major: 200 });
  assert.deepEqual(rulerSteps(207, 60), { minor: 1, major: 10 });
  for (const length of [36, 70, 151, 250, 600]) for (const span of [60, 1000]) {
    const { minor, major } = rulerSteps(length, span);
    assert.ok(minor * length / span >= 2.5);
    assert.ok(major * length / span >= 30);
    assert.equal(span % minor, 0); assert.equal(span % major, 0);
  }
});
