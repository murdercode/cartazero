import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAngle, rotatedAngle } from '../dist/physical-ruler.js';

test('free rotation crosses the atan2 seam without turning the ruler around', () => {
  assert.equal(rotatedAngle(20, 179, -179), 22);
  assert.equal(rotatedAngle(20, -179, 179), 18);
  assert.equal(rotatedAngle(-175, 15, 5), 175);
  assert.equal(normalizeAngle(720 + 13.5), 13.5);
});

test('fine rotation stays continuous and snapping only happens when requested', () => {
  assert.ok(Math.abs(rotatedAngle(0, 10, 12.3) - 2.3) < 1e-9);
  assert.equal(rotatedAngle(0, 10, 12.3, true), 0);
  assert.equal(rotatedAngle(90, 10, 13.3, true), 95);
});
