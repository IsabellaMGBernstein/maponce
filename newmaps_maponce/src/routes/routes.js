// The Routes map, self-contained: it shares no code with the other maps.
// A world map with all seven continents. Every letter is a route from where Ponce sent it (black circle)
// to its destination (semi-transparent red circle). Click a route: it turns green and the others grey.
// Click a red or black circle to list its letters. The key in the lower right can be minimized.
(async function () {
const L = window.L, topojson = window.topojson;

// ---------- helpers ----------
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const oKey = (o) => (o === 'Hong Kong' ? 'hk' : 'yk');
const dark = matchMedia('(prefers-color-scheme: dark)');

// ---------- data ----------
const D = await (await fetch('/routes/data.json')).json();   // places and letters
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

// ---------- the map key (lower right, minimizable) ----------
const keyLine = (c, w = 3, dash = false) => `<svg viewBox="0 0 30 16" aria-hidden="true"><path d="M2 12 Q15 2 28 10" style="fill:none;stroke:var(${c});stroke-width:${w};stroke-linecap:round" ${dash ? 'stroke-dasharray="4 4"' : ''}/></svg>`;
const Key = L.Control.extend({ options: { position: 'bottomright' }, onAdd() {
  const d = L.DomUtil.create('details', 'map-key');
  if (innerWidth > 800) d.open = true;
  const rows = [
    ['<svg viewBox="0 0 30 16" aria-hidden="true"><circle cx="15" cy="8" r="5.5" style="fill:var(--origin);stroke:var(--origin-ring);stroke-width:1.5"/></svg>',
      '<b>Black circle</b>: where Ponce wrote the letters (Hong Kong, Yokohama)'],
    ['<svg viewBox="0 0 30 16" aria-hidden="true"><circle cx="7" cy="9" r="3.5" style="fill:var(--dest);fill-opacity:var(--dest-alpha);stroke:var(--dest)"/><circle cx="20" cy="8" r="6.5" style="fill:var(--dest);fill-opacity:var(--dest-alpha);stroke:var(--dest)"/></svg>',
      '<b>Red circle</b>: destination, larger for more letters'],
    [keyLine('--line'), '<b>Route</b> from a black circle to a red circle; thicker = more letters'],
    [keyLine('--sel', 4), '<b>Green</b>: the route you picked; the others turn grey'],
    [keyLine('--muted', 2, true), '<b>Dashed</b>: destination inferred'],
  ];
  d.innerHTML = `<summary>Map Key</summary><ul>${rows.map(([svg, t]) => `<li>${svg}<span>${t}</span></li>`).join('')}</ul>
    <div class="foot">Click a route to highlight it. Click the empty map or press Esc to clear it.</div>`;
  L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
  return d;
} });
new Key().addTo(map);

document.getElementById('legend').innerHTML =
  `<span class="key" style="--c:var(--line)"><span class="sw"></span>route of a letter</span>` +
  `<span class="key" style="--c:var(--sel)"><span class="sw"></span>route you picked</span>` +
  `<span class="key"><span class="sw dash"></span>destination inferred</span><span class="key">line width = number of letters</span>`;

// ---------- drawing ----------
const routeLayer = L.layerGroup().addTo(map), markLayer = L.layerGroup().addTo(map);
const S = { route: null, place: null };   // place: a destination, or "from:Hong Kong" / "from:Yokohama"
const routeKey = (l) => `${l.origin}|${l.dest}|${l.dest_kind === 'inferred' ? 'i' : 'p'}`;
function curve([y1, x1], [y2, x2], bend = 0.18, n = 40) {
  const dx = x2 - x1, dy = y2 - y1, cx = (x1 + x2) / 2 - dy * bend, cy = (y1 + y2) / 2 + dx * bend, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * y1 + 2 * u * t * cy + t * t * y2, u * u * x1 + 2 * u * t * cx + t * t * x2]); }
  return pts;
}

function render() {
  routeLayer.clearLayers(); markLayer.clearLayers();
  const ls = D.letters.filter(drawable);
  // one route per origin, destination and kind (printed or inferred address)
  const routes = new Map();
  for (const l of ls) { const k = routeKey(l); (routes.get(k) || routes.set(k, { key: k, origin: l.origin, dest: l.dest, inf: l.dest_kind === 'inferred', ls: [] }).get(k)).ls.push(l); }
  if (S.route && !routes.has(S.route)) S.route = null;   // hidden by the checkbox
  // the picked route is drawn last, on top
  for (const r of [...routes.values()].sort((a, b) => (a.key === S.route) - (b.key === S.route) || b.ls.length - a.ls.length)) {
    if (r.origin === r.dest) continue;
    const on = r.key === S.route, off = S.route && !on;
    const line = L.polyline(curve(ll(r.origin), ll(r.dest)), {
      color: css(on ? '--sel' : off ? '--trace' : '--line'), weight: 1.3 + Math.sqrt(r.ls.length) * 1.4 + (on ? 1.5 : 0),
      opacity: on ? 1 : off ? 0.4 : 0.8, dashArray: r.inf ? '5 6' : null, lineCap: 'round',
      bubblingMouseEvents: false,   // a click on a route should not also count as a click on the empty map
    }).addTo(routeLayer);
    line.bindTooltip(`${esc(r.origin)} → ${esc(D.places[r.dest].label)}: ${plural(r.ls.length, 'letter')}${r.inf ? ' (inferred)' : ''}`, { sticky: true });
    line.on('click', () => { S.route = r.key; S.place = null; render(); });
  }
  // destinations: semi-transparent red circles, larger for more letters
  const byPlace = {}; ls.forEach((l) => (byPlace[l.dest] ||= []).push(l));
  for (const [name, pls] of Object.entries(byPlace)) {
    const size = Math.round(2 * (3 + Math.sqrt(pls.length) * 2.2)), label = D.places[name].label;   // diameter, px
    const m = L.marker(ll(name), { title: `${label}: ${plural(pls.length, 'letter')}`, riseOnHover: true,
      icon: L.divIcon({ className: 'dest-dot' + (S.place === name ? ' on' : ''), iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [size / 2, 0],
        html: `<svg viewBox="-1.1 -1.1 2.2 2.2" width="${size}" height="${size}" aria-hidden="true"><circle r="1"/></svg>` }) }).addTo(markLayer);
    m.bindTooltip(`${esc(label)} <span style="opacity:.7">${pls.length}</span>`, { permanent: true, direction: 'right', offset: [2, 0], className: 'plabel' });
    m.on('click', () => { S.place = name; S.route = null; render(); });
  }
  // where Ponce wrote: black circles, on top
  for (const o of ['Hong Kong', 'Yokohama']) {
    const mk = L.marker(ll(o), { zIndexOffset: 1000, title: `Ponce in ${o}`,
      icon: L.divIcon({ className: 'origin-dot', iconSize: [18, 18], iconAnchor: [9, 9],
        html: '<svg viewBox="-1.2 -1.2 2.4 2.4" width="18" height="18" aria-hidden="true"><circle r="1"/></svg>' }) }).addTo(markLayer);
    mk.bindTooltip(`Ponce · ${o}`, { permanent: true, direction: 'left', offset: [-9, 0], className: 'plabel origin' });
    mk.on('click', () => { S.place = `from:${o}`; S.route = null; render(); });
  }
  renderPanel();
}

// ---------- the side panel: letters of the picked route or place ----------
function renderPanel() {
  let ls = [], label = '';
  if (S.route) {
    const [o, d, kind] = S.route.split('|');
    ls = D.letters.filter((l) => routeKey(l) === S.route);
    label = `${esc(o)} → ${esc(D.places[d].label)}${kind === 'i' ? ' (inferred)' : ''}`;
  } else if (S.place) {
    const from = S.place.startsWith('from:') ? S.place.slice(5) : null;
    ls = D.letters.filter((l) => (from ? l.origin === from : l.dest === S.place));
    label = from ? `sent from ${esc(from)}` : `to ${esc(D.places[S.place].label)}`;
  }
  document.getElementById('panel-meta').innerHTML = label
    ? `${plural(ls.length, 'letter')} <span class="chip">${label}<button aria-label="Clear">×</button></span>` : `${D.letters.length} letters`;
  const clear = document.querySelector('#panel-meta .chip button'); if (clear) clear.onclick = reset;
  const body = document.getElementById('panel-body');
  body.innerHTML = !label
    ? '<p class="hint">Click a route on the map to list its letters here. You can also click a red circle for the letters received there, or a black circle for every letter Ponce wrote there.</p>'
    : `<ul class="letters">${ls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n)).map((l) => `<li><button data-n="${l.n}">
        <span class="no">${l.n}<small>${l.date.slice(0, 4)}</small></span><span class="who">${esc(l.recipient)}</span>
        <span class="where"><span class="o ${oKey(l.origin)}">${esc(l.origin)}</span> → ${l.dest ? esc(D.places[l.dest].label) : 'place unknown'}${l.dest_kind === 'inferred' ? '<span class="tag">inferred</span>' : ''} · ${fmtDate(l.date)}</span>
        ${l.summary ? `<span class="sum">${esc(l.summary)}</span>` : '<span></span>'}</button></li>`).join('')}</ul>`;
  body.querySelectorAll('button[data-n]').forEach((b) => { b.onclick = () => letterPopup(D.letters.find((l) => l.n === +b.dataset.n)); });
}
function letterPopup(l) {
  const dest = l.dest ? esc(D.places[l.dest].label) : 'destination not identified';
  L.popup({ maxWidth: 340 }).setLatLng(l.dest ? ll(l.dest) : ll(l.origin)).setContent(`<div class="pop"><h3>No. ${l.n} · ${fmtDate(l.date)}</h3>
    <div class="meta">To <b>${esc(l.recipient)}</b> → ${dest}<br>From ${esc(l.origin)}${l.signed ? ` · signed “${esc(l.signed)}”` : ''}</div>
    ${l.summary ? `<div class="sum">${esc(l.summary)}</div>` : ''}
    <dl><dt>Dateline</dt><dd>${esc(l.dateline)}</dd><dt>Destination</dt><dd>${esc(l.dest_basis)}</dd><dt>Printed pp.</dt><dd>${esc(l.pages)}</dd></dl></div>`).openOn(map);
}

// clear what was picked: a click on the empty map, or the Esc key
function reset() { if (S.route || S.place) { S.route = S.place = null; map.closePopup(); render(); } }
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
