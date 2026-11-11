export function geographicTicks(minimum, maximum) {
  const ticks = [];
  // The phase belongs to geographic coordinates, never to the viewport edge.
  const first = Math.ceil((minimum * 3600 - 1e-7) / 10) * 10;
  for (let seconds = first; seconds <= maximum * 3600 + 1e-7; seconds += 10) {
    ticks.push({ seconds, value: seconds / 3600, major: seconds % 60 === 0 });
  }
  return ticks;
}

export function geographicLabel(seconds, axis) {
  const value = Math.abs(seconds);
  const degrees = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60);
  const hemisphere = axis === 'lat' ? (seconds < 0 ? 'S' : 'N') : (seconds < 0 ? 'W' : 'E');
  const remainder = value % 60;
  return `${degrees}° ${String(minutes).padStart(2, '0')}′${remainder ? ` ${String(remainder).padStart(2, '0')}″` : ''} ${hemisphere}`;
}

export function createGeographicFrame(map, svg) {
  const outer = svg.parentElement;
  const f = value => Number(value.toFixed(2));
  const line = (x1, y1, x2, y2, major) => `<line class="frame-tick ${major ? 'major' : 'minor'}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
  const text = (x, y, label, angle = 0) => `<text x="${f(x)}" y="${f(y)}"${angle ? ` transform="rotate(${angle} ${f(x)} ${f(y)})"` : ''}>${label}</text>`;
  const bar = (x, y, width, height, minute) => `<rect class="frame-minute-bar ${minute % 2 === 0 ? 'light' : 'dark'}" x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(height)}"/>`;

  return { draw() {
    const box = outer.getBoundingClientRect(), chart = map.getContainer().getBoundingClientRect();
    if (!box.width || !chart.width || !chart.height) return;
    const left = chart.left - box.left, top = chart.top - box.top;
    const right = left + chart.width, bottom = top + chart.height;
    const bounds = map.getBounds();
    const xAt = value => left + map.latLngToContainerPoint([bounds.getSouth(), value]).x;
    const yAt = value => top + map.latLngToContainerPoint([value, bounds.getWest()]).y;
    const longitudeTicks = geographicTicks(bounds.getWest(), bounds.getEast());
    const latitudeTicks = geographicTicks(bounds.getSouth(), bounds.getNorth());
    const longitudeLabels = longitudeTicks.filter(tick => tick.major);
    const latitudeLabels = latitudeTicks.filter(tick => tick.major && yAt(tick.value) > top + 30 && yAt(tick.value) < bottom - 30);
    // A narrow viewport may contain only part of a minute. Keep at least one
    // labelled 10-second reference so that even this cropped sheet is usable.
    if (!longitudeLabels.length && longitudeTicks.length) longitudeLabels.push([...longitudeTicks].sort((a, b) => Math.abs(xAt(a.value) - (left + right) / 2) - Math.abs(xAt(b.value) - (left + right) / 2))[0]);
    if (!latitudeLabels.length && latitudeTicks.length) latitudeLabels.push([...latitudeTicks].sort((a, b) => Math.abs(yAt(a.value) - (top + bottom) / 2) - Math.abs(yAt(b.value) - (top + bottom) / 2))[0]);
    let horizontal = '', vertical = '';

    for (let minute = Math.floor(bounds.getWest() * 60); minute <= Math.ceil(bounds.getEast() * 60); minute++) {
      const x1 = Math.max(left, xAt(minute / 60)), x2 = Math.min(right, xAt((minute + 1) / 60));
      if (x2 > x1) horizontal += bar(x1, top - 4, x2 - x1, 3, minute) + bar(x1, bottom + 1, x2 - x1, 3, minute);
    }
    for (const tick of longitudeTicks) {
      const x = xAt(tick.value), length = tick.major ? 10 : 6;
      horizontal += line(x, top - length, x, top, tick.major) + line(x, bottom, x, bottom + length, tick.major);
      if (longitudeLabels.includes(tick)) {
        const label = geographicLabel(tick.seconds, 'lng');
        horizontal += text(x, top - 18, label) + text(x, bottom + 18, label);
      }
    }
    for (let minute = Math.floor(bounds.getSouth() * 60); minute <= Math.ceil(bounds.getNorth() * 60); minute++) {
      const y1 = Math.max(top, yAt((minute + 1) / 60)), y2 = Math.min(bottom, yAt(minute / 60));
      if (y2 > y1) vertical += bar(left - 4, y1, 3, y2 - y1, minute) + bar(right + 1, y1, 3, y2 - y1, minute);
    }
    for (const tick of latitudeTicks) {
      const y = yAt(tick.value), length = tick.major ? 10 : 6;
      vertical += line(left - length, y, left, y, tick.major) + line(right, y, right + length, y, tick.major);
      if (latitudeLabels.includes(tick)) {
        const label = geographicLabel(tick.seconds, 'lat');
        vertical += text(left - 18, y, label, -90) + text(right + 18, y, label, 90);
      }
    }
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.innerHTML = `<rect class="frame-outline" x="${f(left)}" y="${f(top)}" width="${f(chart.width)}" height="${f(chart.height)}"/><g class="frame-longitude">${horizontal}</g><g class="frame-latitude">${vertical}</g>`;
  } };
}
