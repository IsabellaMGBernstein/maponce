"""Build cartas_links.csv + cartas_map_data.json from ocr/cartas_letters.csv
(or the corrected table, corrected/cartas_letters_revised.csv).
Usage: python3 build_data.py <cartas_letters.csv> <outdir>
Also writes two map pages from the templates in this script's folder:
  <outdir>/cartas_map.html             from template.html             (routes)
  <outdir>/cartas_map_recipients.html  from template_recipients.html  (correspondents)
  <outdir>/cartas_map_years.html       from template_years.html       (years)
  <outdir>/cartas_map_themes.html      from template_themes.html      (themes confirmed in letter_themes.csv)
  <outdir>/cartas_map_europe.html      from template_region.html      (letters to Europe; one page per entry in REGIONS)
and adds any new correspondent to recipient_bios.csv (biographies written by hand)."""
import csv, json, re, sys, collections, datetime

src, outdir = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(src, encoding='utf-8-sig')))

# ---------- places (lat, lon, label shown on map) ----------
PLACES = {
 'Hong Kong': (22.2819, 114.1580, 'Hong Kong'),
 'Yokohama': (35.4437, 139.6380, 'Yokohama'),
 'Tokyo': (35.6895, 139.6917, 'Tokyo'),
 'Osaka': (34.6937, 135.5023, 'Osaka'),
 'Nagahama': (35.3810, 136.2690, 'Nagahama'),
 'Shanghai': (31.2304, 121.4737, 'Shanghai'),
 'Macau': (22.1987, 113.5439, 'Macao'),
 'Singapore': (1.2903, 103.8520, 'Singapore'),
 'Manila': (14.5995, 120.9842, 'Manila'),
 'Malolos': (14.8433, 120.8114, 'Malolos'),
 'Tarlac': (15.4802, 120.5979, 'Tarlac'),
 'Leitmeritz (Litoměřice)': (50.5335, 14.1318, 'Leitmeritz'),
 'Paris': (48.8566, 2.3522, 'Paris'),
 'Madrid': (40.4168, -3.7038, 'Madrid'),
 'Barcelona': (41.3851, 2.1734, 'Barcelona'),
 'Sant Climent de Llobregat': (41.3380, 1.9970, 'San Clemente de Llobregat'),
 'Vilanova i la Geltrú': (41.2241, 1.7252, 'Villanueva y Geltrú'),
 'Zaragoza': (41.6488, -0.8891, 'Zaragoza'),
 'Berlin': (52.5200, 13.4050, 'Berlin'),
 'Dresden': (51.0504, 13.7373, 'Dresden'),
 'Haarlem': (52.3874, 4.6462, 'Haarlem'),
 'New Orleans': (29.9511, -90.0715, 'New Orleans'),
 'Washington, D.C.': (38.9072, -77.0369, 'Washington'),
 'Montreal': (45.5019, -73.5674, 'Montreal'),
 'Philadelphia': (39.9526, -75.1652, 'Pennsylvania'),
 'Mexico City': (19.4326, -99.1332, 'México'),
}

# ---------- recipient normalisation (OCR variants -> one name) ----------
RECIP = {
 'Blumentritt':'F. Blumentritt',
 'Apacible':'G. Apacible','G. Apacible':'G. Apacible',
 'Apacible y Santos':'G. Apacible & I. de Santos','Apacible y De Santos':'G. Apacible & I. de Santos',
 'Apacible y Orong':'G. Apacible & I. de Santos',
 'Santos':'I. de Santos','De Santos':'I. de Santos','Orong':'I. de Santos',
 'Vergel':'A. Vergel de Dios','A. Vergel':'A. Vergel de Dios','Vergel de Dios':'A. Vergel de Dios',
 'Izquierdo':'J. A. Izquierdo','J. A. Izquierdo':'J. A. Izquierdo',']. A. Izquierdo':'J. A. Izquierdo',
 'D. W. Jones':'W. Jones','William Jones':'W. Jones','William ]. 1es, sq. o':'W. Jones',
 'Sugimura':'K. Sugimura','Sugiyúra':'K. Sugimura',
 'Foujita':'S. Foujita','Poujita':'S. Foujita',
 'Yamagata':'Y. Yamagata','Y amagata':'Y. Yamagata',
 'Sun Y at Sen':'Sun Yat-sen','Sun Yat Sen':'Sun Yat-sen',
 'Cosp':'Luis Cosp','Cosp.':'Luis Cosp','Luis Cosp':'Luis Cosp',
 'Morayta':'Miguel Morayta','Miguel Morayta':'Miguel Morayta',
 'Doria':'Saturnino A. Doria','Saturnino A. Doria':'Saturnino A. Doria',
 'Fukushima':'Y. Fukushima','Y. Fukushima':'Y. Fukushima',
 'Dr. Betaánces':'Dr. Betances',
 'De Quezada':'Gonzalo de Quezada','Gonzalo de Quezada':'Gonzalo de Quezada',
 'Dr. Eduard Soler':'Eduard Seler','Doctor Seler':'Eduard Seler',
 'Brenton':'D. G. Brinton',
 'IKkis':'Ikkis','H. W. Bray, Esq.':'H. W. Bray','Prof. Buchner':'M. Buchner',
 'D. M. Español, D. M. Reyes':'M. Español, M. Reyes & F. Consunji',
 'F. Agoncillo y F. Lichauco':'F. Agoncillo & F. Lichauco','Lichauco':'F. Lichauco',
 'Mabini':'A. Mabini','Aguinaldo':'E. Aguinaldo','Buencamino':'F. Buencamino',
 'Castro':'L. Castro','Rivero':'F. Rivero','Miura':'A. Miura','Coard':'W. H. Coard',
 'Kimura':'T. Kimura','Hirata':'Hirata','Luna':None,  # Luna handled below (A. Luna vs J. Luna)
 'Riego de Dios':'E. Riego de Dios','Riego y Santos':'E. Riego de Dios & I. de Santos',
 'Villa-real':'A. Villareal','Marqués':'L. P. Marques','J. Lecaroz':'J. Lecaroz',
 'E. de Lete':'E. de Lete','Victor Balaguer':'Víctor Balaguer',
}
def recipient(r):
    # Corrected tables (corrected/cartas_letters_revised.csv) carry a checked normalized name: use it.
    if (r.get('recipient_normalized') or '').strip():
        return r['recipient_normalized'].strip().replace('; ', ' & ')
    p = r['recipient_as_printed'].strip()
    if p == 'Luna':
        return 'J. Luna' if 'J. Luna' in r['addressee_block'] else 'A. Luna'
    return RECIP.get(p) or p or r['recipient_index_form'].strip() or '(unnamed)'

# ---------- signed as ----------
def signed(s):
    s = s.strip().rstrip('.').strip()
    t = re.sub(r'[^a-z]', '', s.lower())
    if not s: return ''
    if 'nan' in t or 'nin' in t and len(t) < 9: return 'Naning'
    if t.startswith('rob') or t.startswith('ros') or t.startswith('rsam'): return 'R. Samper'
    if 'lic' in t: return 'F. Lichauco'
    if re.search(r'pon', t) or t in ('mazrranoponce',): return 'M. Ponce'
    return {'pmarro':'P. Marro','pmario':'P. Marro','makriano':'Mariano','vazlr':'Vazlr (OCR)',
            'kalipulako':'Kalipulako','generalaguinaldo':'General Aguinaldo','efrivero':'F. Rivero',
            'tunis':'Tunis'}.get(t, s)

# ---------- destinations printed in the addressee block that the auto-reader missed ----------
PRINTED_FIX = {
 '26': ('Vilanova i la Geltrú', 'printed in addressee block: "Villanueva y Geltrú"'),
 '71': ('Hong Kong', 'printed in addressee block: "Hongkong"'),
 '103': ('Sant Climent de Llobregat', 'printed in addressee block: "Clemente de Llobregat"'),
 '147': ('Sant Climent de Llobregat', 'printed in addressee block: "Sn. Clemente"'),
 '227': ('Sant Climent de Llobregat', 'printed in addressee block: "San Clemente de Llobregat"'),
 '119': ('Philadelphia', 'printed in addressee block: "Pennsylvania" (shown at Philadelphia)'),
 '160': ('Nagahama', 'printed in addressee block: "Nagahama"'),
 '222': ('Mexico City', 'printed in addressee block: "Legación Japonesa en México"'),
}

def d(s): return datetime.date.fromisoformat(s)
letters = []
for r in rows:
    L = {
      'n': int(r['letter_number']), 'id': r['id'], 'date': r['date_iso'],
      'sender': 'Mariano Ponce', 'signed': signed(r['signatory_as_printed']),
      'origin': r['origin_place_normalized'], 'origin_basis': r['origin_basis'],
      'part': r['part'], 'recipient': recipient(r),
      'recipient_printed': r['recipient_as_printed'],
      'dateline': r['place_date_as_printed'], 'addressee': r['addressee_block'],
      'summary': r['editorial_summary'], 'images': r['source_images'],
      'pages': r['printed_pages'], 'flags': r['review_flags'],
    }
    dest, basis, kind = r['destination_place_normalized'], '', ''
    if dest:
        kind, basis = 'printed', 'printed in addressee block: "%s"' % r['destination_as_printed_guess'].strip(' .,')
    elif r['letter_number'] in PRINTED_FIX:
        dest, basis = PRINTED_FIX[r['letter_number']]; kind = 'printed'
    L.update(dest=dest, dest_kind=kind, dest_basis=basis)
    letters.append(L)

# Infer missing destinations from the nearest-in-time letter to the same recipient that has a printed place
by_rec = collections.defaultdict(list)
for L in letters:
    if L['dest_kind'] == 'printed': by_rec[L['recipient']].append(L)
for L in letters:
    if L['dest']: continue
    cands = by_rec.get(L['recipient'])
    if not cands: continue
    best = min(cands, key=lambda c: abs((d(c['date']) - d(L['date'])).days))
    gap = abs((d(best['date']) - d(L['date'])).days)
    L.update(dest=best['dest'], dest_kind='inferred',
             dest_basis='inferred from letter %d to the same recipient (%s, %d days apart)' % (best['n'], best['date'], gap))

for L in letters:
    o = PLACES[L['origin']]; L['olat'], L['olon'] = o[0], o[1]
    if L['dest']:
        p = PLACES[L['dest']]; L['dlat'], L['dlon'] = p[0], p[1]
    else:
        L['dlat'] = L['dlon'] = None
        L['dest_kind'] = 'unlocated'; L['dest_basis'] = 'no place printed or inferable'

# ---------- outputs ----------
cols = ['n','date','sender','signed','origin','olat','olon','recipient','recipient_printed','dest','dlat','dlon','dest_kind','dest_basis','part','pages','images']
with open(f'{outdir}/cartas_links.csv','w',newline='',encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore'); w.writeheader()
    for L in letters: w.writerow(L)
json.dump({'places': {k:{'lat':v[0],'lon':v[1],'label':v[2]} for k,v in PLACES.items()}, 'letters': letters},
          open(f'{outdir}/cartas_map_data.json','w',encoding='utf-8'), ensure_ascii=False)

c = collections.Counter(L['dest_kind'] for L in letters); print(c)
print('unlocated recipients:', collections.Counter(L['recipient'] for L in letters if L['dest_kind']=='unlocated'))
print('recipients:', len(set(L['recipient'] for L in letters)), 'places:', len(set(L['dest'] for L in letters if L['dest'])))
print('signed:', collections.Counter(L['signed'] for L in letters))
print(collections.Counter(L['recipient'] for L in letters).most_common(12))

import os
here = os.path.dirname(os.path.abspath(__file__))

# ---------- biographies (written by hand) ----------
# recipient_bios.csv has one row per correspondent: name, number of letters, biography.
# It is created on the first build; later builds only add correspondents that are new,
# so biographies typed into it are never overwritten.
bios_file = os.path.join(here, 'recipient_bios.csv')
counts = collections.Counter(L['recipient'] for L in letters)
bio_rows = list(csv.DictReader(open(bios_file, encoding='utf-8-sig'))) if os.path.exists(bios_file) else []
known = {r['recipient'] for r in bio_rows}
new_names = [n for n, _ in counts.most_common() if n not in known]
if new_names:
    bio_rows += [{'recipient': n, 'letters': counts[n], 'biography': ''} for n in new_names]
    with open(bios_file, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=['recipient', 'letters', 'biography']); w.writeheader(); w.writerows(bio_rows)
    print(f'added {len(new_names)} correspondents to recipient_bios.csv')
bios = {r['recipient']: r['biography'].strip() for r in bio_rows if r.get('biography', '').strip()}

# ---------- themes (suggested by suggest_themes.py, confirmed by the author) ----------
# Only rows of letter_themes.csv whose status is "confirmed" are shown on the themes map.
def read_csv(name):
    path = os.path.join(here, name)
    return list(csv.DictReader(open(path, encoding='utf-8-sig'))) if os.path.exists(path) else []
theme_rows = [r for r in read_csv('themes.csv') if r['theme'].strip()]
theme_words = read_csv('theme_words.csv')
theme_marks = read_csv('letter_themes.csv')
status = lambda r: r['status'].strip().lower()
themes = {
    'themes': [{'name': r['theme'].strip(), 'description': r.get('description', '').strip(),
                'words': [w['word'] for w in theme_words if w['theme'] == r['theme'] and w['use'].strip().lower() == 'yes']}
               for r in theme_rows],
    'letters': {},    # letter number -> its confirmed themes
    'pending': {r['theme'].strip(): sum(1 for m in theme_marks if m['theme'] == r['theme'] and status(m) == 'suggested') for r in theme_rows},
}
for m in theme_marks:
    if status(m) == 'confirmed' and m['theme'] in themes['pending']:
        themes['letters'].setdefault(m['letter'], []).append(m['theme'])
print('themes:', {r['theme']: sum(1 for m in theme_marks if m['theme'] == r['theme'] and status(m) == 'confirmed') for r in theme_rows}, 'confirmed')
# the full letter texts, for the transcripts on the themes map
texts = {r['letter_number']: r.get('text_reading', '') for r in rows}

def embed(text): return text.replace('</', '<\\/')   # keep embedded data from closing its <script> tag
data = embed(open(f'{outdir}/cartas_map_data.json', encoding='utf-8').read())
world = embed(open(os.path.join(here, 'countries-50m.json'), encoding='utf-8').read())   # Natural Earth borders
bios_json = embed(json.dumps(bios, ensure_ascii=False))
themes_json = embed(json.dumps(themes, ensure_ascii=False))
texts_json = embed(json.dumps(texts, ensure_ascii=False))
# Regional maps: each shows only the letters sent to its destinations. Countries are those of the 1890s.
# title = the map's name (its button and browser tab); view = the region on its own; routes (optional) =
# the whole routes from Hong Kong and Yokohama, for regions they reach from outside ([[south, west], [north, east]]).
# To add a region, add an entry here and a link appears on every page.
REGIONS = [
    {'name': 'Europe', 'title': 'Ponce in Europe', 'page': 'cartas_map_europe.html',
     'places': {'Leitmeritz (Litoměřice)': 'Austria-Hungary (Bohemia)', 'Paris': 'France',
                'Madrid': 'Spain', 'Barcelona': 'Spain', 'Sant Climent de Llobregat': 'Spain',
                'Vilanova i la Geltrú': 'Spain', 'Zaragoza': 'Spain',
                'Berlin': 'Germany', 'Dresden': 'Germany', 'Haarlem': 'Netherlands'},
     'view': [[36, -10], [55.5, 20]], 'routes': [[0, -12], [60, 146]]},
    {'name': 'Asia', 'title': 'Ponce in Asia', 'page': 'cartas_map_asia.html',
     'places': {'Hong Kong': 'Hong Kong (British)', 'Macau': 'Macao (Portuguese)', 'Shanghai': 'China (Qing)',
                'Singapore': 'Straits Settlements (British)',
                'Tokyo': 'Japan', 'Yokohama': 'Japan', 'Osaka': 'Japan', 'Nagahama': 'Japan',
                'Manila': 'Philippines', 'Malolos': 'Philippines', 'Tarlac': 'Philippines'},
     'view': [[-8, 84], [44, 150]]},          # wide to the west so the map key does not cover Singapore; no whole-routes view (the routes stay in Asia)
    # The maps put the Americas east of Asia (longitude + 360), so the views below use 240-300 for 120°W-60°W.
    {'name': 'North America', 'title': 'Ponce in North America', 'page': 'cartas_map_north_america.html',
     'places': {'New Orleans': 'United States', 'Washington, D.C.': 'United States', 'Philadelphia': 'United States',
                'Montreal': 'Canada', 'Mexico City': 'Mexico'},
     'view': [[10, 240], [54, 296]], 'routes': [[0, 105], [62, 300]]},
]
# every page, in the order of the buttons in each page's header
PAGES = [('template.html', 'cartas_map.html', 'Routes', None),
         ('template_recipients.html', 'cartas_map_recipients.html', 'Correspondents', None),
         ('template_years.html', 'cartas_map_years.html', 'Years', None),
         ('template_themes.html', 'cartas_map_themes.html', 'Themes', None)] + \
        [('template_region.html', r['page'], r.get('title', r['name']), r) for r in REGIONS]
CUR = ' aria-current="page"'
def nav(current):
    # the four maps as buttons, then the regional maps in a "Regions" drop-down menu (a list of links)
    main = ''.join(f'<a href="{page}"{CUR if name == current else ""}>{name}</a>' for _, page, name, r in PAGES if not r)
    here = next((r for _, _p, name, r in PAGES if r and name == current), None)
    menu = ''.join(f'<a href="{r["page"]}"{CUR if r is here else ""}>{r["name"]}</a>' for r in REGIONS)
    summary = f'Regions: {here["name"]}' if here else 'Regions'
    return (f'<nav class="views" aria-label="Map views">{main}'
            f'<details class="views-menu"><summary{" class=" + chr(34) + "current" + chr(34) if here else ""}>{summary}</summary>'
            f'<div class="menu">{menu}</div></details></nav>'
            # close the menu on a click elsewhere or the Esc key
            '<script>document.addEventListener("click", e => document.querySelectorAll(".views-menu[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; }));'
            'document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".views-menu[open]").forEach(d => { d.open = false; d.querySelector("summary").focus(); }); });</script>')

for template, page, name, region in PAGES:
    html = open(os.path.join(here, template), encoding='utf-8').read()
    html = html.replace('__NAV__', nav(name))
    html = html.replace('__DATA__', data).replace('__WORLD__', world).replace('__BIOS__', bios_json)
    html = html.replace('__THEMES__', themes_json).replace('__TEXTS__', texts_json)
    if region:
        missing = [p for p in region['places'] if p not in PLACES]
        assert not missing, f"{region['name']}: unknown places {missing}"
        html = html.replace('__REGION__', embed(json.dumps(region, ensure_ascii=False))).replace('__REGION_NAME__', region['name'])
        html = html.replace('__REGION_TITLE__', region.get('title', region['name']))
    open(f'{outdir}/{page}', 'w', encoding='utf-8').write(html)
    print('wrote', page)
