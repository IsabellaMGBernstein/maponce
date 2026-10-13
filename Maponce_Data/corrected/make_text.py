"""Write corrected/Cartas_OCR_corrected.txt: all 244 letters as plain text.

Headings, datelines, addressee blocks and signatures come from cartas_letters_corrected.csv.
The letter texts come from ../ocr/cartas_letters.json (text_diplomatic) with safe fixes only:
  - the salutation (small capitals) is cleaned with a word list,
  - a short final signature line is put in normal capitalisation,
  - a few rules from rules.csv that only match OCR garbles are applied to the whole text.
Every text change is counted in corrected/text_corrections_log.csv.
Usage (from Maponce_Data): python3 corrected/make_text.py
"""
import csv, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
JSON = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'ocr', 'cartas_letters.json')

PARTICLES = {'de', 'del', 'y', 'los', 'las', 'la', 'e', 'é', 'en'}
def small_caps(value):
    def fix(m):
        w = m.group(0)
        if len(w) < 2 or not any(c.isupper() for c in w[1:]): return w
        lw = w.lower()
        if lw in PARTICLES and m.start() > 0: return lw
        return lw[0].upper() + lw[1:]
    return re.sub(r'[A-Za-zÀ-ÖØ-öø-ÿ]+', fix, value)

# Words in salutations, as OCR misreads small capitals -> printed word
SAL = {}
for good, bads in {
    'Mi': 'M1 Mf', 'Muy': 'Mur Muuy', 'Querido': 'Querimo Querino Queripo Quermo Quero Qurrimo Qurrino Qurripo Querrimo',
    'Querida': 'Queripa Querma', 'Queridos': 'Queripos Querimos Querinos Quermos Qurripos',
    'Queridísimo': 'Queripisimo Queripísimo Queripisimmo Querimísimo', 'Amigo': 'Amico Aámico Ámico', 'Amigos': 'Amicos',
    'Distinguido': 'Disrincuimo Disriscuido Disriscuimo Disriscumo Distincuido Distiscuido Disrincuino Disrincuipo Disriscuipo Disriscuino Disriscummo',
    'Estimado': 'Esrimado Esrimapo Esrimano', 'Paisano': 'Parsano', 'Compañero': 'Comrañero Comprañero Comppañero',
    'Respetable': 'Resrerable Resrerabte Resreramte Resrerante Resrerase', 'Apreciado': 'Abrreciado', 'Apreciable': 'Arreciapie',
    'Nuestro': 'Nuesrero Nuesrko Nuesrro', 'Vergel': 'Vercel Vercgel Veergel',
    'Ifortel': 'Irortel Írorrel Írorteel Lrortel Írortel Irorrel', 'Ikkis': 'Ixkis', 'Kanoy': 'Kanor Kano',
    'Orong': 'Oronc Orona Oroncg', 'Izquierdo': 'Ízquierdo', 'Dear': 'Drar Deax', 'Friend': 'Friewd',
}.items():
    for b in bads.split(): SAL[b] = good

SAFE_RULES = {'R001', 'R010', 'R020', 'R022', 'R023', 'R024', 'R026', 'R097', 'R110', 'R111', 'R113', 'R114'}
rules = [r for r in csv.DictReader(open(os.path.join(HERE, 'rules.csv'), encoding='utf-8')) if r['rule_id'] in SAFE_RULES]

def apply_rule(rule, v):
    if rule['type'] == 'text': return v.replace(rule['find'], rule['replace'])
    if rule['type'] == 'word': return re.sub(r'(?<![\w])' + re.escape(rule['find']) + r'(?![\w])', rule['replace'], v)
    return re.sub(rule['find'], rule['replace'], v)

meta = {r['letter_number']: r for r in csv.DictReader(open(os.path.join(HERE, 'cartas_letters_corrected.csv'), encoding='utf-8'))}
letters = json.load(open(JSON, encoding='utf-8'))['letters']
log = []

def fix_salutation(n, text):
    first, _, rest = text.partition('\n')
    if ':' not in first[:90]: return text
    sal, colon, after = first.partition(':')
    new = small_caps(sal)
    words = new.split(' ')
    words = [SAL.get(w.rstrip('*'), w) for w in words]
    words = [('y' if (w == 'Y' and i > 0) else w) for i, w in enumerate(words)]
    if words and words[0] == 'Mr' and len(words) > 1 and words[1] in ('Muy', 'Mur'): words[0] = 'Mi'
    if words and words[0] == 'Mr' and len(words) > 1 and words[1] in ('Dear', 'Drar'): words[0] = 'My'
    if words[-1:] == ['Si'] and words[-2:-1] == ['Dear']: words[-1] = 'Sir'
    new = ' '.join(words).strip()
    if new != sal.strip(): log.append([n, 'salutation', sal.strip(), new])
    return new + colon + after + ('\n' + rest if rest else '')

SIG_WORDS = {'Valr': 'Vale', 'Vazlr': 'Vale', 'Ágoncillo': 'Agoncillo'}
def fix_signature(n, text, raw_sig, corrected_sig):
    lines = text.rstrip('\n').split('\n')
    last = lines[-1].strip()
    if not (0 < len(last) <= 40 and last.endswith('.') and len(last.split()) <= 4): return text
    raw_sig = raw_sig or ''
    if raw_sig.strip() and last == raw_sig.strip() and corrected_sig and n != '25':
        new = corrected_sig          # the signature line, as corrected in cartas_letters_corrected.csv
    else:
        new = small_caps(last)
        new = re.sub(r'^(?:SS|SN|NX|Ss|Sn|Nx|,)\s+', '', new)
        new = re.sub(r'^Ef\. ', 'F. ', new)
        new = re.sub(r'[A-Za-zÁ-ú]+', lambda m: SIG_WORDS.get(m.group(0), m.group(0)), new)
        for rule in rules: new = apply_rule(rule, new)
    if new != last:
        log.append([n, 'signature line', last, new]); lines[-1] = new
    return '\n'.join(lines)

out = []
m0 = meta['1']
out.append('Mariano Ponce, Cartas sobre la revolución, 1897-1900 (Manila: Bureau of Printing, 1932)\n'
           'Corrected OCR, plain text. Generated from Maponce_Data/ocr (raw OCR, unchanged) and Maponce_Data/corrected.\n'
           'For each letter: heading, editorial summary, dateline, addressee, then the letter text.\n'
           'Headings, datelines, addressees and signatures are corrected (see corrected/README.md and corrections_log.csv).\n'
           'Letter texts: original line breaks, hyphenation, spelling and accents kept as printed; only salutations,\n'
           'signature lines and recurring OCR garbles of names and places were fixed (text_corrections_log.csv).\n'
           'Other OCR errors in the running text remain. Check quotations against the page images.\n')
for L in letters:
    n = str(L['letter_number']); m = meta[n]
    text = L['text_diplomatic']
    before = text
    text = fix_salutation(n, text)
    for rule in rules:
        new = apply_rule(rule, text)
        if new != text:
            log.append([n, 'text, rule ' + rule['rule_id'], f"{len(re.findall(rule['find'], text)) if rule['type']=='regex' else text.count(rule['find'])} occurrence(s)", rule['replace']])
            text = new
    text = fix_signature(n, text, L['signatory_as_printed'], m['signatory_as_printed'])
    head = f"{n}. Carta a {m['recipient_as_printed']}"
    block = ['', '=' * 72, head,
             f"[letter {n} | {m['date_iso']} | from {m['origin_place_normalized']} to {m['destination_place_normalized'] or 'place not printed'} | recipient: {m['recipient_normalized']} | printed pp. {m['printed_pages']} | images {m['source_images']}]",
             '=' * 72, '']
    if m['editorial_summary']: block += [m['editorial_summary'], '']
    if m['place_date_as_printed']: block += [m['place_date_as_printed']]
    if m['addressee_block']: block += [l.strip() for l in m['addressee_block'].split('|')]
    block += ['', text.strip(), '']
    out.append('\n'.join(block))

with open(os.path.join(HERE, 'Cartas_OCR_corrected.txt'), 'w', encoding='utf-8') as f: f.write('\n'.join(out))
with open(os.path.join(HERE, 'text_corrections_log.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f); w.writerow(['letter_number', 'where', 'before', 'after']); w.writerows(log)
print(len(letters), 'letters,', len(log), 'text corrections logged')
