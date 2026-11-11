// Graduations are defined in map coordinates, so they follow calibration,
// grid convergence and latitude rather than a fixed screen pixel interval.
export function rulerCell(point, system, geo) {
  const utm = system === 'utm';
  const coordinate = utm ? geo.toUTM(point) : { e: point.lng * 3600, n: point.lat * 3600 };
  const span = utm ? 1000 : 60;
  const x = Math.floor(coordinate.e / span) * span;
  const y = Math.floor(coordinate.n / span) * span;
  return {
    x, y, span, unit: utm ? 'm' : '″',
    offsetX: coordinate.e - x, offsetY: coordinate.n - y,
    point(e, n) { return utm ? geo.fromUTM({ e: x + e, n: y + n }) : { lng: (x + e) / 3600, lat: (y + n) / 3600 }; },
  };
}

export function rulerSteps(length, span) {
  const minorOptions = span === 1000 ? [25, 50, 100, 200, 500, 1000] : [1, 2, 5, 10, 20, 30, 60];
  const majorOptions = span === 1000 ? [200, 500, 1000] : [10, 20, 30, 60];
  return {
    minor: minorOptions.find(step => step * length / span >= 2.5) ?? span,
    major: majorOptions.find(step => step * length / span >= 30) ?? span,
  };
}

export function createMapRuler(map, geo, getSystem, svg) {
  let enabled = true, inside = false, dragging = false, lastPoint = null, frame = 0;
  const container = map.getContainer();
  const f = value => Number(value.toFixed(2));
  const pair = point => `${f(point.x)},${f(point.y)}`;
  const project = point => map.latLngToContainerPoint(point);
  const visible = value => svg.toggleAttribute('hidden', !value);
  const line = (a, b, className) => `<path class="${className}" d="M${pair(a)}L${pair(b)}"/>`;
  const offset = (point, normal, amount) => ({ x: point.x + normal.x * amount, y: point.y + normal.y * amount });

  function axis(cell, vertical) {
    const start = project(cell.point(0, 0));
    const end = project(cell.point(vertical ? 0 : cell.span, vertical ? cell.span : 0));
    const inward = project(cell.point(vertical ? 10 : 0, vertical ? 0 : 10));
    const norm = Math.hypot(inward.x - start.x, inward.y - start.y);
    const normal = { x: (inward.x - start.x) / norm, y: (inward.y - start.y) / norm };
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = rulerSteps(length, cell.span);
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    let markup = `<polygon class="ruler-tape" points="${pair(start)} ${pair(end)} ${pair(offset(end, normal, 23))} ${pair(offset(start, normal, 23))}"/>`;
    markup += line(start, end, 'ruler-baseline');
    // Subdivide at both the minor and major intervals (e.g. 100 m ticks
    // and 500 m labels when the user calibrates a particularly small scale).
    const values = new Set([0, cell.span]);
    for (let value = steps.minor; value < cell.span; value += steps.minor) values.add(value);
    for (let value = steps.major; value < cell.span; value += steps.major) values.add(value);
    for (const value of [...values].sort((a, b) => a - b)) {
      const major = value % steps.major === 0 || value === cell.span;
      const medium = value % (cell.span === 1000 ? 100 : 5) === 0;
      const p = project(cell.point(vertical ? 0 : value, vertical ? value : 0));
      markup += line(p, offset(p, normal, major ? 9 : medium ? 6 : 3), 'ruler-tick');
      if (major && value !== 0) {
        const label = offset(p, normal, 16);
        const text = `${value}${value === cell.span ? ` ${cell.unit}` : ''}`;
        markup += `<text x="${f(label.x)}" y="${f(label.y)}" transform="rotate(${f(angle)} ${f(label.x)} ${f(label.y)})">${text}</text>`;
      }
    }
    return { markup, normal };
  }

  function draw() {
    frame = 0;
    if (!enabled || !inside || dragging || !lastPoint) { visible(false); return; }
    const size = map.getSize();
    if (lastPoint.x < 0 || lastPoint.y < 0 || lastPoint.x > size.x || lastPoint.y > size.y) { visible(false); return; }
    const point = map.containerPointToLatLng(lastPoint);
    const cell = rulerCell(point, getSystem(), geo);
    const h = axis(cell, false), v = axis(cell, true);
    const south = project(cell.point(cell.offsetX, 0));
    const west = project(cell.point(0, cell.offsetY));
    const cursor = project(point);
    const zero = offset(offset(project(cell.point(0, 0)), h.normal, 15), v.normal, 11);
    svg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`);
    svg.setAttribute('data-system', getSystem());
    svg.innerHTML = `<g class="ruler-guides"><path d="M${pair(west)}L${pair(cursor)}L${pair(south)}"/></g>${h.markup}${v.markup}<text x="${f(zero.x)}" y="${f(zero.y)}">0</text>${line(south, offset(south, h.normal, 23), 'ruler-index')}${line(west, offset(west, v.normal, 23), 'ruler-index')}<circle class="ruler-cursor" cx="${f(cursor.x)}" cy="${f(cursor.y)}" r="2.5"/>`;
    visible(true);
  }

  function refresh() { if (!frame) frame = requestAnimationFrame(draw); }
  function locate(event) {
    // The overlay does not intercept clicks or map dragging.
    const rect = container.getBoundingClientRect();
    lastPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    inside = true;
    if (event.buttons && event.pointerType !== 'touch') { visible(false); return; }
    refresh();
  }
  container.addEventListener('pointermove', locate);
  container.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') locate(event); });
  container.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'touch') { inside = false; visible(false); }
  });
  container.addEventListener('pointercancel', () => { inside = false; visible(false); });
  map.on('dragstart', () => { dragging = true; visible(false); });
  map.on('dragend', () => { dragging = false; refresh(); });
  map.on('moveend zoomend resize', refresh);
  map.on('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.originalEvent.key)) {
      const size = map.getSize(); lastPoint = { x: size.x / 2, y: size.y / 2 }; inside = true; refresh();
    }
  });
  container.addEventListener('blur', () => { inside = false; visible(false); });
  return { setEnabled(value) { enabled = value; if (!enabled) visible(false); else refresh(); }, refresh };
}
