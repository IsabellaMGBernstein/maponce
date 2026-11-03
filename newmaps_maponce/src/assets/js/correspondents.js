// Correspondents: one line per person per route. Pick a person (list, route, or a destination's popup):
// their routes turn green and the panel shows their biography, letters per year, places and letters.
import * as C from './core.js';

const D = await C.loadData();
const { map, ll, routeLayer, markLayer } = await C.createMap(D);
const S = { who: null };
const BY = new Map();
for (const l of D.letters) (BY.get(l.recipient) || BY.set(l.recipient, []).get(l.recipient)).push(l);
const NAMES = [...BY.keys()].sort((a, b) => BY.get(b).length - BY.get(a).length || a.localeCompare(b));
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();   // search ignores accents
let query = '';

document.getElementById('legend').innerHTML =
  `<span class="key" style="--c:var(--line)"><span class="sw"></span>route to one correspondent</span>` +
  `<span class="key" style="--c:var(--sel)"><span class="sw"></span>the correspondent you picked</span>` +
  `<span class="key"><span class="sw dash"></span>destination inferred</span>`;
C.addKey(map, [[C.keyLine('--line'), '<b>Route</b> to one correspondent; routes shared by several people are fanned out']],
  'Click a route or a name to pick a correspondent. Click the empty map or press Esc to go back to the list.');

function render() {
  const ls = D.letters.filter(C.drawable);
  C.drawLines(routeLayer, ll, C.groupLines(ls, (l) => l.recipient), {
    style: (ln) => {
      const on = ln.id === S.who, off = S.who && !on;
      return { colour: on ? '--sel' : off ? '--trace' : '--line', weight: C.lineWeight(ln.ls.length) * 0.85 + (on ? 1.5 : 0),
        opacity: on ? 1 : off ? 0.35 : 0.8, z: on ? 1 : 0 };
    },
    fanOrder: (ln) => NAMES.indexOf(ln.id),
    tooltip: (ln) => `<b>${C.esc(ln.id)}</b><br>${C.esc(ln.origin)} → ${C.esc(D.places[ln.dest].label)}: ${C.plural(ln.ls.length, 'letter')}`,
    onClick: (ln) => pick(ln.id),
  });
  const who = (ls2) => C.countBy(ls2, (l) => l.recipient).map(([k, v]) => [`${C.esc(k)} (${v})`, `data-pick="${C.esc(k)}"`]);
  C.drawPlaces(markLayer, ll, D, ls, {
    on: (name) => !!S.who && BY.get(S.who).some((l) => l.dest === name),
    onDest: (name, pls) => C.listPopup(map, ll(name), C.esc(D.places[name].label), `${C.plural(pls.length, 'letter')} received`, who(pls)),
    onBase: (o) => { const f = D.letters.filter((l) => l.origin === o); C.listPopup(map, ll(o), `Ponce in ${o}`, `${C.plural(f.length, 'letter')} sent`, who(f)); },
  });
  renderPanel();
}

function renderPanel() {
  if (!S.who) {
    C.panel.title('Correspondents');
    const names = NAMES.filter((n) => !query || fold(n).includes(fold(query)));
    C.panel.meta(`${names.length === NAMES.length ? NAMES.length : `${names.length} of ${NAMES.length}`} correspondents, most letters first`);
    const body = C.panel.body(`<input class="search" type="search" placeholder="Find a correspondent" aria-label="Find a correspondent" value="${C.esc(query)}">
      <ul class="picklist">${names.map((n) => { const ls = BY.get(n), places = C.countBy(ls.filter((l) => l.dest), (l) => D.places[l.dest].label).map(([k]) => k);
        return `<li><button data-who="${C.esc(n)}"><span class="nm">${C.esc(n)}</span><span class="n">${C.plural(ls.length, 'letter')}</span>
          <span class="sub">${places.length ? C.esc(places.join(' · ')) : 'no known destination'}</span></button></li>`; }).join('')}</ul>`);
    const input = body.querySelector('.search');
    input.oninput = () => { query = input.value; renderPanel(); const i = document.querySelector('.search'); i.focus(); i.setSelectionRange(query.length, query.length); };
    C.wire(body, 'button[data-who]', (b) => pick(b.dataset.who));
    return;
  }
  const ls = BY.get(S.who), dated = ls.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const list = (rows) => rows.map(([k, v]) => `${C.esc(k)} <span style="opacity:.7">${v}</span>`).join(' · ');
  C.panel.title('Correspondent'); C.panel.meta('');
  const body = C.panel.body(`<div class="profile"><button class="back">← All correspondents</button>
      <h3>${C.esc(S.who)}</h3>
      ${D.bios[S.who] ? `<p class="bio">${C.esc(D.bios[S.who])}</p>` : '<p class="bio pending">Biography to come.</p>'}
      <dl class="facts"><dt>Letters</dt><dd>${ls.length}, ${C.fmtDate(dated[0].date)}${ls.length > 1 ? ` – ${C.fmtDate(dated[dated.length - 1].date)}` : ''}</dd>
        <dt>Sent from</dt><dd>${list(C.countBy(ls, (l) => l.origin))}</dd>
        <dt>Sent to</dt><dd>${list(C.countBy(ls, (l) => (l.dest ? D.places[l.dest].label : 'no known destination')))}</dd>
        <dt>Signed</dt><dd>${list(C.countBy(ls, (l) => l.signed || 'unsigned'))}</dd></dl>
      <h4>Letters per year</h4>${C.bars(C.YEARS.map((y) => [String(y), ls.filter((l) => C.yearOf(l) === y).length]), (k) => C.yColour(+k))}
      <h4>Letters</h4></div>${C.letterRows(ls, D, { who: false })}`);
  body.querySelector('.back').onclick = reset;
  C.wire(body, 'button[data-n]', (b) => C.letterPopup(map, ll, D, D.letters.find((l) => l.n === +b.dataset.n)));
}

function pick(who) { if (S.who !== who) { S.who = who; render(); document.getElementById('panel-body').scrollTop = 0; } }
function reset() { if (S.who) { S.who = null; map.closePopup(); render(); } }
C.onPopupLinks(map, { pick });
C.onClear(map, reset);
C.onThemeChange(render);
document.getElementById('inferred').onchange = render;
C.panelToggle(map);
render();
