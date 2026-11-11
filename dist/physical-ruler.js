// A physical screen ruler. This module deliberately has no map/projection
// dependency: its graduations are always millimetres, whatever is underneath.
export const RULER_MM = 100;
export const RULER_MARGIN_MM = 8;
export const RULER_HEIGHT_MM = 18;

export function normalizeAngle(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function rotatedAngle(origin, start, current, snap = false) {
  const angle = origin + normalizeAngle(current - start);
  return normalizeAngle(snap ? Math.round(angle / 5) * 5 : Math.round(angle * 10) / 10);
}

export function rulerMarkup() {
  let markup = '<rect class="normal-ruler-body" x="0.2" y="0.2" width="115.6" height="17.6" rx="1.2"/>';
  for (let mm = 0; mm <= RULER_MM; mm++) {
    const x = RULER_MARGIN_MM + mm;
    const depth = mm % 10 === 0 ? 6 : mm % 5 === 0 ? 4.4 : 2.8;
    markup += `<path class="normal-ruler-tick" d="M${x},0.3V${depth}"/>`;
    if (mm % 10 === 0) markup += `<text class="normal-ruler-number" x="${x}" y="8.4">${mm / 10}</text>`;
  }
  return markup + '<text class="normal-ruler-unit" x="3.7" y="12.5">cm</text><text class="normal-ruler-brand" x="58" y="14.5">cartine. · 10 cm</text><circle class="normal-ruler-hole" cx="112" cy="12" r="1.4"/>';
}

export function createPhysicalRuler({ container, boundary = container, element, controls, pixelsPerMm, perpendicular = false }) {
  let ppm = pixelsPerMm, enabled = false, initialized = false, fixed = false, gesture = null;
  let position = { x: 0, y: 0, angle: 0 };
  const grip = element.querySelector('.normal-ruler-grip');
  const handle = element.querySelector('.normal-ruler-turn');
  const angleInput = controls.querySelector('[data-ruler-control="angle"]');
  const lockButton = controls.querySelector('[data-ruler-control="lock"]');
  grip.innerHTML = `<svg viewBox="0 0 116 18" aria-hidden="true">${rulerMarkup()}</svg>`;

  function activate() {
    element.parentElement.querySelectorAll('.normal-ruler').forEach(item => item.classList.toggle('active', item === element));
  }

  function render(updateAngleInput = true) {
    element.style.width = `${(RULER_MM + RULER_MARGIN_MM * 2) * ppm}px`;
    element.style.height = `${RULER_HEIGHT_MM * ppm}px`;
    element.style.left = `${position.x - RULER_MARGIN_MM * ppm}px`;
    element.style.top = `${position.y}px`;
    element.style.transformOrigin = `${RULER_MARGIN_MM * ppm}px 0px`;
    element.style.transform = `rotate(${position.angle}deg)`;
    element.classList.toggle('fixed', fixed);
    if (updateAngleInput) angleInput.value = String(Math.round(position.angle * 10) / 10);
    angleInput.disabled = fixed;
    controls.querySelectorAll('[data-ruler-angle]').forEach(button => { button.disabled = fixed; });
    lockButton.setAttribute('aria-pressed', fixed);
    lockButton.textContent = fixed ? 'Sblocca' : 'Fissa';
    grip.tabIndex = fixed ? -1 : 0;
    handle.tabIndex = fixed ? -1 : 0;
    element.dataset.angle = String(position.angle);
  }

  function center() {
    const width = container.clientWidth, height = container.clientHeight;
    const narrow = width < (RULER_MM + 2 * RULER_MARGIN_MM) * ppm + 60;
    const vertical = perpendicular ? !narrow : narrow;
    position = vertical
      ? { x: width * .58, y: Math.max(40, (height - RULER_MM * ppm) / 2), angle: 90 }
      : { x: Math.max(40, (width - RULER_MM * ppm) / 2), y: height * .55, angle: 0 };
    initialized = true; render();
  }

  function keepZeroOnPaper() {
    // The zero can cross the map edge into the surrounding paper margin.
    // Keep it reachable there, including when the ruler is rotated.
    const origin = container.getBoundingClientRect();
    const paper = boundary.getBoundingClientRect();
    position.x = Math.max(paper.left - origin.left + 12, Math.min(paper.right - origin.left - 12, position.x));
    position.y = Math.max(paper.top - origin.top + 12, Math.min(paper.bottom - origin.top - 12, position.y));
  }

  function pointerAngle(event) {
    const rect = container.getBoundingClientRect();
    return Math.atan2(event.clientY - rect.top - position.y, event.clientX - rect.left - position.x) * 180 / Math.PI;
  }

  function begin(event, kind) {
    if (fixed || event.button > 0) return;
    activate();
    event.preventDefault(); event.stopPropagation();
    const target = kind === 'turn' ? handle : grip;
    gesture = { kind, id: event.pointerId, clientX: event.clientX, clientY: event.clientY, origin: { ...position }, startAngle: pointerAngle(event), target };
    target.setPointerCapture(event.pointerId);
    element.classList.add('moving');
    target.focus({ preventScroll: true });
  }

  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    event.preventDefault(); event.stopPropagation();
    if (gesture.kind === 'move') {
      position.x = gesture.origin.x + event.clientX - gesture.clientX;
      position.y = gesture.origin.y + event.clientY - gesture.clientY;
      keepZeroOnPaper();
    } else {
      position.angle = rotatedAngle(gesture.origin.angle, gesture.startAngle, pointerAngle(event), event.shiftKey);
    }
    render();
  }

  function end(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const target = gesture.target;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    gesture = null; element.classList.remove('moving');
  }

  grip.addEventListener('pointerdown', event => begin(event, 'move'));
  handle.addEventListener('pointerdown', event => begin(event, 'turn'));
  for (const target of [grip, handle]) {
    target.addEventListener('focus', activate);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
    target.addEventListener('lostpointercapture', event => { if (gesture?.id === event.pointerId) { gesture = null; element.classList.remove('moving'); } });
    target.addEventListener('keydown', event => {
      if (fixed) return;
      const distance = event.shiftKey ? 10 : 1;
      const rotation = event.shiftKey ? 5 : 1;
      const key = event.key.toLowerCase();
      if (key === 'arrowleft') position.x -= distance;
      else if (key === 'arrowright') position.x += distance;
      else if (key === 'arrowup') position.y -= distance;
      else if (key === 'arrowdown') position.y += distance;
      else if (key === 'q') position.angle = normalizeAngle(position.angle - rotation);
      else if (key === 'e') position.angle = normalizeAngle(position.angle + rotation);
      else return;
      event.preventDefault(); event.stopPropagation(); keepZeroOnPaper(); render();
    });
  }
  controls.querySelectorAll('[data-ruler-angle]').forEach(button => button.addEventListener('click', () => { position.angle = Number(button.dataset.rulerAngle); render(); }));
  angleInput.addEventListener('input', () => {
    const value = Number(angleInput.value);
    if (angleInput.value.trim() && Number.isFinite(value)) { position.angle = normalizeAngle(value); render(false); }
  });
  angleInput.addEventListener('change', () => { const value = Number(angleInput.value); if (angleInput.value.trim() && Number.isFinite(value)) position.angle = normalizeAngle(value); render(); });
  controls.addEventListener('pointerdown', activate);
  controls.addEventListener('focusin', activate);
  controls.querySelector('[data-ruler-control="center"]').addEventListener('click', center);
  lockButton.addEventListener('click', () => { fixed = !fixed; render(); });
  new ResizeObserver(() => { if (enabled && initialized && container.clientWidth > 0 && container.clientHeight > 0) { keepZeroOnPaper(); render(); } }).observe(container);

  return {
    setEnabled(value) {
      enabled = value;
      element.parentElement.hidden = !enabled; controls.hidden = !enabled;
      if (enabled && !initialized) center();
    },
    // Screen calibration is shared with the map so a real centimetre remains
    // a centimetre. It never depends on a grid interval or coordinate system.
    setCalibration(value) { if (ppm !== value) { ppm = value; if (initialized) render(); } },
  };
}
