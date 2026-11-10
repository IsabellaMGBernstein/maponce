// The Years map, self-contained: it shares no code with the other maps.
// A world map with all seven continents. Every route is coloured by the year its letters were written,
// 1897 (light) to 1900 (dark); a route used in several years has one line per year. Click a route, or a
// year at the top: that year's routes turn green and the others grey, and the side panel shows the year and
// everyone Ponce wrote to that year. A slider along the bottom moves month by month as it is dragged.
// The key in the top left corner can be minimized.
(async function () {
const L = window.L, topojson = window.topojson;

// ---------- helpers ----------
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const countBy = (list, f) => {   // [[key, count], ...] most first
  const c = {}; list.forEach((x) => { const k = f(x); c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
const dark = matchMedia('(prefers-color-scheme: dark)');
const YEARS = [1897, 1898, 1899, 1900];
const yearOf = (l) => +l.date.slice(0, 4);
const yColour = (y) => `--y${YEARS.indexOf(y) + 1}`;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = (l) => l.date.slice(0, 7);                                            // "1898-06"
const monthName = (m) => `${MONTH_NAMES[+m.slice(5) - 1]} ${m.slice(0, 4)}`;          // "June 1898"
const shortMonth = (m) => `${MONTH_NAMES[+m.slice(5) - 1].slice(0, 3)} ${m.slice(0, 4)}`;

// ---------- data ----------
const D = await (await fetch('/years/data.json')).json();   // places and letters
const BY_YEAR = new Map(YEARS.map((y) => [y, D.letters.filter((l) => yearOf(l) === y)]));
// every month from the first letter (May 1897) to the last (March 1900), including months without letters
const MONTHS = (() => {
  const all = D.letters.map(monthOf).sort(), out = [];
  let [y, m] = all[0].split('-').map(Number);
  for (const last = all[all.length - 1]; `${y}-${String(m).padStart(2, '0')}` <= last; m === 12 ? (y++, m = 1) : m++) out.push(`${y}-${String(m).padStart(2, '0')}`);
  return out;
})();
const BY_MONTH = new Map(MONTHS.map((m) => [m, D.letters.filter((l) => monthOf(l) === m)]));
const inferredBox = document.getElementById('inferred');
// letters drawn on the map: they need a known destination; inferred ones only while the box is ticked
const drawable = (l) => l.dest && (l.dest_kind !== 'inferred' || inferredBox.checked);

// ---------- the map ----------
// It scrolls sideways across exactly one world, from 31.5°W eastward to 31.5°W again, so routes can run
// east across the Pacific to the Americas (their longitudes + 360). Only Greenland is split by the edges.
const WEST = -31.5, EAST = WEST + 360, WHOLE_WORLD = [[-80, WEST], [78, EAST]];
const shiftLon = (lon) => (lon < -30 ? lon + 360 : lon);
const ll = (name) => [D.places[name].lat, shiftLon(D.places[name].lon)];
const map = L.map('map', { zoomControl: false, worldCopyJump: false, zoomSnap: 0, maxZoom: 8,
  maxBounds: [[-85, WEST], [85, EAST]], maxBoundsViscosity: 1 });
L.control.zoom({ position: 'topright' }).addTo(map);
const fitMinZoom = () => map.setMinZoom(Math.log2(map.getSize().x / 256) + 0.001);   // never narrower than the window
fitMinZoom(); map.on('resize', fitMinZoom);
map.attributionControl.addAttribution('Borders: <a href="https://www.naturalearthdata.com">Natural Earth</a> · Data: Ponce, <i>Cartas sobre la revolución</i> (1932)');
map.fitBounds(WHOLE_WORLD);   // all seven continents

// Land, oceans and present-day borders (Natural Earth 1:50m). The data is made for a globe: on a flat map
// Russia and Fiji (across the 180° meridian) and Antarctica (around the South Pole) need repairing.
const world = await (await fetch('/data/countries-50m.json')).json();
const fixRing = (ring) => {
  const out = [ring[0].slice()];
  for (const [x0, y] of ring.slice(1)) {
    const prev = out[out.length - 1][0]; let x = x0;
    while (x - prev > 180) x -= 360;
    while (x - prev < -180) x += 360;
    out.push([x, y]);
  }
  const first = out[0][0], last = out[out.length - 1][0];
  if (Math.abs(last - first) > 180) out.push([last, -90], [first, -90]);   // Antarctica: close at the pole
  return out;
};
const fixPolygon = (rings) => rings.filter((r) => !r.every(([, y]) => y <= -89.9)).map(fixRing);
const countries = topojson.feature(world, world.objects.countries);
for (const f of countries.features) {
  const g = f.geometry; if (!g) continue;
  if (g.type === 'Polygon') g.coordinates = fixPolygon(g.coordinates);
  if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(fixPolygon).filter((r) => r.length);
}
const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
const onCut = ([x, y]) => Math.abs(x) >= 179.99 || y <= -89.9;
const isCut = (a, b) => Math.abs(a[0] - b[0]) > 180 || (onCut(a) && onCut(b));
const coast = { type: 'MultiLineString', coordinates: topojson.mesh(world, world.objects.land).coordinates.flatMap((line) => {
  const out = []; let cur = [line[0]];
  for (const pt of line.slice(1)) { if (isCut(cur[cur.length - 1], pt)) { if (cur.length > 1) out.push(cur); cur = [pt]; } else cur.push(pt); }
  if (cur.length > 1) out.push(cur);
  return out;
}) };
const GEO_LABELS = [
  ['continent', 'North America', 47, -102], ['continent', 'South America', -14, -58], ['continent', 'Europe', 57, 28],
  ['continent', 'Africa', 6, 20], ['continent', 'Asia', 48, 92], ['continent', 'Australia', -24, 134], ['continent', 'Antarctica', -75, 100],
  ['ocean', 'Pacific Ocean', 12, -152], ['ocean', 'Pacific Ocean', -32, -120], ['ocean', 'Atlantic Ocean', 22, -52],
  ['ocean', 'Indian Ocean', -22, 78], ['ocean', 'Arctic Ocean', 75, 172], ['ocean', 'Southern Ocean', -58, 100],
];
map.createPane('base').style.zIndex = 200;
const labelPane = map.createPane('geoLabels'); labelPane.style.zIndex = 350; labelPane.style.pointerEvents = 'none';
const renderer = L.canvas({ pane: 'base', padding: 0.5 });
const baseLayer = L.layerGroup().addTo(map);
function drawBase() {
  baseLayer.clearLayers();
  for (const off of [0, 360]) {   // two copies of the world fill the span from WEST to EAST
    const opt = { pane: 'base', renderer, interactive: false, coordsToLatLng: (c) => L.latLng(c[1], c[0] + off) };
    L.geoJSON(countries, { ...opt, style: { stroke: false, fillColor: css('--land'), fillOpacity: 1 } }).addTo(baseLayer);
    L.geoJSON(coast, { ...opt, style: { color: css('--coast'), weight: 0.8, fill: false } }).addTo(baseLayer);
    L.geoJSON(borders, { ...opt, style: { color: css('--border'), weight: 0.7, fill: false } }).addTo(baseLayer);
    for (const [kind, name, lat, lon] of GEO_LABELS)
      L.marker([lat, lon + off], { pane: 'geoLabels', interactive: false, keyboard: false,
        icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<span class="geo ${kind}">${name}</span>` }) }).addTo(baseLayer);
  }
}
drawBase();

// ---------- the map key (top left, minimizable): the basic key and the year key ----------
const keyLine = (c, w = 3, dash = false) => `<svg viewBox="0 0 30 16" aria-hidden="true"><path d="M2 12 Q15 2 28 10" style="fill:none;stroke:var(${c});stroke-width:${w};stroke-linecap:round" ${dash ? 'stroke-dasharray="4 4"' : ''}/></svg>`;
const Key = L.Control.extend({ options: { position: 'topleft' }, onAdd() {
  const d = L.DomUtil.create('details', 'map-key');
  if (innerWidth > 800) d.open = true;
  const rows = [
    ['<svg viewBox="0 0 30 16" aria-hidden="true"><circle cx="15" cy="8" r="5.5" style="fill:var(--origin);stroke:var(--origin-ring);stroke-width:1.5"/></svg>',
      '<b>Black circle</b>: where Ponce wrote the letters (Hong Kong, Yokohama)'],
    ['<svg viewBox="0 0 30 16" aria-hidden="true"><circle cx="7" cy="9" r="3.5" style="fill:var(--dest);fill-opacity:var(--dest-alpha);stroke:var(--dest)"/><circle cx="20" cy="8" r="6.5" style="fill:var(--dest);fill-opacity:var(--dest-alpha);stroke:var(--dest)"/></svg>',
      '<b>Red circle</b>: destination, larger for more letters'],
    ...YEARS.map((y) => [keyLine(yColour(y)), `<b>${y}</b>: route of a letter written in ${y}`]),
    [keyLine('--sel', 4), '<b>Green</b>: the year or month you picked; the rest turns grey'],
    [keyLine('--muted', 2, true), '<b>Dashed</b>: destination inferred'],
  ];
  d.innerHTML = `<summary>Map Key</summary><ul>${rows.map(([svg, t]) => `<li>${svg}<span>${t}</span></li>`).join('')}</ul>
    <div class="foot">A route used in several years has one line per year. Click a route or a year to pick it, or drag the slider month by month; click the empty map or press Esc to clear it.</div>`;
  L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
  return d;
} });
new Key().addTo(map);

// ---------- the slider (bottom of the map): drag to move month by month ----------
// Stops: All, then every month from May 1897 to March 1900. Dragging picks each month in turn: its letters
// turn green and the side panel shows that month. The track is coloured by year, and each year's label under
// it picks the whole year. The slider follows a year or month picked any other way; arrow keys move one month.
const STOPS = [null, ...MONTHS];
const posOf = (i) => i / (STOPS.length - 1);                       // 0..1 along the track
const at = (p) => `calc(9px + (100% - 18px) * ${p.toFixed(4)})`;   // the thumb is 18px wide: stops run from 9px to 100% - 9px
const span = (y) => { const idx = STOPS.map((m, i) => (m && +m.slice(0, 4) === y ? i : -1)).filter((i) => i >= 0); return [idx[0], idx[idx.length - 1]]; };
const Slider = L.Control.extend({ options: { position: 'bottomleft' }, onAdd() {
  const d = L.DomUtil.create('div', 'year-slider');
  const ticks = [`<button type="button" data-all="1" style="--c:var(--muted);--p:0">All</button>`,
    ...YEARS.map((y) => { const [a, b] = span(y); return `<button type="button" data-y="${y}" style="--c:var(${yColour(y)});--p:${((posOf(a) + posOf(b)) / 2).toFixed(4)}" title="All of ${y}">${y}</button>`; })];
  d.innerHTML = `<div class="ys-head"><span class="ys-title">Click and drag to see how Mariano Ponce’s letter-writing changed over time</span><span class="ys-now" id="ys-now" aria-live="polite"></span></div>
    <input type="range" id="ys-range" min="0" max="${STOPS.length - 1}" step="1" value="0" aria-label="Month" aria-valuetext="All years">
    <div class="ys-ticks">${ticks.join('')}</div>`;
  const range = d.querySelector('#ys-range');
  range.addEventListener('input', () => { const m = STOPS[+range.value]; if (m) pickMonth(m); else reset(); });
  d.querySelector('.ys-ticks button[data-all]').onclick = reset;
  d.querySelectorAll('.ys-ticks button[data-y]').forEach((b) => { b.onclick = () => pick(+b.dataset.y); });
  L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);   // dragging the slider must not drag the map
  return d;
} });
new Slider().addTo(map);
// the track: a neutral piece for "All", then each year in its own blue; a picked year is shown in green
function trackGradient() {
  const half = 0.5 / (STOPS.length - 1), parts = [`var(--band) ${at(0)}`, `var(--band) ${at(half)}`];
  for (const y of YEARS) {
    const [a, b] = span(y), c = S.year === y ? 'var(--sel)' : `var(${yColour(y)})`;
    parts.push(`transparent ${at(posOf(a) - half)}`, `${c} ${at(posOf(a) - half + 0.004)}`, `${c} ${at(posOf(b) + half - 0.004)}`, `transparent ${at(posOf(b) + half)}`);
  }
  return `linear-gradient(to right, ${parts.join(', ')})`;
}
function syncSlider() {
  const range = document.getElementById('ys-range');
  const i = S.month ? STOPS.indexOf(S.month) : S.year ? span(S.year)[0] : 0;   // a picked year puts the handle on its first month
  range.value = i;
  range.style.setProperty('--track', trackGradient());
  const label = S.month ? `${shortMonth(S.month)} · ${plural(BY_MONTH.get(S.month).length, 'letter')}`
    : S.year ? `All of ${S.year} · ${plural(BY_YEAR.get(S.year).length, 'letter')}` : '';   // nothing shown while all years are in view
  range.setAttribute('aria-valuetext', S.month ? monthName(S.month) : S.year ? `All of ${S.year}` : 'All years');
  document.getElementById('ys-now').textContent = label;
  const cur = S.month ? +S.month.slice(0, 4) : S.year;
  document.querySelectorAll('.ys-ticks button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.all ? !S.month && !S.year : +b.dataset.y === cur)));
}

// ---------- the year buttons along the top ----------
function renderLegend() {
  const lg = document.getElementById('legend');
  lg.innerHTML = YEARS.map((y) => `<button data-y="${y}" aria-pressed="${S.year === y}" style="--c:var(${yColour(y)})" title="Show ${y}"><span class="sw"></span>${y} <span style="opacity:.7">${BY_YEAR.get(y).length}</span></button>`).join('') +
    `<span class="key"><span class="sw dash"></span>destination inferred</span>`;
  lg.querySelectorAll('button[data-y]').forEach((b) => { b.onclick = () => (S.year === +b.dataset.y ? reset() : pick(+b.dataset.y)); });
}

// ---------- drawing ----------
const routeLayer = L.layerGroup().addTo(map), markLayer = L.layerGroup().addTo(map);
const S = { year: null, month: null };   // a picked year, or a picked month ("1898-06")
function curve([y1, x1], [y2, x2], bend = 0.18, n = 40) {
  const dx = x2 - x1, dy = y2 - y1, cx = (x1 + x2) / 2 - dy * bend, cy = (y1 + y2) / 2 + dx * bend, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * y1 + 2 * u * t * cy + t * t * y2, u * u * x1 + 2 * u * t * cx + t * t * x2]); }
  return pts;
}

function render() {
  routeLayer.clearLayers(); markLayer.clearLayers();
  const ls = D.letters.filter(drawable);
  // one line per year per route (printed and inferred addresses kept apart)
  const lines = new Map();
  for (const l of ls) {
    const k = `${yearOf(l)}|${l.origin}|${l.dest}|${l.dest_kind === 'inferred' ? 'i' : 'p'}`;
    (lines.get(k) || lines.set(k, { year: yearOf(l), origin: l.origin, dest: l.dest, inf: l.dest_kind === 'inferred', ls: [] }).get(k)).ls.push(l);
  }
  // a route used in several years: fan its lines out side by side, 1897 to 1900
  const fans = new Map();
  for (const ln of lines.values()) { const k = `${ln.origin}|${ln.dest}`; (fans.get(k) || fans.set(k, []).get(k)).push(ln); }
  for (const g of fans.values()) {
    g.sort((a, b) => a.year - b.year || a.inf - b.inf);
    g.forEach((ln, i) => { ln.bend = 0.18 + (i - (g.length - 1) / 2) * 0.05; });
  }
  // the picked year is drawn last, on top; while a month is picked, every year's line is grey
  for (const ln of [...lines.values()].sort((a, b) => (a.year === S.year) - (b.year === S.year) || b.ls.length - a.ls.length)) {
    if (ln.origin === ln.dest) continue;
    const on = !S.month && ln.year === S.year, off = S.month || (S.year && !on);
    const line = L.polyline(curve(ll(ln.origin), ll(ln.dest), ln.bend), {
      color: css(on ? '--sel' : off ? '--trace' : yColour(ln.year)), weight: 1.2 + Math.sqrt(ln.ls.length) * 1.3 + (on ? 1.5 : 0),
      opacity: on ? 1 : off ? 0.35 : 0.9, dashArray: ln.inf ? '5 6' : null, lineCap: 'round',
      bubblingMouseEvents: false,   // a click on a route should not also count as a click on the empty map
    }).addTo(routeLayer);
    line.bindTooltip(`<b>${ln.year}</b><br>${esc(ln.origin)} → ${esc(D.places[ln.dest].label)}: ${plural(ln.ls.length, 'letter')}${ln.inf ? ' (inferred)' : ''}`, { sticky: true });
    line.on('click', () => pick(ln.year));
  }
  // a picked month: its letters drawn in green on top, along the same curve as their year's line
  if (S.month) {
    const month = new Map();
    for (const l of ls.filter((x) => monthOf(x) === S.month)) {
      const k = `${yearOf(l)}|${l.origin}|${l.dest}|${l.dest_kind === 'inferred' ? 'i' : 'p'}`;
      (month.get(k) || month.set(k, { ...lines.get(k), ls: [] }).get(k)).ls.push(l);
    }
    for (const ln of month.values()) {
      if (ln.origin === ln.dest) continue;
      const line = L.polyline(curve(ll(ln.origin), ll(ln.dest), ln.bend), {
        color: css('--sel'), weight: 2.7 + Math.sqrt(ln.ls.length) * 1.3, opacity: 1, dashArray: ln.inf ? '5 6' : null, lineCap: 'round', bubblingMouseEvents: false,
      }).addTo(routeLayer);
      line.bindTooltip(`<b>${monthName(S.month)}</b><br>${esc(ln.origin)} → ${esc(D.places[ln.dest].label)}: ${plural(ln.ls.length, 'letter')}${ln.inf ? ' (inferred)' : ''}`, { sticky: true });
      line.on('click', () => pick(ln.year));
    }
  }
  // destinations: semi-transparent red circles, larger for more letters; outlined if they received letters in the picked year or month
  const byPlace = {}; ls.forEach((l) => (byPlace[l.dest] ||= []).push(l));
  for (const [name, pls] of Object.entries(byPlace)) {
    const size = Math.round(2 * (3 + Math.sqrt(pls.length) * 2.2)), label = D.places[name].label;   // diameter, px
    const on = S.month ? pls.some((l) => monthOf(l) === S.month) : !!S.year && pls.some((l) => yearOf(l) === S.year);
    const m = L.marker(ll(name), { title: `${label}: ${plural(pls.length, 'letter')}`, riseOnHover: true,
      icon: L.divIcon({ className: 'dest-dot' + (on ? ' on' : ''), iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [size / 2, 0],
        html: `<svg viewBox="-1.1 -1.1 2.2 2.2" width="${size}" height="${size}" aria-hidden="true"><circle r="1"/></svg>` }) }).addTo(markLayer);
    m.bindTooltip(`${esc(label)} <span style="opacity:.7">${pls.length}</span>`, { permanent: true, direction: 'right', offset: [2, 0], className: 'plabel' });
    m.on('click', () => yearsPopup(label, 'received', pls, ll(name)));
  }
  // where Ponce wrote: black circles, on top
  for (const o of ['Hong Kong', 'Yokohama']) {
    const mk = L.marker(ll(o), { zIndexOffset: 1000, title: `Ponce in ${o}`,
      icon: L.divIcon({ className: 'origin-dot', iconSize: [18, 18], iconAnchor: [9, 9],
        html: '<svg viewBox="-1.2 -1.2 2.4 2.4" width="18" height="18" aria-hidden="true"><circle r="1"/></svg>' }) }).addTo(markLayer);
    mk.bindTooltip(`Ponce · ${o}`, { permanent: true, direction: 'left', offset: [-9, 0], className: 'plabel origin' });
    mk.on('click', () => yearsPopup(`Ponce in ${o}`, 'written', D.letters.filter((l) => l.origin === o), ll(o)));
  }
  renderLegend(); renderPanel(); syncSlider();
}

// letters received at a place, or written at one of Ponce's bases, counted by year; each year can be picked
function yearsPopup(title, verb, ls, latlng) {
  const rows = YEARS.map((y) => [y, ls.filter((l) => yearOf(l) === y).length]).filter(([, n]) => n);
  L.popup().setLatLng(latlng).setContent(`<div class="pop"><h3>${esc(title)}</h3><div class="meta">${plural(ls.length, 'letter')} ${verb}, by year</div>
    <ul>${rows.map(([y, n]) => `<li><button class="link" data-y="${y}">${y}</button> <span style="opacity:.7">(${n})</span></li>`).join('')}</ul></div>`).openOn(map);
}
map.on('popupopen', (e) => e.popup.getElement().querySelectorAll('button[data-y]').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.y))));

// ---------- the side panel: the four years, or one year with its correspondents ----------
function renderPanel() {
  const meta = document.getElementById('panel-meta'), body = document.getElementById('panel-body');
  document.getElementById('panel-title').textContent = S.month ? 'Month' : S.year ? 'Year' : 'Years';
  if (S.month) {
    const ls = BY_MONTH.get(S.month), who = countBy(ls, (l) => l.recipient), y = +S.month.slice(0, 4);
    meta.textContent = '';
    body.innerHTML = `<div class="year"><button class="back">← All years</button>
      <h3><span class="dot" style="--c:var(${yColour(y)})"></span>${monthName(S.month)}</h3>
      <p class="count">${ls.length ? `${plural(ls.length, 'letter')} to ${plural(who.length, 'correspondent')}` : 'No letters this month.'}</p>
      <button class="year-link" data-y="${y}">See all of ${y} →</button>
      ${ls.length ? `<h4>Everyone he wrote to in ${monthName(S.month)} (${who.length})</h4>
      <ul class="names">${who.map(([k, v]) => `<li><span>${esc(k)}</span><span class="v">${v}</span></li>`).join('')}</ul>` : ''}</div>`;
    body.querySelector('.back').onclick = reset;
    body.querySelector('.year-link').onclick = () => pick(y);
    return;
  }
  if (!S.year) {
    meta.textContent = `${D.letters.length} letters, 1897–1900`;
    body.innerHTML = `<ul class="years">${YEARS.map((y) => { const ls = BY_YEAR.get(y);
      return `<li><button data-y="${y}" style="--c:var(${yColour(y)})"><span class="dot"></span><span class="yr">${y}</span><span class="n">${plural(ls.length, 'letter')}</span>
        <span class="sub">${plural(new Set(ls.map((l) => l.recipient)).size, 'correspondent')}</span></button></li>`; }).join('')}</ul>
      <p class="hint">Click a route on the map, or a year, to see everyone Ponce wrote to that year. Drag the slider below the map to move month by month.</p>`;
    body.querySelectorAll('button[data-y]').forEach((b) => { b.onclick = () => pick(+b.dataset.y); });
    return;
  }
  const ls = BY_YEAR.get(S.year), who = countBy(ls, (l) => l.recipient);
  meta.textContent = '';
  body.innerHTML = `<div class="year"><button class="back">← All years</button>
    <h3><span class="dot" style="--c:var(${yColour(S.year)})"></span>${S.year}</h3>
    <p class="count">${plural(ls.length, 'letter')} to ${plural(who.length, 'correspondent')}</p>
    <h4>Everyone he wrote to in ${S.year} (${who.length})</h4>
    <ul class="names">${who.map(([k, v]) => `<li><span>${esc(k)}</span><span class="v">${v}</span></li>`).join('')}</ul></div>`;
  body.querySelector('.back').onclick = reset;
}

function pick(y) { if (S.year !== y || S.month) { S.year = y; S.month = null; map.closePopup(); render(); document.getElementById('panel-body').scrollTop = 0; } }
function pickMonth(m) { if (S.month !== m) { S.month = m; S.year = null; map.closePopup(); render(); document.getElementById('panel-body').scrollTop = 0; } }
// clear the picked year: a click on the empty map, the Esc key, "All years", the picked year at the top, or "All" on the slider
function reset() { if (S.year || S.month) { S.year = S.month = null; map.closePopup(); render(); } }
map.on('click', reset);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') reset(); });
inferredBox.onchange = render;
dark.addEventListener('change', () => { drawBase(); render(); });

// the side panel's minimize button; the map is resized to fill the space
const toggle = document.getElementById('panel-toggle'), layout = document.querySelector('.layout');
toggle.onclick = () => {
  const whole = map.getZoom() <= map.getMinZoom() + 0.01;
  const min = layout.classList.toggle('panel-min'), text = min ? 'Show the side panel' : 'Minimize the side panel';
  toggle.textContent = min ? '+' : '–'; toggle.setAttribute('aria-expanded', String(!min)); toggle.title = text; toggle.setAttribute('aria-label', text);
  map.invalidateSize();
  if (whole) map.fitBounds(WHOLE_WORLD, { animate: false });
};

render();
})();
