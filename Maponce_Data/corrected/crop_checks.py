"""Crop the lines that need checking from the page images, using the word boxes in ocr/pages/*.tsv.

Usage (from Maponce_Data):  python3 corrected/crop_checks.py corrected/image_checks/checks.json
Each check: {"id", "letter", "pattern" (regex on a printed line), "where": "start"|"end",
             "before": n lines, "after": n lines}
Crops are written to corrected/image_checks/<id>.png
"""
import csv, json, os, re, sys
from PIL import Image

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
spec = json.load(open(sys.argv[1]))
rows = {r['letter_number']: r for r in csv.DictReader(open(os.path.join(BASE, 'ocr', 'cartas_letters.csv'), encoding='utf-8-sig'))}
outdir = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])))

def lines_of(page):
    t = os.path.join(BASE, 'ocr', 'pages', page.replace('.jpg', '.tsv'))
    words, W = {}, None
    for r in csv.DictReader(open(t, encoding='utf-8'), delimiter='\t', quoting=csv.QUOTE_NONE):
        if r['level'] == '1': W = int(r['width'])
        if r['level'] != '5' or not r['text'].strip(): continue
        k = (int(r['block_num']), int(r['par_num']), int(r['line_num']))
        words.setdefault(k, []).append(r)
    L = []
    for k, ws in words.items():
        x0 = min(int(w['left']) for w in ws); y0 = min(int(w['top']) for w in ws)
        x1 = max(int(w['left']) + int(w['width']) for w in ws); y1 = max(int(w['top']) + int(w['height']) for w in ws)
        L.append({'text': ' '.join(w['text'] for w in ws), 'box': (x0, y0, x1, y1)})
    L.sort(key=lambda l: (l['box'][1], l['box'][0]))
    return L, W

report = []
for c in spec:
    r = rows[str(c['letter'])]
    pages = [p.strip() for p in r['source_images'].split('|') if p.strip()]
    if c.get('extra_pages'): pages = pages + c['extra_pages']
    if c.get('where') == 'end': pages = pages[::-1]
    rx = re.compile(c['pattern'])
    hit = None
    for p in pages:
        L, W = lines_of(p)
        idx = [i for i, l in enumerate(L) if rx.search(l['text'])]
        if idx:
            i = idx[-1] if c.get('where') == 'end' else idx[0]
            hit = (p, L, W, i); break
    if not hit:
        report.append(f"{c['id']}: NOT FOUND in {pages}"); continue
    p, L, W, i = hit
    sel = L[max(0, i - c.get('before', 1)): i + c.get('after', 1) + 1]
    im = Image.open(os.path.join(BASE, 'cartas-images', p))
    s = im.width / W
    x0 = min(l['box'][0] for l in sel); y0 = min(l['box'][1] for l in sel)
    x1 = max(l['box'][2] for l in sel); y1 = max(l['box'][3] for l in sel)
    pad = 18
    box = (max(0, int((x0 - pad) * s)), max(0, int((y0 - pad) * s)), min(im.width, int((x1 + pad) * s)), min(im.height, int((y1 + pad) * s)))
    crop = im.crop(box).convert('L')
    if crop.width > 1400: crop = crop.resize((1400, int(crop.height * 1400 / crop.width)))
    crop.save(os.path.join(outdir, c['id'] + '.png'), optimize=True)
    report.append(f"{c['id']}: {p} | OCR: {L[i]['text']}")
print('\n'.join(report))
