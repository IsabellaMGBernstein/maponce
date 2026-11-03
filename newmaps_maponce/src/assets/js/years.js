// Years: one line per year per route, from 1897 (light) to 1900 (dark). Pick a year (legend, list, route,
// or a destination's popup): its routes turn green and the panel lists where Ponce wrote that year, and to whom.
import * as C from './core.js';

const D = await C.loadData();
const { map, ll, routeLayer, markLayer } = await C.createMap(D);
const S = { year: null };
const BY = new Map(C.YEARS.map((y) => [y, D.letters.filter((l) => C.yearOf(l) === y)]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

C.addKey(map, [[C.keySquares(C.YEARS.map(C.yColour)), '<b>Year</b>: light = 1897, dark = 1900; a route used in several years has one line per year']],
  'Click a year at the top or a route to pick a year. Click the empty map or press Esc to see all years.');

function legend() {
  const lg = document.getElementById('legend');
  lg.innerHTML = C.YEARS.map((y) => `<button data-y="${y}" aria-pressed="${S.year === y}" style="--c:var(${C.yColour(y)})" title="Show ${y}"><span class="sw"></span>${y} <span style="opacity:.7">${BY.get(y).length}</span></button>`).join('') +
    `<span class="key"><span class="sw dash"></span>destination inferred</span>`;
  C.wire(lg, 'button[data-y]', (b) => (S.year === +b.dataset.y ? reset() : pick(+b.dataset.y)));
}

function render() {
  const ls = D.letters.filter(C.drawable);
  C.drawLines(routeLayer, ll, C.groupLines(ls, C.yearOf), {
    style: (ln) => {
      const on = ln.id === S.year, off = S.year && !on;
      return { colour: on ? '--sel' : off ? '--trace' : C.yColour(ln.id), weight: C.lineWeight(ln.ls.length) * 0.9 + (on ? 1.5 : 0),
        opacity: on ? 1 : off ? 0.35 : 0.9, z: on ? 1 : 0 };
    },
    fanOrder: (ln) => ln.id,
    tooltip: (ln) => `<b>${ln.id}</b><br>${C.esc(ln.origin)} → ${C.esc(D.places[ln.dest].label)}: ${C.plural(ln.ls.length, 'letter')}`,
    onClick: (ln) => pick(ln.id),
  });
  const years = (ls2) => C.YEARS.map((y) => [y, ls2.filter((l) => C.yearOf(l) === y).length]).filter(([, n]) => n).map(([y, n]) => [`${y} (${n})`, `data-pick="${y}"`]);
  C.drawPlaces(markLayer, ll, D, ls, {
    on: (name) => !!S.year && BY.get(S.year).some((l) => l.dest === name),
    onDest: (name, pls) => C.listPopup(map, ll(name), C.esc(D.places[name].label), `${C.plural(pls.length, 'letter')} received, by year`, years(pls)),
    onBase: (o) => { const f = D.letters.filter((l) => l.origin === o); C.listPopup(map, ll(o), `Ponce in ${o}`, `${C.plural(f.length, 'letter')} sent, by year`, years(f)); },
  });
  legend(); renderPanel();
}

function renderPanel() {
  const fromText = (ls) => C.countBy(ls, (l) => l.origin).map(([k, v]) => `${C.esc(k)} (${v})`).join(', ');
  if (!S.year) {
    C.panel.title('Years'); C.panel.meta(`${D.letters.length} letters, 1897–1900`);
    const body = C.panel.body(`<ul class="picklist">${C.YEARS.map((y) => { const ls = BY.get(y);
      return `<li><button data-y="${y}"><span class="big">${y}</span><span class="n">${C.plural(ls.length, 'letter')}</span>
        <span class="sub">${C.plural(new Set(ls.map((l) => l.recipient)).size, 'correspondent')} · written from ${fromText(ls)}</span></button></li>`; }).join('')}</ul>`);
    C.wire(body, 'button[data-y]', (b) => pick(+b.dataset.y));
    return;
  }
  const ls = BY.get(S.year), who = C.countBy(ls, (l) => l.recipient);
  C.panel.title('Year'); C.panel.meta('');
  const body = C.panel.body(`<div class="profile"><button class="back">← All years</button><h3>${S.year}</h3>
      <dl class="facts"><dt>Letters</dt><dd>${ls.length}</dd><dt>Sent from</dt><dd>${fromText(ls)}</dd>
        <dt>Sent to</dt><dd>${C.countBy(ls, (l) => (l.dest ? D.places[l.dest].label : 'no known destination')).map(([k, v]) => `${C.esc(k)} <span style="opacity:.7">${v}</span>`).join(' · ')}</dd></dl>
      <h4>Letters per month</h4>${C.bars(MONTHS.map((m, i) => [m, ls.filter((l) => +l.date.slice(5, 7) === i + 1).length]), () => C.yColour(S.year))}
      <h4>Everyone he wrote to in ${S.year} (${who.length})</h4>
      <ul class="names">${who.map(([k, v]) => `<li><span>${C.esc(k)}</span><span class="v">${v}</span></li>`).join('')}</ul>
      <h4>Letters</h4></div>${C.letterRows(ls, D)}`);
  body.querySelector('.back').onclick = reset;
  C.wire(body, 'button[data-n]', (b) => C.letterPopup(map, ll, D, D.letters.find((l) => l.n === +b.dataset.n)));
}

function pick(y) { if (S.year !== y) { S.year = y; render(); document.getElementById('panel-body').scrollTop = 0; } }
function reset() { if (S.year) { S.year = null; map.closePopup(); render(); } }
C.onPopupLinks(map, { pick: (y) => pick(+y) });
C.onClear(map, reset);
C.onThemeChange(render);
document.getElementById('inferred').onchange = render;
C.panelToggle(map);
render();
