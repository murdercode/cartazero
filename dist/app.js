import { AREAS, DEFAULT_PPM, createGeo, decimalNumber, distance, formatAngle, gradeAnswer, parseAngle, scaleZoom } from './geo.js';
import { createMapRuler } from './ruler.js?v=1.1.0';
import { createPhysicalRuler } from './physical-ruler.js?v=1.7.0';
import { createPointerGuides } from './pointer-guides.js?v=1.4.0';
import { createGeographicFrame } from './geographic-frame.js?v=1.5.0';

const $ = id => document.getElementById(id);
const geo = createGeo(window.proj4);
const number = n => Math.round(n).toLocaleString('fr-FR');
const compact = n => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const STORAGE = 'cartine-abruzzo-v1';
const HISTORY = 'cartine-abruzzo-history-v1';
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The exercises also work with storage disabled. */ } }
const saved = readStorage(STORAGE, {});
let history = readStorage(HISTORY, []);
if (!Array.isArray(history)) history = [];
history = history.filter(x => x && ['correct', 'fail', 'skipped'].includes(x.status) && (x.error === null || (Number.isFinite(x.error) && x.error >= 0))).slice(-500);
const state = {
  mode: ['find', 'read'].includes(saved.mode) ? saved.mode : 'find',
  system: ['utm', 'geo'].includes(saved.system) ? saved.system : 'utm',
  format: ['dms', 'dm', 'dd'].includes(saved.format) ? saved.format : 'dms',
  area: AREAS.find(a => a.id === saved.area) || AREAS[0],
  tolerance: [25, 50, 100].includes(saved.tolerance) ? saved.tolerance : 50,
  ppm: Number.isFinite(saved.ppm) && saved.ppm >= .9 && saved.ppm <= 15 ? saved.ppm : DEFAULT_PPM,
  calibrated: saved.calibrated === true,
  grid: saved.grid !== false,
  rulerMode: ['normal', 'grid', 'off'].includes(saved.rulerMode) ? saved.rulerMode : 'normal',
  target: null, answer: null, resolved: false, exercise: 0,
};
function saveSettings() { writeStorage(STORAGE, { ...state, area: state.area.id, target: undefined, answer: undefined, exercise: undefined, resolved: undefined }); }

const map = L.map('map', {
  zoomControl: false, zoomSnap: 0, zoomDelta: .1,
  scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false,
  zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
  minZoom: 10, maxZoom: 18,
  maxBounds: [[41.55, 13.0], [43.0, 14.95]], maxBoundsViscosity: .8,
  keyboard: true, keyboardPanDelta: 35,
}).setView(state.area, scaleZoom(state.area.lat, state.ppm));
map.attributionControl.setPrefix(false);
$('map-attribution').append(map.attributionControl.getContainer());
const layers = {
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 17, maxZoom: 18, noWrap: true, updateWhenIdle: true,
    attribution: 'Dati © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>, SRTM · Carta © <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC BY-SA</a>)',
  }),
  osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19, maxZoom: 18, noWrap: true, updateWhenIdle: true,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  }),
};
let base = 'topo';
layers.topo.addTo(map);
let tileErrors = 0;
for (const [id, layer] of Object.entries(layers)) {
  layer.on('tileerror', () => { if (base === id && ++tileErrors >= 3) {
    $('tile-message').hidden = false;
    $('tile-message').firstChild.textContent = id === 'topo' ? 'Le tessere topografiche non rispondono. ' : 'La carta non è disponibile. Controlla la connessione. ';
    $('fallback-button').hidden = id !== 'topo';
  } });
  layer.on('tileload', () => { if (base === id) { tileErrors = 0; $('tile-message').hidden = true; } });
}
const gridLayer = L.layerGroup().addTo(map);
const exerciseLayer = L.layerGroup().addTo(map);
let answerMarker = null;
let adjustingScale = false;
const ruler = createMapRuler(map, geo, () => 'utm', $('map-ruler'));
const geographicFrame = createGeographicFrame(map, $('geographic-frame'));
const normalRuler = createPhysicalRuler({ container: $('physical-ruler-layer'), boundary: $('map-wrap'), element: $('physical-ruler'), controls: $('physical-ruler-controls'), pixelsPerMm: state.ppm });
const blueRuler = createPhysicalRuler({ container: $('physical-ruler-layer'), boundary: $('map-wrap'), element: $('blue-ruler'), controls: $('blue-ruler-controls'), pixelsPerMm: state.ppm, perpendicular: true });
const pointerGuides = createPointerGuides(map, geo, () => state.system, $('pointer-guides'));

function scaleAndGrid() {
  const lat = map.getCenter().lat;
  const desired = scaleZoom(lat, state.ppm);
  if (!adjustingScale && Math.abs(desired - map.getZoom()) > .0008) {
    adjustingScale = true;
    map.setZoom(desired, { animate: false });
    adjustingScale = false;
  }
  drawGrid();
  normalRuler.setCalibration(state.ppm);
  blueRuler.setCalibration(state.ppm);
  const center = map.getCenter();
  const p = map.latLngToContainerPoint(center);
  const mpp = distance(map.containerPointToLatLng(p), map.containerPointToLatLng([p.x + 100, p.y])) / 100;
  $('scale-bar').style.width = `${500 / mpp}px`;
  $('scale-caption').textContent = state.calibrated ? '1 cm = 250 m · scala calibrata' : '1 cm = 250 m · scala nominale, da calibrare';
}

function gridLabel(text, orientation, position) {
  const label = document.createElement('span');
  label.className = `grid-label ${orientation}`;
  label.textContent = text;
  label.style[orientation === 'x' ? 'left' : 'top'] = `${position}px`;
  $('grid-labels').append(label);
}

function drawGrid() {
  gridLayer.clearLayers();
  pointerGuides.refresh();
  ruler.setEnabled(state.grid && state.rulerMode === 'grid');
  normalRuler.setEnabled(state.rulerMode === 'normal');
  blueRuler.setEnabled(state.rulerMode === 'normal');
  geographicFrame.draw();
  $('grid-labels').replaceChildren();
  if (!state.grid) return;
  const b = map.getBounds(), size = map.getSize();
  const lineStyle = { color: '#427c91', weight: .8, opacity: .63, interactive: false, className: 'utm-grid-line' };
  $('map').dataset.gridSystem = 'utm';
  {
    const corners = [b.getNorthWest(), b.getNorthEast(), b.getSouthWest(), b.getSouthEast()].map(p => geo.toUTM(p));
    const minE = Math.floor(Math.min(...corners.map(p => p.e)) / 1000) * 1000 - 1000;
    const maxE = Math.ceil(Math.max(...corners.map(p => p.e)) / 1000) * 1000 + 1000;
    const minN = Math.floor(Math.min(...corners.map(p => p.n)) / 1000) * 1000 - 1000;
    const maxN = Math.ceil(Math.max(...corners.map(p => p.n)) / 1000) * 1000 + 1000;
    for (let e = minE; e <= maxE; e += 1000) {
      const points = [];
      for (let n = minN; n <= maxN; n += 250) points.push(geo.fromUTM({ e, n }));
      L.polyline(points, lineStyle).addTo(gridLayer);
      const edge = intersectEdge(points, 'top');
      if (edge && edge.x > 32 && edge.x < size.x - 32) gridLabel(`${number(e)} E`, 'x', edge.x);
    }
    for (let n = minN; n <= maxN; n += 1000) {
      const points = [];
      for (let e = minE; e <= maxE; e += 250) points.push(geo.fromUTM({ e, n }));
      L.polyline(points, lineStyle).addTo(gridLayer);
      const edge = intersectEdge(points, 'left');
      if (edge && edge.y > 30 && edge.y < size.y - 24) gridLabel(`${number(n)} N`, 'y', edge.y);
    }
  }
}

function intersectEdge(points, edge) {
  for (let i = 1; i < points.length; i++) {
    const a = map.latLngToContainerPoint(points[i - 1]), b = map.latLngToContainerPoint(points[i]);
    const av = edge === 'top' ? a.y : a.x, bv = edge === 'top' ? b.y : b.x;
    if ((av <= 0 && bv >= 0) || (av >= 0 && bv <= 0)) {
      const t = Math.abs(bv - av) < .0001 ? 0 : -av / (bv - av);
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
  }
  return null;
}

function marker(point, kind = 'target', label = '') {
  const description = label || (kind === 'target' ? 'Punto da leggere' : 'La tua risposta');
  return L.marker(point, { keyboard: false, interactive: false, icon: L.divIcon({
    className: '', html: kind === 'target' ? `<div class="target-marker" role="img" aria-label="${description}"><span></span></div>` : `<div class="answer-marker" role="img" aria-label="${description}">×</div>`,
    iconSize: kind === 'target' ? [28, 28] : [22, 22], iconAnchor: kind === 'target' ? [14, 14] : [11, 11],
  }) }).addTo(exerciseLayer);
}

function renderCoordinateCard() {
  const card = $('target-coordinates');
  card.classList.toggle('geographic', state.system === 'geo');
  let pairs;
  if (state.system === 'utm') {
    const { e, n } = geo.toUTM(state.target);
    pairs = [['Est (E)', `${number(e)}<small>m</small>`], ['Nord (N)', `${number(n)}<small>m</small>`]];
  } else pairs = [['Latitudine', formatAngle(state.target.lat, state.format, 'lat')], ['Longitudine', formatAngle(state.target.lng, state.format, 'lng')]];
  card.innerHTML = pairs.map(([label, value]) => `<div><span class="coordinate-label">${label}</span><strong class="coordinate-value">${value}</strong></div>`).join('');
}

function updateUI() {
  document.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === state.mode; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-system]').forEach(b => { const on = b.dataset.system === state.system; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
  $('geo-format').value = state.format;
  $('format-wrap').hidden = state.system !== 'geo';
  $('tolerance').value = state.tolerance;
  $('grid-toggle').classList.toggle('active', state.grid);
  $('grid-toggle').setAttribute('aria-pressed', state.grid);
  $('ruler-tool').value = state.rulerMode;
  $('ruler-tool').parentElement.classList.toggle('active', state.rulerMode !== 'off');
  $('exercise-number').textContent = `ESERCIZIO ${String(state.exercise).padStart(2, '0')}`;
  $('system-tag').textContent = state.system === 'utm' ? 'WGS84 · 33N' : 'WGS84 · N / E';
  $('exercise-title').textContent = state.mode === 'find' ? 'Dalle coordinate alla carta.' : 'Dalla carta alle coordinate.';
  $('exercise-description').textContent = state.mode === 'find' ? 'Individua queste coordinate e clicca sulla mappa per segnare il punto.' : 'Leggi il centro del bersaglio sulla carta e inserisci le sue coordinate.';
  $('target-coordinates').hidden = state.mode !== 'find';
  $('answer-form').hidden = state.mode !== 'read';
  $('selection-status').hidden = state.mode !== 'find' || state.resolved;
  $('selection-status').classList.toggle('selected', !!state.answer);
  $('selection-status').lastElementChild.textContent = state.answer ? 'Punto segnato. Puoi riposizionarlo.' : 'In attesa del tuo punto sulla carta';
  $('verify-button').textContent = state.mode === 'find' ? 'Verifica il punto' : 'Verifica le coordinate';
  $('verify-button').insertAdjacentHTML('beforeend', '<svg><use href="#i-check"/></svg>');
  $('verify-button').disabled = state.mode === 'find' && !state.answer;
  $('verify-button').hidden = state.resolved;
  $('next-button').hidden = !state.resolved;
  $('reveal-button').hidden = state.resolved;
  $('skip-button').hidden = state.resolved;
  $('map-area-description').textContent = `${state.area.group} · ${state.area.name}`;
  $('crs-label').innerHTML = 'Bordi WGS84 · 1′ / 10″ <span class="footer-divider">|</span> Reticolo UTM 33N';
  $('focus-task').textContent = state.mode === 'find'
    ? state.system === 'utm' ? `E ${number(geo.toUTM(state.target).e)} · N ${number(geo.toUTM(state.target).n)}` : `${formatAngle(state.target.lat, state.format, 'lat')} · ${formatAngle(state.target.lng, state.format, 'lng')}`
    : 'Leggi le coordinate del bersaglio.';
  const utm = state.system === 'utm';
  $('first-label').textContent = utm ? 'Est (E) · metri' : 'Latitudine · Nord';
  $('second-label').textContent = utm ? 'Nord (N) · metri' : 'Longitudine · Est';
  $('first-unit').textContent = utm ? 'm E' : 'N';
  $('second-unit').textContent = utm ? 'm N' : 'E';
  $('answer-first').placeholder = utm ? 'Es. 381450' : state.format === 'dms' ? '42 26 31,2' : state.format === 'dm' ? '42 26,520' : '42,44200';
  $('answer-second').placeholder = utm ? 'Es. 4700325' : state.format === 'dms' ? '13 33 28,8' : state.format === 'dm' ? '13 33,480' : '13,55800';
  $('answer-first').inputMode = $('answer-second').inputMode = utm || state.format === 'dd' ? 'decimal' : 'text';
  $('input-help').textContent = utm ? 'Metri interi. Puoi separare le migliaia con spazi.' : state.format === 'dms' ? 'Gradi minuti secondi, separati da spazi. Es. 42 26 31,2' : state.format === 'dm' ? 'Gradi e minuti decimali. Es. 42 26,520' : 'Gradi decimali. Es. 42,44200';
  for (const id of ['answer-first', 'answer-second']) $(id).disabled = state.resolved;
}

function newExercise() {
  state.resolved = false; state.answer = null; state.exercise++;
  exerciseLayer.clearLayers(); answerMarker = null;
  $('feedback').hidden = true; $('form-error').hidden = true;
  $('answer-form').reset();
  map.setView(state.area, scaleZoom(state.area.lat, state.ppm), { animate: false });
  const size = map.getSize();
  let target = state.area;
  for (let i = 0; i < 50; i++) {
    const candidate = map.containerPointToLatLng([size.x * (.22 + Math.random() * .56), size.y * (.30 + Math.random() * .40)]);
    if (distance(candidate, state.area) < state.area.radius) { target = candidate; break; }
  }
  if (state.system === 'utm') {
    const utm = geo.toUTM(target);
    state.target = geo.fromUTM({ e: Math.round(utm.e), n: Math.round(utm.n) });
  } else state.target = { lat: parseAngle(formatAngle(target.lat, state.format, 'lat', false), state.format, 'lat'), lng: parseAngle(formatAngle(target.lng, state.format, 'lng', false), state.format, 'lng') };
  if (state.mode === 'read') marker(state.target);
  renderCoordinateCard(); updateUI(); scaleAndGrid(); saveSettings();
}

function choosePoint(point) {
  if (state.mode !== 'find' || state.resolved) return;
  state.answer = { lat: point.lat, lng: point.lng };
  if (answerMarker) exerciseLayer.removeLayer(answerMarker);
  answerMarker = marker(state.answer, 'answer');
  updateUI();
}

function parseAnswer() {
  const first = $('answer-first').value, second = $('answer-second').value;
  if (state.system === 'utm') {
    const e = decimalNumber(first), n = decimalNumber(second);
    if (e < 100000 || e > 900000 || n < 0 || n > 10000000) throw new Error('Controlla le coordinate: Est tra 100.000 e 900.000 m, Nord tra 0 e 10.000.000 m.');
    return geo.fromUTM({ e, n });
  }
  return { lat: parseAngle(first, state.format, 'lat'), lng: parseAngle(second, state.format, 'lng') };
}

function solutionHTML() {
  const utm = geo.toUTM(state.target);
  const primary = state.system === 'utm' ? `<span class="solution-pair">E ${number(utm.e)} m · N ${number(utm.n)} m</span>` : `<span class="solution-pair">${formatAngle(state.target.lat, state.format, 'lat')}</span><span class="solution-pair">${formatAngle(state.target.lng, state.format, 'lng')}</span>`;
  const other = state.system === 'utm' ? `${formatAngle(state.target.lat, 'dms', 'lat')}<br>${formatAngle(state.target.lng, 'dms', 'lng')}` : `UTM 33N · E ${number(utm.e)} m<br>N ${number(utm.n)} m`;
  return `<small><b>Coordinate del punto</b>${primary}</small><small>${other}</small>`;
}

function resolve(reveal = false) {
  if (state.resolved) return;
  $('form-error').hidden = true;
  if (!reveal && state.mode === 'read') {
    try { state.answer = parseAnswer(); }
    catch (error) { $('form-error').textContent = error.message; $('form-error').hidden = false; return; }
  }
  if (!reveal && !state.answer) return;
  state.resolved = true;
  if (state.mode === 'read') exerciseLayer.clearLayers();
  marker(state.target, 'target', 'Punto corretto');
  let result = null;
  if (!reveal) {
    result = gradeAnswer(state.target, state.answer, state.tolerance);
    if (state.mode === 'read') marker(state.answer, 'answer', 'La tua risposta');
    L.polyline([state.target, state.answer], { color: '#c27a48', weight: 2, dashArray: '5,6', interactive: false }).addTo(exerciseLayer);
    L.circle(state.target, { radius: state.tolerance, weight: 1, color: '#537948', fillColor: '#8aab73', fillOpacity: .13, interactive: false }).addTo(exerciseLayer);
  }
  const feedback = $('feedback');
  feedback.hidden = false;
  feedback.classList.toggle('fail', !!result && !result.correct);
  if (reveal) feedback.innerHTML = `<strong>Ecco il punto da trovare.</strong><p>Soluzione consultata: esercizio segnato come saltato.</p>${solutionHTML()}`;
  else {
    const title = result.correct ? 'Ci sei, punto trovato!' : 'Un po’ fuori rotta. Riproviamo?';
    const delta = state.system === 'utm' ? (() => { const target = geo.toUTM(state.target), answer = geo.toUTM(state.answer); const dE = Math.round(answer.e - target.e), dN = Math.round(answer.n - target.n); return `<p class="delta">Scarto Est: ${dE > 0 ? '+' : ''}${number(dE)} m · Nord: ${dN > 0 ? '+' : ''}${number(dN)} m</p>`; })() : '';
    feedback.innerHTML = `<strong>${title}</strong><p>Errore: <b>${compact(result.error)} m</b> · ${compact(result.paperMm)} mm sulla carta.<br>Tolleranza: ${state.tolerance} m.</p>${delta}${solutionHTML()}`;
  }
  history.push({ status: reveal ? 'skipped' : result.correct ? 'correct' : 'fail', error: result ? result.error : null, mode: state.mode, system: state.system, at: new Date().toISOString() });
  history = history.slice(-500); writeStorage(HISTORY, history); renderStats(); updateUI();
  // Keep the training scale, even when an answer is far outside the map.
  const size = map.getSize(), p = map.latLngToContainerPoint(state.target);
  if (p.x < 30 || p.x > size.x - 30 || p.y < 60 || p.y > size.y - 50) map.panTo(state.target);
}

function renderStats() {
  $('stat-total').textContent = history.length;
  $('stat-rate').textContent = history.length ? `${Math.round(history.filter(x => x.status === 'correct').length / history.length * 100)}%` : '—';
  const measured = history.filter(x => x.error !== null);
  $('stat-error').textContent = measured.length ? `${number(measured.reduce((sum, x) => sum + x.error, 0) / measured.length)} m` : '—';
  $('history-dots').innerHTML = history.slice(-10).map(x => `<i class="history-dot ${x.status}"></i>`).join('');
}

$('area').innerHTML = AREAS.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
$('area').value = state.area.id;
$('area').addEventListener('change', e => { state.area = AREAS.find(a => a.id === e.target.value); newExercise(); });
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { if (state.mode !== b.dataset.mode) { state.mode = b.dataset.mode; newExercise(); } }));
document.querySelectorAll('[data-system]').forEach(b => b.addEventListener('click', () => { if (state.system !== b.dataset.system) { state.system = b.dataset.system; newExercise(); } }));
$('geo-format').addEventListener('change', e => { state.format = e.target.value; newExercise(); });
$('tolerance').addEventListener('change', e => { state.tolerance = Number(e.target.value); newExercise(); });
$('verify-button').addEventListener('click', () => resolve());
$('answer-form').addEventListener('submit', e => { e.preventDefault(); resolve(); });
$('answer-form').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); resolve(); } });
$('reveal-button').addEventListener('click', () => resolve(true));
$('next-button').addEventListener('click', () => { newExercise(); if (state.mode === 'read') $('answer-first').focus(); });
$('skip-button').addEventListener('click', newExercise);
$('grid-toggle').addEventListener('click', () => { state.grid = !state.grid; updateUI(); drawGrid(); saveSettings(); });
$('ruler-tool').addEventListener('change', event => {
  state.rulerMode = event.target.value;
  if (state.rulerMode === 'grid') state.grid = true;
  updateUI(); drawGrid(); saveSettings();
});
$('recenter-button').addEventListener('click', () => {
  const center = state.mode === 'read' ? state.target : state.area;
  map.setView(center, scaleZoom(center.lat, state.ppm), { animate: false });
});
map.on('click', e => choosePoint(e.latlng));
map.on('keydown', e => { if (e.originalEvent.key === 'Enter') { e.originalEvent.preventDefault(); choosePoint(map.getCenter()); } });
map.on('moveend zoomend resize', scaleAndGrid);
const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
observer.observe($('map'));
// Leaflet supports +/- keyboard zoom; undo it to preserve the exercise scale.
$('map').addEventListener('keydown', e => { if (['+', '-', '=', '_'].includes(e.key)) e.preventDefault(); });

function setBase(id) {
  map.removeLayer(layers[base]); base = id; tileErrors = 0;
  $('tile-message').hidden = true; layers[id].addTo(map); $('base-layer').value = id;
}
$('base-layer').addEventListener('change', e => setBase(e.target.value));
$('fallback-button').addEventListener('click', () => setBase('osm'));
$('guide-button').addEventListener('click', () => $('guide-dialog').showModal());
$('calibrate-button').addEventListener('click', () => { $('calibration-error').hidden = true; $('measured-mm').value = compact(188.976378 / state.ppm); $('calibrate-dialog').showModal(); });
document.querySelectorAll('.dialog-close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
$('calibrate-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const mm = decimalNumber($('measured-mm').value);
    if (mm < 13 || mm > 200) throw new Error('Inserisci una misura tra 13 e 200 mm.');
    state.ppm = 188.976378 / mm; state.calibrated = true;
    saveSettings(); scaleAndGrid(); $('calibrate-dialog').close();
  } catch (error) { $('calibration-error').textContent = error.message; $('calibration-error').hidden = false; }
});
$('reset-calibration').addEventListener('click', () => { state.ppm = DEFAULT_PPM; state.calibrated = false; saveSettings(); scaleAndGrid(); $('calibrate-dialog').close(); });
$('reset-stats').addEventListener('click', () => $('reset-dialog').showModal());
$('confirm-reset').addEventListener('click', () => { history = []; writeStorage(HISTORY, history); renderStats(); $('reset-dialog').close(); });
// CSS focus mode works on iPhone without depending on the Fullscreen API.
const compactLayout = window.matchMedia('(max-width: 960px)');
function setMapFocus(active) {
  const center = active && state.mode === 'read' ? state.target : map.getCenter();
  document.body.classList.toggle('map-focused', active);
  $('map-focus-toggle').setAttribute('aria-pressed', active);
  $('map-focus-toggle').textContent = active ? 'Torna all’esercizio ↙' : 'Solo carta ↗';
  map.invalidateSize({ pan: false });
  if (center) map.panTo(center, { animate: false });
}
function syncCompactLayout() {
  $('practice-settings').open = !compactLayout.matches;
  $('map-instruments').open = !compactLayout.matches;
  setMapFocus(false);
}
syncCompactLayout();
compactLayout.addEventListener('change', syncCompactLayout);
$('map-focus-toggle').addEventListener('click', () => setMapFocus(!document.body.classList.contains('map-focused')));
document.addEventListener('keydown', event => { if (event.key === 'Escape') setMapFocus(false); });
renderStats(); newExercise();
