"""Build a corrected copy of the map fields in cartas_letters.csv.

The raw OCR output (ocr/cartas_letters.csv) is only read, never written.

Usage (from the Maponce_Data folder):
    python3 corrected/apply_corrections.py

Inputs (all in corrected/):
    rules.csv               find-and-replace rules for recurring OCR errors
    manual_corrections.csv  one-off corrections, most checked against the page image
                            (value __KEEP__ = checked against the image, no change needed)
    names.csv               one normalized name per correspondent
Outputs (in corrected/):
    cartas_letters_corrected.csv  same rows and columns as the raw file, map fields corrected,
                                  plus signatory_normalized, corrected_fields, image_checked
    corrections_log.csv           every change: letter, field, before, after, rule or evidence
Standard library only.
"""
import csv, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'ocr', 'cartas_letters.csv')
if len(sys.argv) > 1: RAW = sys.argv[1]

MAP_FIELDS = ['recipient_as_printed', 'recipient_index_form', 'signatory_as_printed',
              'place_date_as_printed', 'place_as_printed', 'addressee_block',
              'destination_as_printed_guess']
SMALL_CAPS_FIELDS = ['recipient_index_form', 'signatory_as_printed', 'addressee_block']
PARTICLES = {'de', 'del', 'y', 'los', 'las', 'la', 'e', 'é', 'en'}
KEEP_CAPS = {'D.C', 'II', 'III'}

def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

rules = read('rules.csv')
manual = read('manual_corrections.csv')
names = {r['recipient_as_printed']: r for r in read('names.csv')}

def apply_rule(rule, value):
    t, find, rep = rule['type'], rule['find'], rule['replace']
    if t == 'text':
        return value.replace(find, rep)
    if t == 'word':
        return re.sub(r'(?<![\w])' + re.escape(find) + r'(?![\w])', rep, value)
    return re.sub(find, rep, value)

def small_caps(value):
    """Small capitals come out of OCR as mixed or upper case (BLumeNTRITT, CONSUELO).
    Convention for the corrected version: write them in normal capitalisation."""
    def fix(m):
        w = m.group(0)
        if len(w) < 2 or w in KEEP_CAPS: return w
        if not any(c.isupper() for c in w[1:]): return w
        lw = w.lower()
        if lw in PARTICLES and m.start() > 0: return lw
        return lw[0].upper() + lw[1:]
    return re.sub(r'[A-Za-zÀ-ÖØ-öø-ÿ]+', fix, value)

raw_rows = list(csv.DictReader(open(RAW, encoding='utf-8-sig', newline='')))
fieldnames = list(raw_rows[0].keys())
extra = ['signatory_normalized', 'corrected_fields', 'image_checked']
log = []
out = []
for raw in raw_rows:
    r = dict(raw)
    n = r['letter_number']
    changed, checked = [], []
    for f in MAP_FIELDS:
        v = r[f]
        for rule in rules:
            if rule['field'] not in ('*', f): continue
            nv = apply_rule(rule, v)
            if nv != v:
                log.append([n, f, v, nv, 'rule ' + rule['rule_id'], rule['note'] or f"{rule['find']} -> {rule['replace']}"]); v = nv
        if f in SMALL_CAPS_FIELDS:
            nv = small_caps(v)
            if nv != v:
                log.append([n, f, v, nv, 'rule SMALLCAPS', 'small capitals written in normal capitalisation']); v = nv
        nv = re.sub(r'\s{2,}', ' ', v).strip()
        if nv != v: log.append([n, f, v, nv, 'rule SPACE', 'extra spaces']); v = nv
        r[f] = v
    manual_fields = set()
    for m in manual:
        if m['letter_number'] != n: continue
        f = m['field']
        if m['value'] != '__KEEP__' and r.get(f, '') != m['value']:
            log.append([n, f, r.get(f, ''), m['value'], 'manual', (m['evidence'] + ': ' if m['evidence'] else '') + m['note']])
            r[f] = m['value']
        if m['evidence'] and m['evidence'] not in checked: checked.append(m['evidence'])
        manual_fields.add(f)
    # one name per correspondent
    nm = names.get(r['recipient_as_printed'])
    if nm and 'recipient_normalized' not in manual_fields and r['recipient_normalized'] != nm['recipient_normalized']:
        log.append([n, 'recipient_normalized', r['recipient_normalized'], nm['recipient_normalized'], 'names.csv', nm['note']])
        r['recipient_normalized'] = nm['recipient_normalized']
    s = r['signatory_as_printed'].rstrip('.').strip()
    r['signatory_normalized'] = {'M. Ponce': 'Mariano Ponce', 'Mariano Ponce': 'Mariano Ponce',
                                 'Mariano Ponce Collantes': 'Mariano Ponce', 'Mariano': 'Mariano Ponce',
                                 'Robert Samper': 'R. Samper'}.get(s, s)
    for f in fieldnames:
        if r[f] != raw[f] and f not in changed: changed.append(f)
    r['corrected_fields'] = ' | '.join(changed)
    r['image_checked'] = ' | '.join(checked)
    out.append(r)

with open(os.path.join(HERE, 'cartas_letters_corrected.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fieldnames + extra); w.writeheader(); w.writerows(out)
with open(os.path.join(HERE, 'corrections_log.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f); w.writerow(['letter_number', 'field', 'before', 'after', 'method', 'note']); w.writerows(log)
print(f"{len(out)} letters, {len(log)} changes, {sum(1 for r in out if r['corrected_fields'])} letters changed, "
      f"{sum(1 for r in out if r['image_checked'])} with image checks")
