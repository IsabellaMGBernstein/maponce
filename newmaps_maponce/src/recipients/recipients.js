// The Recipients map, self-contained: it shares no code with the other maps.
// A world map with all seven continents. One line per recipient per route, from where Ponce wrote (yellow
// circle) to the destination (red circle). The eight recipients with the most mapped letters have their own
// colours (Fernando Blumentritt in red); everyone else is grey. Click a route or a name: that person's routes
// turn green and the others grey, and the side panel shows their biography and statistics.
// The key in the lower right can be minimized.
(async function () {
const L = window.L, topojson = window.topojson;

// ---------- helpers ----------
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const oKey = (o) => (o === 'Hong Kong' ? 'hk' : 'yk');
const countBy = (list, f) => {   // [[key, count], ...] most first; f may return a list
  const c = {}; list.forEach((x) => [].concat(f(x)).forEach((k) => { c[k] = (c[k] || 0) + 1; }));
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();   // search ignores accents
const dark = matchMedia('(prefers-color-scheme: dark)');
const YEARS = [1897, 1898, 1899, 1900];

// ---------- data ----------
const D = await (await fetch('/recipients/data.json')).json();   // places, letters, biographies, confirmed themes
const BY = new Map();
for (const l of D.letters) (BY.get(l.recipient) || BY.set(l.recipient, []).get(l.recipient)).push(l);
const NAMES = [...BY.keys()].sort((a, b) => BY.get(b).length - BY.get(a).length || a.localeCompare(b));
const hasRoute = (r) => BY.get(r).some((l) => l.dest);
// The eight recipients with the most letters that can be drawn get their own colour; ties are broken alphabetically.
const COLOURED = NAMES.filter(hasRoute).slice(0, 8);
const colourOf = (r) => { const i = COLOURED.indexOf(r); return i >= 0 ? `--r${i + 1}` : '--other'; };
const themesOf = (l) => D.themes[String(l.n)] || [];
const inferredBox = document.getElementById('inferred');
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
      '<b>Yellow circle</b>: where Ponce wrote the letters (Hong Kong, Yokohama)'],
    ['<svg viewBox="0 0 30 16" aria-hidden="true"><circle cx="7" cy="9" r="3.5" style="fill:var(--dest);fill-opacity:var(--dest-alpha);stroke:var(--dest)"/><circle cx="20" cy="8" r="6.5" style="fill:var(--dest);fill-opacity:var(--dest-alpha);stroke:var(--dest)"/></svg>',
      '<b>Red circle</b>: destination, larger for more letters'],
    ...COLOURED.map((r) => [keyLine(colourOf(r)), `<b>${esc(r)}</b>`]),
    [keyLine('--other', 2), '<b>Grey</b>: the other recipients'],
    [keyLine('--sel', 4), '<b>Green</b>: the recipient you picked; the others turn grey'],
    [keyLine('--muted', 2, true), '<b>Dashed</b>: destination inferred'],
  ];
  d.innerHTML = `<summary>Map Key</summary><ul>${rows.map(([svg, t]) => `<li>${svg}<span>${t}</span></li>`).join('')}</ul>
    <div class="foot">Routes shared by several recipients are fanned out. Click a route or a name to pick a recipient; click the empty map or press Esc to clear it.</div>`;
  L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
  return d;
} });
new Key().addTo(map);
document.getElementById('legend').innerHTML = COLOURED.map((r) => `<span class="key" style="--c:var(${colourOf(r)})"><span class="sw"></span>${esc(r)}</span>`).join('') +
  `<span class="key" style="--c:var(--other)"><span class="sw"></span>others</span><span class="key"><span class="sw dash"></span>destination inferred</span>`;

// ---------- drawing ----------
const routeLayer = L.layerGroup().addTo(map), markLayer = L.layerGroup().addTo(map);
const S = { who: null };
let query = '';
function curve([y1, x1], [y2, x2], bend = 0.18, n = 40) {
  const dx = x2 - x1, dy = y2 - y1, cx = (x1 + x2) / 2 - dy * bend, cy = (y1 + y2) / 2 + dx * bend, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * y1 + 2 * u * t * cy + t * t * y2, u * u * x1 + 2 * u * t * cx + t * t * x2]); }
  return pts;
}

function render() {
  routeLayer.clearLayers(); markLayer.clearLayers();
  const ls = D.letters.filter(drawable);
  // one line per recipient per route (printed and inferred addresses kept apart)
  const lines = new Map();
  for (const l of ls) {
    const k = `${l.recipient}|${l.origin}|${l.dest}|${l.dest_kind === 'inferred' ? 'i' : 'p'}`;
    (lines.get(k) || lines.set(k, { who: l.recipient, origin: l.origin, dest: l.dest, inf: l.dest_kind === 'inferred', ls: [] }).get(k)).ls.push(l);
  }
  // recipients sharing a route are fanned out side by side
  const fans = new Map();
  for (const ln of lines.values()) { const k = `${ln.origin}|${ln.dest}`; (fans.get(k) || fans.set(k, []).get(k)).push(ln); }
  for (const g of fans.values()) {
    g.sort((a, b) => NAMES.indexOf(a.who) - NAMES.indexOf(b.who) || a.inf - b.inf);
    g.forEach((ln, i) => { ln.bend = 0.18 + (i - (g.length - 1) / 2) * 0.05; });
  }
  // drawing order: grey recipients first, then the coloured ones, the picked one on top
  const rank = (ln) => (ln.who === S.who ? 2 : colourOf(ln.who) === '--other' ? 0 : 1);
  for (const ln of [...lines.values()].sort((a, b) => rank(a) - rank(b) || b.ls.length - a.ls.length)) {
    if (ln.origin === ln.dest) continue;
    const on = ln.who === S.who, off = S.who && !on, grey = colourOf(ln.who) === '--other';
    const line = L.polyline(curve(ll(ln.origin), ll(ln.dest), ln.bend), {
      color: css(on ? '--sel' : off ? '--trace' : colourOf(ln.who)),
      weight: (grey && !on ? 1 : 1.2 + Math.sqrt(ln.ls.length) * 1.3) + (on ? 1.5 : 0),
      opacity: on ? 1 : off ? 0.3 : grey ? 0.7 : 0.9, dashArray: ln.inf ? '5 6' : null, lineCap: 'round',
      bubblingMouseEvents: false,   // a click on a route should not also count as a click on the empty map
    }).addTo(routeLayer);
    line.bindTooltip(`<b>${esc(ln.who)}</b><br>${esc(ln.origin)} → ${esc(D.places[ln.dest].label)}: ${plural(ln.ls.length, 'letter')}${ln.inf ? ' (inferred)' : ''}`, { sticky: true });
    line.on('click', () => pick(ln.who));
  }
  // destinations: semi-transparent red circles; outlined where the picked recipient received letters
  const byPlace = {}; ls.forEach((l) => (byPlace[l.dest] ||= []).push(l));
  for (const [name, pls] of Object.entries(byPlace)) {
    const size = Math.round(2 * (3 + Math.sqrt(pls.length) * 2.2)), label = D.places[name].label;
    const on = !!S.who && pls.some((l) => l.recipient === S.who);
    const m = L.marker(ll(name), { title: `${label}: ${plural(pls.length, 'letter')}`, riseOnHover: true,
      icon: L.divIcon({ className: 'dest-dot' + (on ? ' on' : ''), iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [size / 2, 0],
        html: `<svg viewBox="-1.1 -1.1 2.2 2.2" width="${size}" height="${size}" aria-hidden="true"><circle r="1"/></svg>` }) }).addTo(markLayer);
    m.bindTooltip(`${esc(label)} <span style="opacity:.7">${pls.length}</span>`, { permanent: true, direction: 'right', offset: [2, 0], className: 'plabel' });
    m.on('click', () => whoPopup(label, 'received letters here', pls, ll(name)));
  }
  // where Ponce wrote: yellow circles, on top
  for (const o of ['Hong Kong', 'Yokohama']) {
    const mk = L.marker(ll(o), { zIndexOffset: 1000, title: `Ponce in ${o}`,
      icon: L.divIcon({ className: 'origin-dot', iconSize: [18, 18], iconAnchor: [9, 9],
        html: '<svg viewBox="-1.2 -1.2 2.4 2.4" width="18" height="18" aria-hidden="true"><circle r="1"/></svg>' }) }).addTo(markLayer);
    mk.bindTooltip(`Ponce · ${o}`, { permanent: true, direction: 'left', offset: [-9, 0], className: 'plabel origin' });
    mk.on('click', () => whoPopup(`Ponce in ${o}`, 'he wrote to from here', D.letters.filter((l) => l.origin === o), ll(o)));
  }
  renderPanel();
}

// who received letters at a place, or who Ponce wrote to from a base; each name can be picked
function whoPopup(title, verb, ls, latlng) {
  const rows = countBy(ls, (l) => l.recipient);
  L.popup().setLatLng(latlng).setContent(`<div class="pop"><h3>${esc(title)}</h3><div class="meta">${plural(rows.length, 'recipient')} ${verb}</div>
    <ul>${rows.map(([k, v]) => `<li><button class="link" data-who="${esc(k)}">${esc(k)}</button> <span style="opacity:.7">(${v})</span></li>`).join('')}</ul></div>`).openOn(map);
}
map.on('popupopen', (e) => e.popup.getElement().querySelectorAll('button[data-who]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.who))));

// ---------- pie chart of the top recipients (top of the side panel) ----------
// The eight recipients with their own route colour, each in that colour, and everyone else as one grey slice.
// Slices run clockwise from the top, largest first. Clicking a slice or a name picks that recipient.
function topPie() {
  const total = D.letters.length, pct = (n) => `${Math.round((n / total) * 100)}%`;
  const items = COLOURED.map((r) => ({ who: r, n: BY.get(r).length, c: colourOf(r) }));
  const rest = total - items.reduce((a, it) => a + it.n, 0);
  items.push({ who: null, n: rest, c: '--other', name: `${NAMES.length - COLOURED.length} others` });
  const R = 50, pt = (t) => `${(R * Math.cos(t)).toFixed(2)},${(R * Math.sin(t)).toFixed(2)}`;
  let a = -Math.PI / 2;
  const slices = items.map((it) => {
    const b = a + (it.n / total) * 2 * Math.PI, d = `M0,0 L${pt(a)} A${R},${R} 0 ${b - a > Math.PI ? 1 : 0} 1 ${pt(b)} Z`; a = b;
    return `<path d="${d}" style="fill:var(${it.c})" ${it.who ? `data-who="${esc(it.who)}"` : ''}><title>${esc(it.who || it.name)}: ${plural(it.n, 'letter')} (${pct(it.n)})</title></path>`;
  }).join('');
  return `<section class="top-pie" aria-label="Top recipients">
    <h4>Top recipients</h4>
    <div class="pie-row">
      <svg viewBox="-51 -51 102 102" role="img" aria-label="Share of the ${total} letters: ${items.map((it) => `${esc(it.who || it.name)} ${it.n}`).join(', ')}">${slices}</svg>
      <ul class="pie-legend">${items.map((it) => `<li>${it.who ? `<button data-who="${esc(it.who)}">` : '<span class="rest">'}<span class="dot" style="--c:var(${it.c})"></span><span class="nm">${esc(it.who || it.name)}</span><span class="v">${it.n} · ${pct(it.n)}</span>${it.who ? '</button>' : '</span>'}</li>`).join('')}</ul>
    </div>
    <p class="pie-note">Share of all ${total} letters. Click a slice or a name to see that person.</p>
  </section>`;
}

// ---------- the side panel: all recipients, or one recipient's biography and statistics ----------
function renderPanel() {
  const meta = document.getElementById('panel-meta'), body = document.getElementById('panel-body');
  if (!S.who) {
    document.getElementById('panel-title').textContent = 'Recipients';
    const names = NAMES.filter((n) => !query || fold(n).includes(fold(query)));
    meta.textContent = query ? `${names.length} of ${NAMES.length} recipients` : `${NAMES.length} recipients, most letters first`;
    body.innerHTML = topPie() + `<input class="search" type="search" placeholder="Find a recipient" aria-label="Find a recipient" value="${esc(query)}">
      <ul class="who-list">${names.map((n) => { const ls = BY.get(n), places = countBy(ls.filter((l) => l.dest), (l) => D.places[l.dest].label).map(([k]) => k);
        return `<li><button data-who="${esc(n)}"><span class="dot" style="--c:var(${colourOf(n)})"></span><span class="nm">${esc(n)}</span><span class="n">${plural(ls.length, 'letter')}</span>
          <span class="places">${places.length ? esc(places.join(' · ')) : 'no known destination'}</span></button></li>`; }).join('')}</ul>`;
    const input = body.querySelector('.search');
    input.oninput = () => { query = input.value; renderPanel(); const i = document.querySelector('.search'); i.focus(); i.setSelectionRange(query.length, query.length); };
    body.querySelectorAll('button[data-who], .top-pie path[data-who]').forEach((b) => { b.onclick = () => pick(b.dataset.who); });
    return;
  }
  const ls = BY.get(S.who).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n));
  const list = (rows) => rows.map(([k, v]) => `${esc(k)} <span style="opacity:.7">${v}</span>`).join(' · ');
  const years = YEARS.map((y) => [y, ls.filter((l) => +l.date.slice(0, 4) === y).length]);
  const maxY = Math.max(1, ...years.map(([, n]) => n));
  const themes = countBy(ls.filter((l) => themesOf(l).length), themesOf).slice(0, 5);
  document.getElementById('panel-title').textContent = 'Recipient';
  meta.textContent = '';
  body.innerHTML = `<div class="profile"><button class="back">← All recipients</button>
      <h3><span class="dot" style="--c:var(${colourOf(S.who)})"></span>${esc(S.who)}</h3>
      ${D.bios[S.who] ? `<p class="bio">${esc(D.bios[S.who])}</p>` : '<p class="bio pending">Biography to come.</p>'}
      <dl class="facts">
        <dt>Letters</dt><dd>${ls.length}, ${fmtDate(ls[0].date)}${ls.length > 1 ? ` – ${fmtDate(ls[ls.length - 1].date)}` : ''}</dd>
        <dt>Sent from</dt><dd>${list(countBy(ls, (l) => l.origin))}</dd>
        <dt>Sent to</dt><dd>${list(countBy(ls, (l) => (l.dest ? D.places[l.dest].label : 'no known destination')))}</dd>
      </dl>
      <h4>Letters per year</h4>
      <div class="bars" style="--c:var(${S.who && colourOf(S.who) !== '--other' ? colourOf(S.who) : '--sel'})">${years.map(([y, n]) => `<span>${y}</span><span class="bar"><i style="width:${(n / maxY) * 100}%"></i></span><span class="v">${n}</span>`).join('')}</div>
      <h4>Common themes</h4>
      ${themes.length ? `<ul class="themes">${themes.map(([t, n]) => `<li><span>${esc(t)}</span><span class="v">${plural(n, 'letter')}</span></li>`).join('')}</ul>`
        : '<p class="none">No themes have been confirmed for these letters yet.</p>'}
      <h4>Letters</h4></div>
    <ul class="letters">${ls.map((l) => `<li><button data-n="${l.n}">
      <span class="no">${l.n}<small>${l.date.slice(0, 4)}</small></span><span class="who">${fmtDate(l.date)}</span>
      <span class="where"><span class="o ${oKey(l.origin)}">${esc(l.origin)}</span> → ${l.dest ? esc(D.places[l.dest].label) : 'place unknown'}${l.dest_kind === 'inferred' ? '<span class="tag">inferred</span>' : ''}</span>
      ${l.summary ? `<span class="sum">${esc(l.summary)}</span>` : '<span></span>'}</button></li>`).join('')}</ul>`;
  body.querySelector('.back').onclick = reset;
  body.querySelectorAll('button[data-n]').forEach((b) => { b.onclick = () => letterPopup(D.letters.find((l) => l.n === +b.dataset.n)); });
}
function letterPopup(l) {
  const dest = l.dest ? esc(D.places[l.dest].label) : 'destination not identified';
  L.popup({ maxWidth: 340 }).setLatLng(l.dest ? ll(l.dest) : ll(l.origin)).setContent(`<div class="pop"><h3>No. ${l.n} · ${fmtDate(l.date)}</h3>
    <div class="meta">To <b>${esc(l.recipient)}</b> → ${dest}<br>From ${esc(l.origin)}${l.signed ? ` · signed “${esc(l.signed)}”` : ''}</div>
    ${l.summary ? `<div class="sum">${esc(l.summary)}</div>` : ''}
    <dl><dt>Dateline</dt><dd>${esc(l.dateline)}</dd><dt>Destination</dt><dd>${esc(l.dest_basis)}</dd><dt>Printed pp.</dt><dd>${esc(l.pages)}</dd></dl></div>`).openOn(map);
}

function pick(who) { if (S.who !== who) { S.who = who; map.closePopup(); render(); document.getElementById('panel-body').scrollTop = 0; } }
// clear the picked recipient: a click on the empty map, the Esc key, or "All recipients"
function reset() { if (S.who) { S.who = null; map.closePopup(); render(); } }
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
