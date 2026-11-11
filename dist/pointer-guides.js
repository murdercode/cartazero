export function createPointerGuides(map, geo, getSystem, svg) {
  const surface = map.getContainer().parentElement;
  let lastPoint = null, lastClient = null, inside = false, dragging = false, keyboard = false, frame = 0;
  const visible = value => svg.toggleAttribute('hidden', !value);

  function draw() {
    frame = 0;
    const size = map.getSize();
    if (keyboard) lastPoint = { x: size.x / 2, y: size.y / 2 };
    else if (lastClient) {
      const rect = map.getContainer().getBoundingClientRect();
      lastPoint = { x: lastClient.x - rect.left, y: lastClient.y - rect.top };
    }
    if (!inside || dragging || !lastPoint || lastPoint.x < 0 || lastPoint.y < 0 || lastPoint.x > size.x || lastPoint.y > size.y) { visible(false); return; }
    let east = { x: 1, y: 0 }, north = { x: 0, y: -1 };
    if (getSystem() === 'utm') {
      const point = map.containerPointToLatLng(lastPoint), coordinate = geo.toUTM(point);
      // Public CRS projection preserves sub-pixel precision; use local UTM
      // tangents so the guides follow grid convergence across Abruzzo.
      const project = (e, n) => map.project(geo.fromUTM({ e, n }), map.getZoom());
      const west = project(coordinate.e - 100, coordinate.n), right = project(coordinate.e + 100, coordinate.n);
      const south = project(coordinate.e, coordinate.n - 100), top = project(coordinate.e, coordinate.n + 100);
      east = { x: right.x - west.x, y: right.y - west.y };
      north = { x: top.x - south.x, y: top.y - south.y };
    }
    const extent = Math.hypot(size.x, size.y) * 2;
    const line = (axis, name) => {
      const length = Math.hypot(axis.x, axis.y), dx = axis.x / length * extent, dy = axis.y / length * extent;
      return `<line class="pointer-guide-${name}" x1="${(lastPoint.x - dx).toFixed(2)}" y1="${(lastPoint.y - dy).toFixed(2)}" x2="${(lastPoint.x + dx).toFixed(2)}" y2="${(lastPoint.y + dy).toFixed(2)}"/>`;
    };
    svg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`);
    svg.setAttribute('data-system', getSystem());
    svg.innerHTML = line(east, 'east') + line(north, 'north');
    visible(true);
  }

  function refresh() { if (!frame) frame = requestAnimationFrame(draw); }
  function locate(event) {
    if (event.target.closest('.scale-card, .tile-message, .leaflet-control')) { inside = false; visible(false); return; }
    const rect = map.getContainer().getBoundingClientRect();
    lastClient = { x: event.clientX, y: event.clientY };
    lastPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    inside = true; keyboard = false; map.getContainer().classList.remove('pointer-keyboard'); refresh();
  }
  // Capture observes the pointer over both movable rulers without intercepting
  // their dragging, rotation, or clicks through the fixed rulers.
  surface.addEventListener('pointermove', locate, { capture: true, passive: true });
  surface.addEventListener('pointerdown', locate, { capture: true, passive: true });
  surface.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') { inside = false; visible(false); } });
  surface.addEventListener('pointercancel', () => { inside = false; visible(false); });
  map.on('dragstart', () => { dragging = true; visible(false); });
  map.on('dragend', () => { dragging = false; refresh(); });
  map.on('moveend zoomend resize', refresh);
  map.on('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.originalEvent.key)) {
      const size = map.getSize(); lastPoint = { x: size.x / 2, y: size.y / 2 }; inside = true; keyboard = true; map.getContainer().classList.add('pointer-keyboard'); refresh();
    }
  });
  map.getContainer().addEventListener('blur', () => { if (keyboard) { inside = false; visible(false); } });
  return { refresh };
}
