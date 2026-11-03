// Regions: only the letters sent to one region (Europe, Asia or North America), chosen in the menu at the
// top left of the map. The map zooms to the region; a bar along the foot gives its statistics.
// The region is kept in the address (regions/#asia), so a link can open a region directly.
import * as C from './core.js';

const D = await C.loadData();
const select = document.getElementById('region-select');
const regionOf = () => D.regions.find((r) => r.key === location.hash.slice(1)) || D.regions[0];
let R = regionOf();
const { map, ll, routeLayer, markLayer } = await C.createMap(D, { view: R.view });
const S = { route: null, who: null, place: null };
const inRegion = () => D.letters.filter((l) => l.dest && R.places[l.dest]);

document.getElementById('legend').innerHTML =
  `<span class="key" style="--c:var(--hk)"><span class="sw"></span>sent from Hong Kong</span>` +
  `<span class="key" style="--c:var(--yk)"><span class="sw"></span>sent from Yokohama</span>` +
  `<span class="key"><span class="sw dash"></span>destination inferred</span>`;
C.addKey(map, [[C.keyLine('--hk'), '<b>Route</b>, red from Hong Kong and blue from Yokohama; thicker = more letters']],
  'Click a route, a red circle or a name in the bar below. Click the empty map or press Esc to clear it.');

function render() {
  const all = inRegion(), ls = all.filter(C.drawable);
  const lines = C.groupLines(ls, () => 'route');
  const isOn = (ln) => ln.key === S.route || (!!S.who && ln.ls.some((l) => l.recipient === S.who));
  const any = S.route || S.who;
  C.drawLines(routeLayer, ll, lines, {
    style: (ln) => { const on = isOn(ln), off = any && !on;
      return { colour: on ? '--sel' : off ? '--trace' : ln.origin === 'Hong Kong' ? '--hk' : '--yk',
        weight: C.lineWeight(ln.ls.length) + (on ? 1.5 : 0), opacity: on ? 1 : off ? 0.4 : 0.8, z: on ? 1 : 0 }; },
    tooltip: (ln) => `${C.esc(ln.origin)} → ${C.esc(D.places[ln.dest].label)}: ${C.plural(ln.ls.length, 'letter')}${ln.inf ? ' (inferred)' : ''}`,
    onClick: (ln) => { Object.assign(S, { route: ln.key, who: null, place: null }); render(); },
  });
  C.drawPlaces(markLayer, ll, D, ls, {
    on: (name) => S.place === name,
    onDest: (name) => { Object.assign(S, { place: name, route: null, who: null }); render(); },
    onBase: () => {},
  });
  renderStats(all); renderPanel(all);
}

function renderStats(all) {
  const total = D.letters.length, printed = all.filter((l) => l.dest_kind === 'printed').length;
  const who = C.countBy(all, (l) => l.recipient);
  document.getElementById('statbar').innerHTML = `
    <div class="tile"><h3>Letters to ${C.esc(R.name)}</h3><div class="hero">${all.length}</div>
      <div class="small">of all ${total} letters (${Math.round((all.length / total) * 100)}%)<br>${printed} with a printed address, ${all.length - printed} inferred</div></div>
    <div class="tile"><h3>Sent from</h3>${C.bars(C.countBy(all, (l) => l.origin), (k) => (k === 'Hong Kong' ? '--hk' : '--yk'))}</div>
    <div class="tile"><h3>By country (1890s borders)</h3>${C.bars(C.countBy(all, (l) => R.places[l.dest]), () => '--muted')}</div>
    <div class="tile"><h3>Correspondents (${who.length})</h3><ul class="who-mini">${who.map(([k, v]) => `<li><button data-who="${C.esc(k)}" aria-pressed="${S.who === k}"><span>${C.esc(k)}</span><span>${v}</span></button></li>`).join('')}</ul></div>
    <div class="tile"><h3>By year</h3>${C.bars(C.YEARS.map((y) => [String(y), all.filter((l) => C.yearOf(l) === y).length]), (k) => C.yColour(+k))}</div>`;
  C.wire(document.getElementById('statbar'), 'button[data-who]', (b) => {
    Object.assign(S, { who: S.who === b.dataset.who ? null : b.dataset.who, route: null, place: null }); map.closePopup(); render();
  });
}

function renderPanel(all) {
  C.panel.title(`Letters to ${R.name}`);
  let ls = [], label = '';
  if (S.route) { const [, o, d, kind] = S.route.split('|'); ls = all.filter((l) => l.origin === o && l.dest === d && (l.dest_kind === 'inferred') === (kind === 'i')); label = `${C.esc(o)} → ${C.esc(D.places[d].label)}`; }
  else if (S.who) { ls = all.filter((l) => l.recipient === S.who); label = `to ${C.esc(S.who)}`; }
  else if (S.place) { ls = all.filter((l) => l.dest === S.place); label = `to ${C.esc(D.places[S.place].label)}`; }
  C.panel.meta(label ? `${C.plural(ls.length, 'letter')} <span class="chip">${label}<button aria-label="Clear">×</button></span>` : C.plural(all.length, 'letter'));
  const clear = document.querySelector('#panel-meta .chip button'); if (clear) clear.onclick = reset;
  const body = C.panel.body(label ? C.letterRows(ls, D) : '<p class="hint">Click a route or a red circle on the map, or a correspondent in the bar below, to list the letters here.</p>');
  C.wire(body, 'button[data-n]', (b) => C.letterPopup(map, ll, D, D.letters.find((l) => l.n === +b.dataset.n)));
}

function showRegion() {
  R = regionOf(); select.value = R.key;
  Object.assign(S, { route: null, who: null, place: null }); map.closePopup();
  map.fitBounds(R.view); render();
}
select.value = R.key;
select.onchange = () => { location.hash = select.value; };
addEventListener('hashchange', showRegion);

function reset() { if (S.route || S.who || S.place) { Object.assign(S, { route: null, who: null, place: null }); map.closePopup(); render(); } }
C.onClear(map, reset);
C.onThemeChange(render);
document.getElementById('inferred').onchange = render;
C.panelToggle(map);
render();
