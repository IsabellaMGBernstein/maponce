"""Write corrected/cartas_biographical.csv: one row per letter, correspondence details only
(sender, place sent from, recipient, recipient's location, date). Built from the most recent
corrected table, corrected/cartas_letters_revised.csv. No letter text, summaries or key ideas.
Run from Maponce_Data:   python3 corrected/make_biographical_csv.py
"""
import csv, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
rows = list(csv.DictReader(open(os.path.join(HERE, 'cartas_letters_revised.csv'), encoding='utf-8-sig')))

COLS = ['letter_number', 'id', 'date', 'date_as_printed',
        'sender', 'signed_as',
        'sent_from', 'sent_from_as_printed', 'sent_from_lat', 'sent_from_lon', 'sent_from_basis',
        'recipient', 'recipient_as_printed',
        'recipient_location', 'recipient_location_as_printed', 'recipient_lat', 'recipient_lon', 'recipient_location_basis',
        'printed_pages', 'source_images']

# Signature lines are read from the end of the corrected letter text (last 10 lines).
SIGS = [
    (r'(?:M[.,]?\s*P\s?once|Mariano\s+Ponce(?:\s+Collantes)?|^Mariano\.?$)', 'Mariano Ponce'),
    (r'Lichauco', 'F. Lichauco'), (r'R[ir]?r?vero', 'F. Rivero'), (r'Samper', 'R. Samper'),
    (r'Naning', 'Naning'), (r'Kalipulako', 'Kalipulako'), (r'P\. Mario', 'P. Mario'),
    (r'Sin firma', '[Sin firma]'), (r'^\W*Vale\.?$', 'Vale'),
]
COSIGNERS = {'F. Lichauco', 'F. Rivero'}

def clean_sig(ln):
    """Signature as printed, minus OCR debris: closing words before it, stray marks, footnote stars."""
    ln = re.sub(r'^.*,\s+(?=(?:M[.,]|Mariano|R\.|Robert|F\.)\s?\S)', '', ln)   # "Fielmente suyo, M. Ponce."
    ln = re.sub(r'^(?:[a-z]{1,2}\s+|So\s+|muy So\s+)', '', ln)                  # "o M. Ponce", "a Naning"
    ln = re.sub(r'^[^A-Za-zÁ-ú\[]+', '', ln).rstrip(' *')
    for a, b in (('M, Ponce', 'M. Ponce'), ('P once', 'Ponce'), ('RoserT', 'Robert'), ('Rrvero', 'Rivero'),
                 ('Rivero.)', 'Rivero.]'), ('Ponce:', 'Ponce.')):
        ln = ln.replace(a, b)
    if ln.endswith(','):
        ln = ln[:-1] + '.'
    return ln


def signatures(text):
    found, printed = [], []
    for ln in text.strip().split('\n')[-10:]:
        ln = ln.strip()
        if not ln or len(ln.split()) > 7:
            continue
        for pat, name in SIGS:
            if name in COSIGNERS and len(ln.split()) > 3:
                continue
            if re.search(pat, ln) and name not in found:
                # skip mentions inside prose, e.g. "Manifiesto del General Aguinaldo."
                found.append(name)
                printed.append(clean_sig(ln))
                break
    return found, printed

out = []
for r in rows:
    found, printed = signatures(r['text_diplomatic'])
    continues = re.search(r'\(Contin\w+ en la página (\d+)\)', r['text_diplomatic'][-80:])
    signed = ' / '.join(printed) if printed else r['signatory_as_printed'].strip()
    if signed.startswith('General Aguinaldo'):
        signed = ''
    sender = 'Mariano Ponce'
    cos = [n for n in found if n in COSIGNERS]
    if cos:
        sender = '; '.join(['Mariano Ponce'] + cos)
    if not signed and continues:
        signed = f'(text continues on printed p. {continues.group(1)})'
    origin_in_dateline = re.search(r'Hong|Yoko|Miyokoj|Castle Terrace|Remedios', r['place_date_as_printed'] or '')
    loc_printed = r['destination_as_printed_guess']
    m = re.search(r'printed (?:in addressee block: )?"([^"]+)"', r['destination_basis'])
    if not loc_printed and m:
        loc_printed = m.group(1)
    basis = r['destination_basis']
    if basis == 'last line of addressee block (auto)':
        basis = 'last line of addressee block'
    out.append({
        'letter_number': r['letter_number'], 'id': r['id'],
        'date': r['date_iso'], 'date_as_printed': r['place_date_as_printed'],
        # The book collects Ponce's letters; he signed some with nicknames or pen names
        # (Naning, Kalipulako...). signed_as keeps the printed signature.
        'sender': sender, 'signed_as': signed,
        'sent_from': r['origin_place_normalized'], 'sent_from_as_printed': r['place_as_printed'],
        'sent_from_lat': r['origin_lat'], 'sent_from_lon': r['origin_lon'],
        'sent_from_basis': 'dateline' if origin_in_dateline else r['origin_basis'],
        'recipient': r['recipient_normalized'], 'recipient_as_printed': r['recipient_as_printed'],
        'recipient_location': r['destination_place_normalized'], 'recipient_location_as_printed': loc_printed,
        'recipient_lat': r['destination_lat'], 'recipient_lon': r['destination_lon'],
        'recipient_location_basis': basis if r['destination_place_normalized'] else 'not printed in the letter',
        'printed_pages': r['printed_pages'], 'source_images': r['source_images'],
    })

with open(os.path.join(HERE, 'cartas_biographical.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(out)
print(len(out), 'rows -> corrected/cartas_biographical.csv')
