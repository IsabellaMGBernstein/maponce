"""Build corrected/cartas_letters_revised.csv from the corrected OCR.

Takes every row and column of cartas_letters_corrected.csv (corrected map fields) and replaces the
letter-text columns with the text from Cartas_OCR_corrected.txt (corrected salutations, signatures
and recurring name garbles):
  - salutation        <- the corrected salutation (text before the first colon of the letter)
  - text_reading      <- corrected text, end-of-line hyphenation joined, paragraphs kept
  - text_diplomatic   <- (new column) corrected text with the original line breaks
  - text_source       <- (new column) where the text came from
Run from Maponce_Data, after make_text.py:   python3 corrected/make_revised_csv.py
Standard library only.
"""
import csv, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
SEP = '=' * 72

rows = list(csv.DictReader(open(os.path.join(HERE, 'cartas_letters_corrected.csv'), encoding='utf-8')))
cols = list(rows[0].keys())
txt = open(os.path.join(HERE, 'Cartas_OCR_corrected.txt'), encoding='utf-8').read()

# Split into letter blocks: SEP / heading / [meta] / SEP / body
parts = txt.split('\n' + SEP + '\n')
blocks = {}
for i in range(1, len(parts) - 1, 2):
    head = parts[i]
    m = re.search(r'\[letter (\d+) \|', head)
    blocks[m.group(1)] = parts[i + 1]

def dehyphen(text):
    out = []
    for para in re.split(r'\n\s*\n', text.strip()):
        s = ''
        for ln in para.split('\n'):
            ln = ln.strip()
            if not ln:
                continue
            if s.endswith('-') and ln[:1].islower():
                s = s[:-1] + ln
            elif s:
                s += ' ' + ln
            else:
                s = ln
        if s:
            out.append(s)
    return '\n\n'.join(out)

# Fixes checked against the page images (14 Oct 2026). The letter body of these three
# letters started or ended with lines the OCR split had left in the wrong place.
FIXES = [
    ('55', 'text', ': Hongko.:g.\n\nNi Mur Quirino Amico:', 'Mi Muy Querido Amigo:',
     'page_159.jpg: addressee line left in text; salutation is MI MUY QUERIDO AMIGO (page is damaged here)'),
    ('117', 'text', 'Il. Hirara, Esq.,\n\nDear Mk. iman have', 'Dear Mr. Hirata: I have',
     'page_297.jpg: addressee line left in text; salutation is DEAR MR. HIRATA'),
    ('117', 'text', '* Queripo Sr. Hirara:', '* Querido Sr. Hirata:', 'footnote translation, same salutation'),
    ('117', 'addressee_block', '', 'I. Hirata, Esq.,', 'page_297.jpg'),
    ('244', 'text', 'eN R. Samper.\nO\nÍ\na\n» : : : + :\n, | |', 'R. Samper.',
     'page_516.jpg: signature is R. SAMPER; following lines are page stains'),
    ('244', 'signatory_as_printed', '', 'R. Samper.', 'page_516.jpg'),
]
log = []
problems = []
for r in rows:
    n = r['letter_number']
    body = blocks[n].lstrip('\n')
    # body = [summary \n\n] [dateline + addressee lines \n\n] letter text
    skip = 0
    if r['editorial_summary']:
        skip += 1
    if r['place_date_as_printed'] or r['addressee_block']:
        skip += 1
    chunks = body.split('\n\n')
    text = '\n\n'.join(chunks[skip:]).strip('\n')
    # sanity: the summary chunk must match, and the text must not be empty
    if r['editorial_summary'] and chunks[0].strip() != r['editorial_summary'].strip():
        problems.append((n, 'summary mismatch'))
    if len(text) < 200:
        problems.append((n, f'short text ({len(text)} chars)'))
    for (fn, field, before, after, evidence) in FIXES:
        if fn != n:
            continue
        if field == 'text':
            if before not in text:
                problems.append((n, f'fix not applied: {before!r}'))
                continue
            text = text.replace(before, after, 1)
        else:
            r[field] = after
        log.append([n, field, before, after, evidence])
    first = text.split('\n', 1)[0]
    sal = first.split(':', 1)[0].strip() if ':' in first[:90] else ''
    r['salutation'] = sal
    r['text_diplomatic'] = text
    r['text_reading'] = dehyphen(text)
    r['text_source'] = 'Cartas_OCR_corrected.txt'

out_cols = cols[:cols.index('text_reading') + 1] + ['text_diplomatic'] + cols[cols.index('text_reading') + 1:] + ['text_source']
with open(os.path.join(HERE, 'cartas_letters_revised.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=out_cols)
    w.writeheader()
    w.writerows(rows)
with open(os.path.join(HERE, 'revised_csv_log.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['letter_number', 'field', 'before', 'after', 'evidence'])
    w.writerows(log)
print(len(rows), 'rows written to corrected/cartas_letters_revised.csv')
print('problems:', problems or 'none')
