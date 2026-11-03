// Shared by four maps (Correspondents, Years, Themes, Regions): data, the flat world map, routes, the red and
// black circles, the map key, popups and the side panel. Each map's own file (years.js ...) decides what to draw.
// The Routes map does not use this file: it has its own code in src/routes/.
const L = window.L, topojson = window.topojson;

// ---------- small helpers ----------
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const YEARS = [1897, 1898, 1899, 1900];
export const yearOf = (l) => +l.date.slice(0, 4);
export const yColour = (y) => `--y${YEARS.indexOf(y) + 1}`;
export const oKey = (o) => (o === 'Hong Kong' ? 'hk' : 'yk');
// [[name, count], ...] most first
export const countBy = (list, f) => {
  const c = {}; list.forEach((x) => { const k = f(x); c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
export const showInferred = () => document.getElementById('inferred').checked;
// letters drawn on the map: they need a known destination; inferred ones only while the box is ticked
export const drawable = (l) => l.dest && (l.dest_kind !== 'inferred' || showInferred());

export async function loadData() { return (await fetch('/data/site.json')).json(); }
export async function loadTexts() { return (await fetch('/data/texts.json')).json(); }

// ---------- the map ----------
// It scrolls sideways across exactly one world, from 31.5°W eastward to 31.5°W again, so routes can run
// east across the Pacific to the Americas (their longitudes + 360). Only Greenland is split by the edges.
export const WEST = -31.5, EAST = WEST + 360;
export const WHOLE_WORLD = [[-80, WEST], [78, EAST]];
const shiftLon = (lon) => (lon < -30 ? lon + 360 : lon);
const dark = matchMedia('(prefers-color-scheme: dark)');
export const onThemeChange = (fn) => dark.addEventListener('change', fn);

export async function createMap(D, { view = WHOLE_WORLD } = {}) {
  const map = L.map('map', { zoomControl: false, worldCopyJump: false, zoomSnap: 0, maxZoom: 8,
    maxBounds: [[-85, WEST], [85, EAST]], maxBoundsViscosity: 1 });
  L.control.zoom({ position: 'topright' }).addTo(map);
  // never zoom out so far that the map is narrower than the window
  const fitMinZoom = () => map.setMinZoom(Math.log2(map.getSize().x / 256) + 0.001);
  fitMinZoom(); map.on('resize', fitMinZoom);
  map.attributionControl.addAttribution('Borders: <a href="https://www.naturalearthdata.com">Natural Earth</a> · Data: Ponce, <i>Cartas sobre la revolución</i> (1932)');
  map.fitBounds(view);
  await drawBasemap(map);
  const ll = (name) => [D.places[name].lat, shiftLon(D.places[name].lon)];
  return { map, ll, routeLayer: L.layerGroup().addTo(map), markLayer: L.layerGroup().addTo(map) };
}

// Land, oceans and present-day borders (Natural Earth 1:50m). The data is made for a globe: on a flat map
// Russia and Fiji (across the 180° meridian) and Antarctica (around the South Pole) need repairing.
async function drawBasemap(map) {
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
  const labels = [
    ['continent', 'North America', 47, -102], ['continent', 'South America', -14, -58], ['continent', 'Europe', 57, 28],
    ['continent', 'Africa', 6, 20], ['continent', 'Asia', 48, 92], ['continent', 'Australia', -24, 134], ['continent', 'Antarctica', -75, 100],
    ['ocean', 'Pacific Ocean', 12, -152], ['ocean', 'Pacific Ocean', -32, -120], ['ocean', 'Atlantic Ocean', 22, -52],
    ['ocean', 'Indian Ocean', -22, 78], ['ocean', 'Arctic Ocean', 75, 172], ['ocean', 'Southern Ocean', -58, 100],
  ];
  map.createPane('base').style.zIndex = 200;
  const labelPane = map.createPane('geoLabels'); labelPane.style.zIndex = 350; labelPane.style.pointerEvents = 'none';
  const renderer = L.canvas({ pane: 'base', padding: 0.5 });
  const layer = L.layerGroup().addTo(map);
  const draw = () => {
    layer.clearLayers();
    for (const off of [0, 360]) {   // two copies of the world fill the span from WEST to EAST
      const opt = { pane: 'base', renderer, interactive: false, coordsToLatLng: (c) => L.latLng(c[1], c[0] + off) };
      L.geoJSON(countries, { ...opt, style: { stroke: false, fillColor: css('--land'), fillOpacity: 1 } }).addTo(layer);
      L.geoJSON(coast, { ...opt, style: { color: css('--coast'), weight: 0.8, fill: false } }).addTo(layer);
      L.geoJSON(borders, { ...opt, style: { color: css('--border'), weight: 0.7, fill: false } }).addTo(layer);
      for (const [kind, name, lat, lon] of labels)
        L.marker([lat, lon + off], { pane: 'geoLabels', interactive: false, keyboard: false,
          icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<span class="geo ${kind}">${name}</span>` }) }).addTo(layer);
    }
  };
  draw(); onThemeChange(draw);
}

// ---------- routes ----------
// Group letters into lines: one per id (route, person, year, theme...) per origin, destination and kind.
// idsOf(letter) returns an id, a list of ids (a letter with several themes), or null to leave it out.
export function groupLines(letters, idsOf) {
  const lines = new Map();
  for (const l of letters) {
    for (const id of [].concat(idsOf(l) ?? [])) {
      const k = `${id}|${l.origin}|${l.dest}|${l.dest_kind === 'inferred' ? 'i' : 'p'}`;
      (lines.get(k) || lines.set(k, { id, key: k, origin: l.origin, dest: l.dest, inf: l.dest_kind === 'inferred', ls: [] }).get(k)).ls.push(l);
    }
  }
  return [...lines.values()];
}

function curve([y1, x1], [y2, x2], bend = 0.18, n = 40) {
  const dx = x2 - x1, dy = y2 - y1, cx = (x1 + x2) / 2 - dy * bend, cy = (y1 + y2) / 2 + dx * bend, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * y1 + 2 * u * t * cy + t * t * y2, u * u * x1 + 2 * u * t * cx + t * t * x2]); }
  return pts;
}

// Draw lines. style(line) -> {colour, weight, opacity, z}; lines sharing a route are fanned out in fanOrder.
export function drawLines(layer, ll, lines, { style, tooltip, onClick, fanOrder = () => 0 }) {
  layer.clearLayers();
  const fans = new Map();
  for (const ln of lines) { const k = `${ln.origin}|${ln.dest}`; (fans.get(k) || fans.set(k, []).get(k)).push(ln); }
  for (const g of fans.values()) {
    g.sort((a, b) => fanOrder(a) - fanOrder(b) || a.inf - b.inf);
    g.forEach((ln, i) => { ln.bend = 0.18 + (i - (g.length - 1) / 2) * 0.05; });
  }
  const styled = lines.map((ln) => [ln, style(ln)]).sort((a, b) => (a[1].z || 0) - (b[1].z || 0) || b[0].ls.length - a[0].ls.length);
  for (const [ln, s] of styled) {
    if (ln.origin === ln.dest) continue;
    const line = L.polyline(curve(ll(ln.origin), ll(ln.dest), ln.bend), {
      color: css(s.colour), weight: s.weight, opacity: s.opacity, dashArray: ln.inf ? '5 6' : null, lineCap: 'round',
      bubblingMouseEvents: false,   // a click on a route should not also count as a click on the empty map
    }).addTo(layer);
    line.bindTooltip(tooltip(ln), { sticky: true });
    line.on('click', (e) => onClick(ln, e.latlng));
  }
}
export const lineWeight = (n) => 1.3 + Math.sqrt(n) * 1.4;

// ---------- red and black circles ----------

// Destinations: semi-transparent red circles, larger for more letters (overlapping ones stay visible).
// Where Ponce sent from (Hong Kong, Yokohama): black circles, drawn on top where a place is both.
// on(place) gives a destination a thick outline.
export function drawPlaces(layer, ll, D, letters, { on = () => false, onDest, onBase }) {
  layer.clearLayers();
  const byPlace = {}; letters.forEach((l) => (byPlace[l.dest] ||= []).push(l));
  for (const [name, ls] of Object.entries(byPlace)) {
    const size = Math.round(2 * (3 + Math.sqrt(ls.length) * 2.2)), label = D.places[name].label;   // diameter, px
    const m = L.marker(ll(name), { title: `${label}: ${plural(ls.length, 'letter')}`, riseOnHover: true,
      icon: L.divIcon({ className: 'dest-dot' + (on(name) ? ' on' : ''), iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [size / 2, 0],
        html: `<svg viewBox="-1.1 -1.1 2.2 2.2" width="${size}" height="${size}" aria-hidden="true"><circle r="1"/></svg>` }) }).addTo(layer);
    m.bindTooltip(`${esc(label)} <span style="opacity:.7">${ls.length}</span>`, { permanent: true, direction: 'right', offset: [2, 0], className: 'plabel' });
    m.on('click', () => onDest(name, ls));
  }
  for (const o of ['Hong Kong', 'Yokohama']) {
    const mk = L.marker(ll(o), { zIndexOffset: 1000, title: `Ponce in ${o}`,
      icon: L.divIcon({ className: 'origin-dot', iconSize: [16, 16], iconAnchor: [8, 8],
        html: '<svg viewBox="-1.2 -1.2 2.4 2.4" width="16" height="16" aria-hidden="true"><circle r="1"/></svg>' }) }).addTo(layer);
    mk.bindTooltip(`Ponce · ${o}`, { permanent: true, direction: 'left', offset: [-8, 0], className: 'plabel origin' });
    mk.on('click', () => onBase(o));
  }
}

// ---------- the map key (lower right, minimizable) ----------
export const keyLine = (c, w = 3, dash = false) => `<svg viewBox="0 0 30 16" aria-hidden="true"><path d="M2 12 Q15 2 28 10" style="fill:none;stroke:var(${c});stroke-width:${w};stroke-linecap:round" ${dash ? 'stroke-dasharray="4 4"' : ''}/></svg>`;
export const keySquares = (cs) => `<svg viewBox="0 0 30 16" aria-hidden="true">${cs.map((c, i) => `<rect x="${1 + i * (28 / cs.length)}" y="4" width="${28 / cs.length - 1.5}" height="8" rx="1" style="fill:var(${c})"/>`).join('')}</svg>`;
const KEY_BASES = `<svg viewBox="0 0 30 16" aria-hidden="true"><circle cx="15" cy="8" r="5.5" style="fill:var(--origin);stroke:var(--origin-ring);stroke-width:1.5"/></svg>`;
const KEY_DESTS = `<svg viewBox="0 0 30 16" aria-hidden="true"><circle cx="7" cy="9" r="3.5" style="fill:var(--dest);fill-opacity:var(--dest-alpha);stroke:var(--dest)"/><circle cx="20" cy="8" r="6.5" style="fill:var(--dest);fill-opacity:var(--dest-alpha);stroke:var(--dest)"/></svg>`;

// rows: [[svg, text], ...] for this map's lines; the circles, green and dashed rows are added here
export function addKey(map, rows, foot = 'Click the empty map or press Esc to clear what you picked.') {
  const Key = L.Control.extend({ options: { position: 'bottomright' }, onAdd() {
    const d = L.DomUtil.create('details', 'map-key');
    if (innerWidth > 800) d.open = true;
    const all = [[KEY_BASES, '<b>Black circle</b>: where Ponce sent the letters from (Hong Kong, Yokohama)'], [KEY_DESTS, '<b>Red circle</b>: destination, larger for more letters'],
      ...rows, [keyLine('--sel', 4), '<b>Green</b>: what you picked; the rest turns grey'], [keyLine('--muted', 2, true), '<b>Dashed</b>: destination inferred']];
    d.innerHTML = `<summary>Map Key</summary><ul>${all.map(([svg, t]) => `<li>${svg}<span>${t}</span></li>`).join('')}</ul><div class="foot">${foot}</div>`;
    L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
    return d;
  } });
  new Key().addTo(map);
}

// ---------- popups ----------
export function letterPopup(map, ll, D, l) {
  const dest = l.dest ? esc(D.places[l.dest].label) : 'destination not identified';
  L.popup({ maxWidth: 340 }).setLatLng(l.dest ? ll(l.dest) : ll(l.origin)).setContent(`<div class="pop"><h3>No. ${l.n} · ${fmtDate(l.date)}</h3>
    <div class="meta">To <b>${esc(l.recipient)}</b> → ${dest}<br>From ${esc(l.origin)}${l.signed ? ` · signed “${esc(l.signed)}”` : ''}</div>
    ${l.summary ? `<div class="sum">${esc(l.summary)}</div>` : ''}
    <dl><dt>Dateline</dt><dd>${esc(l.dateline)}</dd><dt>Destination</dt><dd>${esc(l.dest_basis)}</dd><dt>Printed pp.</dt><dd>${esc(l.pages)}</dd></dl></div>`).openOn(map);
}
// a popup with a list; items are [html, attributes] and become links when they carry data- attributes
export function listPopup(map, latlng, title, meta, items) {
  L.popup().setLatLng(latlng).setContent(`<div class="pop"><h3>${title}</h3><div class="meta">${meta}</div>
    <ul>${items.map(([h, attrs]) => `<li>${attrs ? `<button class="link" ${attrs}>${h}</button>` : h}</li>`).join('')}</ul></div>`).openOn(map);
}
// clicks on links in popups: handlers = {n: letterNumber => ..., pick: value => ...}
export function onPopupLinks(map, handlers) {
  map.on('popupopen', (e) => e.popup.getElement().querySelectorAll('button.link').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.n) handlers.n?.(+b.dataset.n);
    if (b.dataset.pick !== undefined) handlers.pick?.(b.dataset.pick);
  })));
}

// ---------- the side panel ----------
export const panel = {
  title: (t) => { document.getElementById('panel-title').textContent = t; },
  meta: (h) => { document.getElementById('panel-meta').innerHTML = h; },
  body: (h) => { const b = document.getElementById('panel-body'); b.innerHTML = h; return b; },
};
// rows of letters; click one to see it on the map
export function letterRows(ls, D, { who = true } = {}) {
  if (!ls.length) return '<p class="hint">No letters.</p>';
  return `<ul class="letters">${ls.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n)).map((l) => `<li><button data-n="${l.n}">
    <span class="no">${l.n}<small>${l.date.slice(0, 4)}</small></span>
    <span class="who">${who ? esc(l.recipient) : fmtDate(l.date)}</span>
    <span class="where"><span class="o ${oKey(l.origin)}">${esc(l.origin)}</span> → ${l.dest ? esc(D.places[l.dest].label) : 'place unknown'}${l.dest_kind === 'inferred' ? '<span class="tag">inferred</span>' : ''}${who ? ` · ${fmtDate(l.date)}` : ''}</span>
    ${l.summary ? `<span class="sum">${esc(l.summary)}</span>` : '<span></span>'}</button></li>`).join('')}</ul>`;
}
export const wire = (root, selector, fn) => root.querySelectorAll(selector).forEach((el) => el.addEventListener('click', () => fn(el)));
// horizontal bars: rows [[label, value]], colour(label) -> CSS variable
export function bars(rows, colour = () => '--ink') {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return `<div class="bars">${rows.map(([k, v]) => `<span title="${esc(k)}">${esc(k)}</span><span class="bar"><i style="width:${(v / max) * 100}%;--c:var(${colour(k)})"></i></span><span class="v">${v}</span>`).join('')}</div>`;
}

// the panel's minimize button; the map is resized to fill the space
export function panelToggle(map) {
  const btn = document.getElementById('panel-toggle'), layout = document.querySelector('.layout');
  btn.onclick = () => {
    const whole = map.getZoom() <= map.getMinZoom() + 0.01;
    const min = layout.classList.toggle('panel-min'), label = min ? 'Show the side panel' : 'Minimize the side panel';
    btn.textContent = min ? '+' : '–'; btn.setAttribute('aria-expanded', String(!min)); btn.title = label; btn.setAttribute('aria-label', label);
    map.invalidateSize();
    if (whole) map.fitBounds(WHOLE_WORLD, { animate: false });
  };
}

// clear what was picked: a click on the empty map, or the Esc key
export function onClear(map, fn) {
  map.on('click', fn);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fn(); });
}
