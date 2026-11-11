export const AREAS = [
  { id: 'imperatore', name: 'Campo Imperatore', group: 'Gran Sasso', lat: 42.442, lng: 13.558, radius: 2200 },
  { id: 'santo-stefano', name: 'Santo Stefano di Sessanio', group: 'Gran Sasso', lat: 42.344, lng: 13.647, radius: 1800 },
  { id: 'majella', name: 'Passo San Leonardo', group: 'Majella', lat: 42.067, lng: 14.039, radius: 1800 },
  { id: 'sirente', name: 'Piani di Pezza', group: 'Sirente–Velino', lat: 42.202, lng: 13.432, radius: 2000 },
  { id: 'scanno', name: 'Lago di Scanno', group: 'Valle del Sagittario', lat: 41.922, lng: 13.873, radius: 1500 },
  { id: 'barrea', name: 'Lago di Barrea', group: 'Parco d’Abruzzo', lat: 41.771, lng: 13.975, radius: 1700 },
  { id: 'trabocchi', name: 'San Vito Chietino', group: 'Costa dei Trabocchi', lat: 42.289, lng: 14.444, radius: 1200 },
  { id: 'aquila', name: 'L’Aquila', group: 'Valle dell’Aterno', lat: 42.35, lng: 13.399, radius: 1800 },
];

export const DEFAULT_PPM = 96 / 25.4;
export const SCALE = 25000;

export function createGeo(proj4) {
  const utm = '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs';
  return {
    toUTM({ lat, lng }) {
      const [e, n] = proj4('EPSG:4326', utm, [lng, lat]);
      return { e, n };
    },
    fromUTM({ e, n }) {
      const [lng, lat] = proj4(utm, 'EPSG:4326', [e, n]);
      return { lat, lng };
    },
  };
}

export function distance(a, b) {
  const rad = Math.PI / 180;
  const p1 = a.lat * rad, p2 = b.lat * rad;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function decimalNumber(value) {
  const normalized = String(value).trim().replaceAll(/\s/g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) throw new Error('Inserisci un numero valido. Puoi usare la virgola decimale.');
  const result = Number(normalized);
  if (!Number.isFinite(result)) throw new Error('Inserisci un numero finito.');
  return result;
}

export function parseAngle(value, format, axis) {
  const label = axis === 'lat' ? 'latitudine' : 'longitudine';
  const max = axis === 'lat' ? 90 : 180;
  let result;
  if (format === 'dd') result = decimalNumber(value);
  else {
    const clean = String(value).trim().replaceAll(',', '.').replace(/[°º′'’″"“”]/g, ' ');
    const parts = clean.trim().split(/\s+/);
    const count = format === 'dms' ? 3 : 2;
    if (parts.length !== count || parts.some(p => !/^\d+(?:\.\d+)?$/.test(p))) {
      throw new Error(format === 'dms' ? `Per la ${label} scrivi gradi, minuti e secondi: 42 26 31,2.` : `Per la ${label} scrivi gradi e minuti: 42 26,520.`);
    }
    const nums = parts.map(Number);
    if (!Number.isInteger(nums[0]) || nums[1] >= 60 || (format === 'dms' && (!Number.isInteger(nums[1]) || nums[2] >= 60))) {
      throw new Error('Gradi interi; minuti e secondi devono essere minori di 60.');
    }
    result = nums[0] + nums[1] / 60 + (format === 'dms' ? nums[2] / 3600 : 0);
  }
  if (result < 0 || result > max) throw new Error(`La ${label} deve essere compresa tra 0 e ${max}° (${axis === 'lat' ? 'Nord' : 'Est'}).`);
  return result;
}

export function formatAngle(value, format, axis, suffix = true) {
  const end = suffix ? ` ${axis === 'lat' ? 'N' : 'E'}` : '';
  if (format === 'dd') return value.toFixed(5).replace('.', ',') + (suffix ? '°' : '') + end;
  if (format === 'dm') {
    const all = Math.round(value * 60000);
    const deg = Math.floor(all / 60000), mins = (all - deg * 60000) / 1000;
    return suffix ? `${deg}° ${mins.toFixed(3).padStart(6, '0').replace('.', ',')}′${end}` : `${deg} ${mins.toFixed(3).replace('.', ',')}`;
  }
  const all = Math.round(value * 36000);
  const deg = Math.floor(all / 36000), min = Math.floor((all - deg * 36000) / 600), sec = (all - deg * 36000 - min * 600) / 10;
  return suffix ? `${deg}° ${String(min).padStart(2, '0')}′ ${sec.toFixed(1).padStart(4, '0').replace('.', ',')}″${end}` : `${deg} ${min} ${sec.toFixed(1).replace('.', ',')}`;
}

export function scaleZoom(lat, pixelsPerMm = DEFAULT_PPM) {
  const metresPerPixel = SCALE / (1000 * pixelsPerMm);
  return Math.log2(156543.03392804097 * Math.cos(lat * Math.PI / 180) / metresPerPixel);
}

export function mapMillimetres(metres) { return metres * 1000 / SCALE; }

export function gradeAnswer(target, answer, tolerance) {
  const error = distance(target, answer);
  return { error, correct: error <= tolerance, paperMm: mapMillimetres(error) };
}

export function samplePoint(area, geo, random = Math.random) {
  const center = geo.toUTM(area);
  const theta = random() * Math.PI * 2, radius = Math.sqrt(random()) * area.radius;
  return geo.fromUTM({ e: center.e + Math.cos(theta) * radius, n: center.n + Math.sin(theta) * radius });
}
