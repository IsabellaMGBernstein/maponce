// The Regions map, self-contained: it shares no code with the other maps.
// Shows only the letters sent to one region, Europe, Asia or North America, chosen in the menu at the top left
// of the map, which zooms to the region. Routes run from where Ponce wrote (black circle) to the destination
// (red circle). Click a route, a red circle or a recipient in the bar below: it turns green, the rest grey,
// and its letters are listed in the side panel. The bar along the foot gives the region's statistics.
// The region is kept in the address (regions/#asia), so a link can open a region directly.
(async function () {
const L = window.L, topojson = window.topojson;

// ---------- helpers ----------
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const oKey = (o) => (o === 'Hong Kong' ? 'hk' : 'yk');
const countBy = (list, f) => {   // [[key, count], ...] most first
  const c = {}; list.forEach((x) => { const k = f(x); c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
const dark = matchMedia('(prefers-color-scheme: dark)');

// ---------- data ----------
const D = await (await fetch('/regions/data.json')).json();   // places, letters, and the three regions
const regionOf = () => D.regions.find((r) => r.key === location.hash.slice(1)) || D.regions[0];
let R = regionOf();
const inRegion = (r) => D.letters.filter((l) => l.dest && r.places[l.dest]);
const inferredBox = document.getElementById('inferred');
const drawable = (l) => l.dest_kind !== 'inferred' || inferredBox.checked;

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
map.fitBounds(R.view);   // the chosen region

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

// ---------- the region menu (top left) ----------
const Pick = L.Control.extend({ options: { position: 'topleft' }, onAdd() {
  const d = L.DomUtil.create('label', 'region-pick');
  d.innerHTML = `Region <select id="region-select">${D.regions.map((r) => `<option value="${r.key}">${esc(r.name)}</option>`).join('')}</select>`;
  L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
  return d;
} });
new Pick().addTo(map);
const select = document.getElementById('region-select');
select.value = R.key;
select.onchange = () => { location.hash = select.value; };
addEventListener('hashchange', () => {
  R = regionOf(); select.value = R.key;
  Object.assign(S, { route: null, place: null, who: null }); map.closePopup();
  map.fitBounds(R.view); render();
});

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
    [keyLine('--sel', 4), '<b>Green</b>: what you picked; the rest turns grey'],
    [keyLine('--muted', 2, true), '<b>Dashed</b>: destination inferred'],
  ];
  d.innerHTML = `<summary>Map Key</summary><ul>${rows.map(([svg, t]) => `<li>${svg}<span>${t}</span></li>`).join('')}</ul>
    <div class="foot">Click a route, a red circle or a recipient in the bar below. Click the empty map or press Esc to clear it.</div>`;
  L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
  return d;
} });
new Key().addTo(map);
document.getElementById('legend').innerHTML =
  `<span class="key" style="--c:var(--line)"><span class="sw"></span>route of a letter</span>` +
  `<span class="key" style="--c:var(--sel)"><span class="sw"></span>what you picked</span>` +
  `<span class="key"><span class="sw dash"></span>destination inferred</span><span class="key">line width = number of letters</span>`;

// ---------- drawing ----------
const routeLayer = L.layerGroup().addTo(map), markLayer = L.layerGroup().addTo(map);
const S = { route: null, place: null, who: null };
const routeKey = (l) => `${l.origin}|${l.dest}|${l.dest_kind === 'inferred' ? 'i' : 'p'}`;
function curve([y1, x1], [y2, x2], bend = 0.18, n = 40) {
  const dx = x2 - x1, dy = y2 - y1, cx = (x1 + x2) / 2 - dy * bend, cy = (y1 + y2) / 2 + dx * bend, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * y1 + 2 * u * t * cy + t * t * y2, u * u * x1 + 2 * u * t * cx + t * t * x2]); }
  return pts;
}

function render() {
  routeLayer.clearLayers(); markLayer.clearLayers();
  const all = inRegion(R), ls = all.filter(drawable);
  const routes = new Map();
  for (const l of ls) { const k = routeKey(l); (routes.get(k) || routes.set(k, { key: k, origin: l.origin, dest: l.dest, inf: l.dest_kind === 'inferred', ls: [] }).get(k)).ls.push(l); }
  if (S.route && !routes.has(S.route)) S.route = null;   // hidden by the checkbox
  const isOn = (r) => r.key === S.route || (!!S.who && r.ls.some((l) => l.recipient === S.who)) || (!!S.place && r.dest === S.place);
  const any = S.route || S.who || S.place;
  for (const r of [...routes.values()].sort((a, b) => isOn(a) - isOn(b) || b.ls.length - a.ls.length)) {
    if (r.origin === r.dest) continue;
    const on = isOn(r), off = any && !on;
    const line = L.polyline(curve(ll(r.origin), ll(r.dest)), {
      color: css(on ? '--sel' : off ? '--trace' : '--line'), weight: 1.3 + Math.sqrt(r.ls.length) * 1.4 + (on ? 1.5 : 0),
      opacity: on ? 1 : off ? 0.4 : 0.85, dashArray: r.inf ? '5 6' : null, lineCap: 'round',
      bubblingMouseEvents: false,   // a click on a route should not also count as a click on the empty map
    }).addTo(routeLayer);
    line.bindTooltip(`${esc(r.origin)} → ${esc(D.places[r.dest].label)}: ${plural(r.ls.length, 'letter')}${r.inf ? ' (inferred)' : ''}`, { sticky: true });
    line.on('click', () => { Object.assign(S, { route: r.key, place: null, who: null }); map.closePopup(); render(); });
  }
  // destinations in the region: semi-transparent red circles, larger for more letters
  const byPlace = {}; ls.forEach((l) => (byPlace[l.dest] ||= []).push(l));
  for (const [name, pls] of Object.entries(byPlace)) {
    const size = Math.round(2 * (3 + Math.sqrt(pls.length) * 2.2)), label = D.places[name].label;
    const on = S.place === name || (!!S.who && pls.some((l) => l.recipient === S.who));
    const m = L.marker(ll(name), { title: `${label}: ${plural(pls.length, 'letter')}`, riseOnHover: true,
      icon: L.divIcon({ className: 'dest-dot' + (on ? ' on' : ''), iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [size / 2, 0],
        html: `<svg viewBox="-1.1 -1.1 2.2 2.2" width="${size}" height="${size}" aria-hidden="true"><circle r="1"/></svg>` }) }).addTo(markLayer);
    m.bindTooltip(`${esc(label)} <span style="opacity:.7">${pls.length}</span>`, { permanent: true, direction: 'right', offset: [2, 0], className: 'plabel' });
    m.on('click', () => { Object.assign(S, { place: name, route: null, who: null }); map.closePopup(); render(); });
  }
  // where Ponce wrote: black circles, on top
  for (const o of ['Hong Kong', 'Yokohama']) {
    const mk = L.marker(ll(o), { zIndexOffset: 1000, title: `Ponce in ${o}`, interactive: false,
      icon: L.divIcon({ className: 'origin-dot', iconSize: [18, 18], iconAnchor: [9, 9],
        html: '<svg viewBox="-1.2 -1.2 2.4 2.4" width="18" height="18" aria-hidden="true"><circle r="1"/></svg>' }) }).addTo(markLayer);
    mk.bindTooltip(`Ponce · ${o}`, { permanent: true, direction: 'left', offset: [-9, 0], className: 'plabel origin' });
  }
  renderStats(all); renderPanel(all);
}

// ---------- statistics bar along the foot ----------
// Counts cover every letter to the region, printed and inferred addresses alike (the checkbox only changes the map).
function renderStats(all) {
  const total = D.letters.length, printed = all.filter((l) => l.dest_kind === 'printed').length;
  const bars = (rows, opts = {}) => { const max = Math.max(1, ...rows.map(([, v]) => v));
    return `<div class="bars">${rows.map(([k, v, extra = '']) => `${opts.button ? `<button class="lab" data-region="${extra}">${esc(k)}</button>` : `<span class="lab${k === opts.current ? ' cur' : ''}" title="${esc(k)}">${esc(k)}</span>`}<span class="bar"><i style="width:${(v / max) * 100}%;--c:var(${opts.colour ? opts.colour(k) : '--line'})"></i></span><span class="v">${v}</span>`).join('')}</div>`; };
  const who = countBy(all, (l) => l.recipient);
  document.getElementById('statbar').innerHTML = `
    <div class="tile"><h3>Letters to ${esc(R.name)}</h3><div class="hero">${all.length}</div>
      <div class="small">of all ${total} letters (${Math.round((all.length / total) * 100)}%)<br>${printed} with a printed address, ${all.length - printed} inferred</div></div>
    <div class="tile"><h3>Letters per region</h3>${bars(D.regions.map((r) => [r.name, inRegion(r).length]), { current: R.name, colour: (k) => (k === R.name ? '--sel' : '--trace') })}</div>
    <div class="tile"><h3>Recipients in ${esc(R.name)} (${who.length})</h3>
      <ul class="who-mini">${who.map(([k, v]) => `<li><button data-who="${esc(k)}" aria-pressed="${S.who === k}" title="Show the letters to ${esc(k)}"><span>${esc(k)}</span><span class="v">${v}</span></button></li>`).join('')}</ul></div>
    <div class="tile"><h3>Sent from</h3>${bars(countBy(all, (l) => l.origin))}</div>
    <div class="tile"><h3>By country (1890s borders)</h3>${bars(countBy(all, (l) => R.places[l.dest]))}</div>
    <div class="tile"><h3>By year</h3>${bars([1897, 1898, 1899, 1900].map((y) => [String(y), all.filter((l) => +l.date.slice(0, 4) === y).length]))}</div>`;
  document.querySelectorAll('#statbar button[data-who]').forEach((b) => { b.onclick = () => {
    Object.assign(S, { who: S.who === b.dataset.who ? null : b.dataset.who, route: null, place: null }); map.closePopup(); render(); }; });
}

// ---------- the side panel: letters of the picked route, place or recipient ----------
function renderPanel(all) {
  document.getElementById('panel-title').textContent = `Letters to ${R.name}`;
  let ls = [], label = '';
  if (S.route) { const [o, d, kind] = S.route.split('|'); ls = all.filter((l) => routeKey(l) === S.route); label = `${esc(o)} → ${esc(D.places[d].label)}${kind === 'i' ? ' (inferred)' : ''}`; }
  else if (S.place) { ls = all.filter((l) => l.dest === S.place); label = `to ${esc(D.places[S.place].label)}`; }
  else if (S.who) { ls = all.filter((l) => l.recipient === S.who); label = `to ${esc(S.who)}`; }
  document.getElementById('panel-meta').innerHTML = label
    ? `${plural(ls.length, 'letter')} <span class="chip">${label}<button aria-label="Clear">×</button></span>` : plural(all.length, 'letter');
  const clear = document.querySelector('#panel-meta .chip button'); if (clear) clear.onclick = reset;
  const body = document.getElementById('panel-body');
  body.innerHTML = !label
    ? `<p class="hint">Click a route or a red circle on the map, or a recipient in the bar below, to list the letters here. Choose another region at the top left of the map.</p>`
    : `<ul class="letters">${ls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n)).map((l) => `<li><button data-n="${l.n}">
        <span class="no">${l.n}<small>${l.date.slice(0, 4)}</small></span><span class="who">${esc(l.recipient)}</span>
        <span class="where"><span class="o ${oKey(l.origin)}">${esc(l.origin)}</span> → ${esc(D.places[l.dest].label)}${l.dest_kind === 'inferred' ? '<span class="tag">inferred</span>' : ''} · ${fmtDate(l.date)}</span>
        ${l.summary ? `<span class="sum">${esc(l.summary)}</span>` : '<span></span>'}</button></li>`).join('')}</ul>`;
  body.querySelectorAll('button[data-n]').forEach((b) => { b.onclick = () => letterPopup(D.letters.find((l) => l.n === +b.dataset.n)); });
}
function letterPopup(l) {
  L.popup({ maxWidth: 340 }).setLatLng(ll(l.dest)).setContent(`<div class="pop"><h3>No. ${l.n} · ${fmtDate(l.date)}</h3>
    <div class="meta">To <b>${esc(l.recipient)}</b> → ${esc(D.places[l.dest].label)}<br>From ${esc(l.origin)}${l.signed ? ` · signed “${esc(l.signed)}”` : ''}</div>
    ${l.summary ? `<div class="sum">${esc(l.summary)}</div>` : ''}
    <dl><dt>Dateline</dt><dd>${esc(l.dateline)}</dd><dt>Destination</dt><dd>${esc(l.dest_basis)}</dd><dt>Printed pp.</dt><dd>${esc(l.pages)}</dd></dl></div>`).openOn(map);
}

// clear what was picked: a click on the empty map, the Esc key, or the × in the side panel
function reset() { if (S.route || S.place || S.who) { Object.assign(S, { route: null, place: null, who: null }); map.closePopup(); render(); } }
map.on('click', reset);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') reset(); });
inferredBox.onchange = render;
dark.addEventListener('change', () => { drawBase(); render(); });

// the side panel's minimize button; the map is resized and keeps showing the region
const toggle = document.getElementById('panel-toggle'), layout = document.querySelector('.layout');
toggle.onclick = () => {
  const min = layout.classList.toggle('panel-min'), text = min ? 'Show the side panel' : 'Minimize the side panel';
  toggle.textContent = min ? '+' : '–'; toggle.setAttribute('aria-expanded', String(!min)); toggle.title = text; toggle.setAttribute('aria-label', text);
  map.invalidateSize(); map.fitBounds(R.view, { animate: false });
};

render();
})();
