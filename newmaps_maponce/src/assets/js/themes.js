// Themes: only themes confirmed in Maponce_Data/map/letter_themes.csv. One line per theme per route
// (a letter with several themes is drawn for each); letters with no confirmed theme are faint grey.
// Pick a theme: its routes turn green and the panel lists its letters, each with its full transcript.
import * as C from './core.js';

const D = await C.loadData();
const TEXTS = await C.loadTexts();
const { map, ll, routeLayer, markLayer } = await C.createMap(D);
const S = { theme: null };
const NONE = '';   // the id of lines for letters with no confirmed theme
const themesOf = (l) => D.themes.letters[String(l.n)] || [];
const THEMES = D.themes.list;
const BY = new Map(THEMES.map((t) => [t.name, D.letters.filter((l) => themesOf(l).includes(t.name))]));
const confirmed = D.letters.filter((l) => themesOf(l).length).length;

C.addKey(map, [[C.keyLine('--line'), '<b>Route</b> of letters on one theme; several themes on a route are fanned out'],
  [C.keyLine('--trace', 1.5), '<b>Faint grey</b>: letters with no confirmed theme']],
  'Click a theme at the top or in the list to pick it. Click the empty map or press Esc to see all themes.');

function legend() {
  const lg = document.getElementById('legend');
  lg.innerHTML = (THEMES.length ? THEMES.map((t) => `<button data-t="${C.esc(t.name)}" aria-pressed="${S.theme === t.name}" style="--c:var(--line)"><span class="sw"></span>${C.esc(t.name)} <span style="opacity:.7">${BY.get(t.name).length}</span></button>`).join('') : '') +
    `<span class="key" style="--c:var(--trace)"><span class="sw"></span>no confirmed theme</span><span class="key"><span class="sw dash"></span>destination inferred</span>`;
  C.wire(lg, 'button[data-t]', (b) => (S.theme === b.dataset.t ? reset() : pick(b.dataset.t)));
}

function render() {
  const ls = D.letters.filter(C.drawable);
  C.drawLines(routeLayer, ll, C.groupLines(ls, (l) => (themesOf(l).length ? themesOf(l) : NONE)), {
    style: (ln) => {
      const on = !!S.theme && ln.id === S.theme;
      if (on) return { colour: '--sel', weight: C.lineWeight(ln.ls.length) + 1.5, opacity: 1, z: 2 };
      if (ln.id === NONE) return { colour: '--trace', weight: 1, opacity: 0.4, z: 0 };
      return S.theme ? { colour: '--trace', weight: C.lineWeight(ln.ls.length) * 0.8, opacity: 0.35, z: 0 }
        : { colour: '--line', weight: C.lineWeight(ln.ls.length) * 0.9, opacity: 0.85, z: 1 };
    },
    fanOrder: (ln) => (ln.id === NONE ? -1 : THEMES.findIndex((t) => t.name === ln.id)),
    tooltip: (ln) => `<b>${ln.id === NONE ? 'No confirmed theme' : C.esc(ln.id)}</b><br>${C.esc(ln.origin)} → ${C.esc(D.places[ln.dest].label)}: ${C.plural(ln.ls.length, 'letter')}`,
    onClick: (ln) => { if (ln.id !== NONE) pick(ln.id); },
  });
  const themes = (ls2) => [...THEMES.map((t) => [t.name, ls2.filter((l) => themesOf(l).includes(t.name)).length]).filter(([, n]) => n)
    .map(([t, n]) => [`${C.esc(t)} (${n})`, `data-pick="${C.esc(t)}"`]), [`no confirmed theme (${ls2.filter((l) => !themesOf(l).length).length})`]];
  C.drawPlaces(markLayer, ll, D, ls, {
    on: (name) => !!S.theme && BY.get(S.theme).some((l) => l.dest === name),
    onDest: (name, pls) => C.listPopup(map, ll(name), C.esc(D.places[name].label), `${C.plural(pls.length, 'letter')} received, by theme`, themes(pls)),
    onBase: (o) => { const f = D.letters.filter((l) => l.origin === o); C.listPopup(map, ll(o), `Ponce in ${o}`, `${C.plural(f.length, 'letter')} sent, by theme`, themes(f)); },
  });
  legend(); renderPanel();
}

function renderPanel() {
  if (!S.theme) {
    C.panel.title('Themes'); C.panel.meta(`${C.plural(THEMES.length, 'theme')} · ${confirmed} of ${D.letters.length} letters have a confirmed theme`);
    const note = confirmed ? '' : '<p class="hint">No themes have been confirmed yet. They appear here once they are marked “confirmed” in <code>Maponce_Data/map/letter_themes.csv</code>.</p>';
    const body = C.panel.body(note + `<ul class="picklist">${THEMES.map((t) => `<li><button data-t="${C.esc(t.name)}"><span class="nm">${C.esc(t.name)}</span><span class="n">${C.plural(BY.get(t.name).length, 'letter')}</span>
      <span class="sub">${t.description ? C.esc(t.description) + ' · ' : ''}words: ${C.esc(t.words.join(', '))}</span></button></li>`).join('')}</ul>`);
    C.wire(body, 'button[data-t]', (b) => pick(b.dataset.t));
    return;
  }
  const t = THEMES.find((x) => x.name === S.theme), ls = BY.get(S.theme).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  C.panel.title('Theme'); C.panel.meta('');
  const body = C.panel.body(`<div class="profile"><button class="back">← All themes</button><h3>${C.esc(t.name)}</h3>
      ${t.description ? `<p class="bio">${C.esc(t.description)}</p>` : ''}
      <dl class="facts"><dt>Letters</dt><dd>${ls.length || 'none confirmed yet'}</dd><dt>Words</dt><dd>${C.esc(t.words.join(', '))}</dd>
        ${ls.length ? `<dt>To</dt><dd>${C.countBy(ls, (l) => l.recipient).slice(0, 8).map(([k, v]) => `${C.esc(k)} <span style="opacity:.7">${v}</span>`).join(' · ')}</dd>` : ''}</dl>
      ${ls.length ? `<h4>Letters per year</h4>${C.bars(C.YEARS.map((y) => [String(y), ls.filter((l) => C.yearOf(l) === y).length]), (k) => C.yColour(+k))}
      <h4>Letters</h4><p class="hint" style="padding:0 0 6px">Click a letter to read it in full.</p>` : ''}</div>
    <ul class="letters">${ls.map((l) => `<li><details><summary>
      <span class="no">${l.n}<small>${l.date.slice(0, 4)}</small></span><span class="who">${C.esc(l.recipient)}</span>
      <span class="where"><span class="o ${C.oKey(l.origin)}">${C.esc(l.origin)}</span> → ${l.dest ? C.esc(D.places[l.dest].label) : 'place unknown'} · ${C.fmtDate(l.date)}</span></summary>
      <div class="transcript">${l.summary ? `<p class="sum">${C.esc(l.summary)}</p>` : ''}
        ${themesOf(l).length > 1 ? `<p class="hint" style="padding:0">Also: ${themesOf(l).filter((x) => x !== t.name).map(C.esc).join(', ')}</p>` : ''}
        <div class="text">${C.esc(TEXTS[String(l.n)] || 'No transcript.')}</div>
        <button class="small-btn" data-n="${l.n}">Show on the map</button></div></details></li>`).join('')}</ul>`);
  body.querySelector('.back').onclick = reset;
  C.wire(body, 'button[data-n]', (b) => C.letterPopup(map, ll, D, D.letters.find((l) => l.n === +b.dataset.n)));
}

function pick(t) { if (S.theme !== t) { S.theme = t; render(); document.getElementById('panel-body').scrollTop = 0; } }
function reset() { if (S.theme) { S.theme = null; map.closePopup(); render(); } }
C.onPopupLinks(map, { pick });
C.onClear(map, reset);
C.onThemeChange(render);
document.getElementById('inferred').onchange = render;
C.panelToggle(map);
render();
