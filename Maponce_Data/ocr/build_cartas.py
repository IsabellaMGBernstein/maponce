#!/usr/bin/env python3
"""
Build the Mapping Maponce OCR deliverables from the per-page Tesseract output.

Input : ocr/pages/page_NNN.txt  (+ .tsv)  -- raw Tesseract 4 (spa), one per image
Output: ocr/Cartas_OCR_diplomatic.txt      -- whole book, page by page
        ocr/cartas_letters.json             -- one record per letter (244)
        ocr/cartas_letters.csv              -- same, flat, for spreadsheets / GIS
        ocr/ocr_corrections_log.csv         -- every automatic correction made

Run from the Maponce_Data folder:   python3 ocr/build_cartas.py
Only the Python standard library is needed.
"""
import csv, glob, json, os, re, statistics
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(HERE, "pages")
FIRST_LETTER_IMG = 37          # page_037.jpg = printed p. 1, letter 1
LAST_LETTER_IMG = 516          # letter 244 ends here; 517-520 are library leaves

# --------------------------------------------------------------------------
# 1. Conservative OCR correction: Tesseract reads the accented preposition
#    "á" as the digit "4". Replace a free-standing 4 only when context makes
#    it clearly a word, never in dates/quantities. Every change is logged.
# --------------------------------------------------------------------------
KEEP_NEXT = set("""de del sen pesos duros dólares dollars yens yen días horas meses años
mil millones centavos céntimos cents veces semanas fusiles hombres cañones rifles p. ps.
pm am p.m. a.m. o ó y cartas ejemplares libras cajas millas leguas por pies pasajeros
personas toneladas enero febrero marzo abril mayo junio julio agosto septiembre setiembre
octubre noviembre diciembre ene. feb. dic. oct. nov. sept. ag. jul. jun. abr.""".split())
KEEP_PREV = set("""el las los unos unas del de sus nuestros núm. no. nº n. página pág. art.
artículo son a á sobre cada entre ó o 6 y fha. fecha""".split())
UNIT_START = ("$", "£")


def fix_line(line):
    toks = line.split(" ")
    changes = []
    for i, t in enumerate(toks):
        if t != "4":
            continue
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        prv = toks[i - 1] if i > 0 else ""
        pl = prv.lower().strip(",;:")
        nl = nxt.lower().strip(",.;:")
        ok = False
        if nxt and nxt[0].isalpha() and nl not in KEEP_NEXT and pl not in KEEP_PREV \
                and not prv[-1:].isdigit():
            ok = True                                  # "ruego 4 V." -> "ruego á V."
        elif nxt.startswith(UNIT_START) and prv and not prv[-1:].isdigit():
            ok = True                                  # "Correajes 4 $0.80"
        elif prv.isdigit() and nxt.isdigit() and i >= 2 and toks[i - 2].lower() == "de":
            ok = True                                  # "de 13 4 14 mil" (range)
        if ok:
            toks[i] = "á"
            changes.append((prv, nxt))
    return " ".join(toks), changes


# --------------------------------------------------------------------------
# 2. Load pages
# --------------------------------------------------------------------------
HEADER_RE = re.compile(r"^\W*(\d{1,3})?\W*\s*(CARTAS SOBRE LA REVOLUCI|MARIANO PONCE|ÍNDICE DE MATERIAS|INDICE DE MATERIAS)"
                       r"|(CARTAS SOBRE LA REVOLUCI\S*|MARIANO PONCE|ÍNDICE DE MATERIAS)\s*\W*(\d{1,3}|[xvilXVIL]+)\W*$")
NUM_RE = re.compile(r"(\d{1,3})")

# --------------------------------------------------------------------------
# 1b. Spurious "í": Tesseract often adds an acute accent to i (familía, mísmo,
#     Patría). The list below was curated by reading every í-word the OCR
#     produced (1,398 forms) and keeping only forms that are certainly wrong.
#     Genuine and period spellings (fuí, dí, ví, tí, constituído, envía,
#     política, Miyokojí, Japanese names...) are NOT in the list and are left
#     alone. Each correction is logged.
# --------------------------------------------------------------------------
SPURIOUS_I = set("""
familía familías familíar patría casí mísmo mísma mísmos mís sín síno ní ín ís ít thís hís líbro líbre líbres
líbertad líbertades vísta vísto tíene conferencía conferancía ferencía noticía noticías notícia notícias motívos
paísano paísanos posíble posíbles possíble amerícanos amerícano amerícanas amerícans aguínaldo blumentrítt
blumentríitt líchauco líichauco rízal ríizal julío junío díce dícen díces cordíal cordíales cordiíal dínero
asímismo morír decír decírme decírtelo píe entusíasmo entusiíasmo víene ríco amígo amígos íba rífles contínuar
contínuamente contínuas contínuo contínuos síam oríente oríent filípinos filípina filípinas filípino filíipinos
bíak desgracía gobíerno camarínes camíno camínos quíere quíeran quíen quíera quíero felíz felíces felícito
felícitarle sígue sígo sígnifica víve índica materías matería materíales bautísta tíerra minístro mínistro
milítar víaje coloníal coloníales colonía colonías kolonía aprecía alemanía envíado envíar envíarlos envíarnos
envíarte hízo hízonos anteríor emilío fraíle fraíles socíales prímero prímeros prímo katípunan antonío ríego
resístir resísta independencía seguído seguír escríbir escríbes justícia dígo gloría glorías reína convenío
potencía beníto fusíles fusíl vísitas vísita dírecta lísto lísta tíro tíros tíroteo repíte leitmerítz retíre
revísta apacíble recíbido recíbe exíste arríba alíanza calumnías copía copíada memoría molestía molestías
moslestía misería odío odíos odíados odía naufragío negocío negocía negocíantes necesaría necesarías contraríada
industría indía rusía sibería austría australía californía grecía manchuría victoría tragedía comedía gracía
gracías propía varías guardía guardías vanguardía secretarío correligionaríos revolucionarías literaría
solidaría parlamentaría imperío augurío gregorío artemío tinío linarío leonzío engenío maquinaría mortuorías
centurías frailísmo filibusterísmo malayístas asimilísta orientalísta contrabandístas artículista autonomiísta
anuncías anuncíaste incendía denuncía elogía rabía furía ciencía conveniencía diferencía inocencía pendencía
dencía idencía tencía rencía venencía nancía gencía tancía cracía torías isídoro maríano tíago mabiní buencamíno
cavíte novalíches balíntawak calumpít maytubíg alíaga ikaríama chuídian takashíma shíga shígenobu tokíshawa
sugímura fukushíma fukushíima rívera rívero doría ír ídea vída sído bíen nadíe díez díos díputados clíma cívil
civíl fígurará híja míl míras pedír pedírle síento treínta fín chelínes tuvíéron escríban
agaín agaínst appoínt arríve artícle atíng beíng conceívable contaíns earlíest explaín foreígners maintaín remaín
receíve receípt sentíments spaín spírit sustaín theír tíme tímes títle tranquilíty trustíng wíll wíshes wishiíng
wríte íf íssue íntend íintend ínsults ím seeíng salutíng swíngingly duríng philíppine patriotíc necessíties
negotíate afírmation assímilation commíttee humaníity mutilatiíon quotatiíons oblíiged stíipulate ratífies rígging
cívilized filíbusters engíneers polítics artísts desíre desíres aíms portraít hereín críme
""".split())
_word_re = re.compile(r"[A-Za-zÁÉÍÓÚáéíóúñÑüÜ]+")


def fix_accents(line):
    changes = []
    def rep(m):
        w = m.group(0)
        if ("ií" in w or "íi" in w) and not w.lower().startswith("miyokoj"):   # doubled i: estudiíarlas
            new = w.replace("ií", "i").replace("íi", "i")
            changes.append((w, new))
            return new
        if w.lower() in SPURIOUS_I:
            new = w.replace("í", "i").replace("Í", "I")
            changes.append((w, new))
            return new
        return w
    return _word_re.sub(rep, line), changes


pages = OrderedDict()          # img -> dict
corr_log = []
for f in sorted(glob.glob(os.path.join(PAGES, "page_*.txt"))):
    img = int(os.path.basename(f)[5:8])
    raw = open(f, encoding="utf-8").read().rstrip("\n").split("\n")
    fixed = []
    for ln_no, line in enumerate(raw, 1):
        new, ch = fix_line(line)
        for prv, nxt in ch:
            corr_log.append({"image": f"page_{img:03d}.jpg", "line": ln_no, "from": f"{prv} 4 {nxt}".strip(),
                             "to": f"{prv} á {nxt}".strip(), "rule": "4->á (accented preposition)"})
        new, ch = fix_accents(new)
        for a, b in ch:
            corr_log.append({"image": f"page_{img:03d}.jpg", "line": ln_no, "from": a, "to": b,
                             "rule": "spurious í removed"})
        fixed.append(new)
    # confidence from TSV
    confs = []
    tsv = f[:-4] + ".tsv"
    if os.path.exists(tsv):
        with open(tsv, encoding="utf-8") as fh:
            for r in csv.DictReader(fh, delimiter="\t", quoting=csv.QUOTE_NONE):
                try:
                    c = float(r.get("conf") or -1)
                except ValueError:
                    continue
                if c >= 0 and (r.get("text") or "").strip():
                    confs.append(c)
    # running head / printed page number
    printed = None
    head_idx = None
    for k, line in enumerate(fixed[:2]):
        if HEADER_RE.search(line):
            head_idx = k
            m = re.match(r"^\W*(\d{1,3})\b", line) or re.search(r"\b(\d{1,3})\W*$", line)
            if m:
                printed = int(m.group(1))
            break
    pages[img] = {"lines": fixed, "raw": raw, "head_idx": head_idx, "printed": printed,
                  "conf": round(statistics.mean(confs), 1) if confs else None, "nwords": len(confs)}

# Fill printed page numbers for body pages by consistent offset from neighbours
known = {i: p["printed"] for i, p in pages.items() if p["printed"] and i >= FIRST_LETTER_IMG}
offsets = sorted((i, i - n) for i, n in known.items())
def printed_for(img):
    if img < FIRST_LETTER_IMG or img > LAST_LETTER_IMG:
        return pages[img]["printed"]
    if img in known:
        return known[img]
    before = [o for i, o in offsets if i < img]
    after = [o for i, o in offsets if i > img]
    if before and after and before[-1] == after[0]:
        return img - before[-1]
    return None
for i in pages:
    pages[i]["printed_filled"] = printed_for(i)
# first page of letters has no running head
pages[FIRST_LETTER_IMG]["printed_filled"] = 1

# --------------------------------------------------------------------------
# 3. Combined diplomatic text
# --------------------------------------------------------------------------
out_txt = os.path.join(HERE, "Cartas_OCR_diplomatic.txt")
with open(out_txt, "w", encoding="utf-8") as fh:
    fh.write("Mariano Ponce, Cartas sobre la revolución, 1897-1900 (Manila: Bureau of Printing, 1932)\n")
    fh.write("OCR: Tesseract 4.1.1, Spanish model, from cartas-images/*.jpg. Diplomatic transcription:\n")
    fh.write("original line breaks, end-of-line hyphenation, spelling, accents, punctuation and\n")
    fh.write("capitalisation are kept as printed. Two automatic corrections only, both logged in\n")
    fh.write("ocr_corrections_log.csv: '4' misread for the preposition 'á', and accents Tesseract added\n")
    fh.write("to 'i' (familía -> familia; curated list). Otherwise uncorrected OCR - verify quotations\n")
    fh.write("against the page images.\n")
    for img, p in pages.items():
        pn = p["printed_filled"]
        fh.write(f"\n\n===== [image page_{img:03d}.jpg" + (f" | printed p. {pn}" if pn else "") + "] =====\n\n")
        fh.write("\n".join(p["lines"]).strip("\n") + "\n")

# --------------------------------------------------------------------------
# 4. Index: parts, years, index recipient + printed page, per letter number
# --------------------------------------------------------------------------
idx_entries = []
part, year_sec = None, None
PART_RE = re.compile(r"^\W{0,2}(I|Il|II|III|IV|HI|1I|lI)\.?\s+(PONCE .+)$")
YEAR_RE = re.compile(r"^\(?A[ñn]o (1[89]\d\d)\)?")
IDX_ENTRY_RE = re.compile(r"^\s*\S{1,5}(?: \S{1,3})?[.,]\s*C[AaRrTt]{2,4}[Aa]?\s+(A|a|AL|al)\s+(.+)")
for img in range(1, FIRST_LETTER_IMG):
    p = pages.get(img)
    if not p:
        continue
    for line in p["lines"]:
        s = line.strip()
        m = PART_RE.match(s)
        if m:
            part = m.group(2).strip()
            continue
        m = YEAR_RE.match(s)
        if m:
            year_sec = int(m.group(1))
            continue
        m = IDX_ENTRY_RE.match(s)
        if m and part:
            if "Continuaci" in s:
                continue
            rest = m.group(2)
            name = re.split(r"\.?\s*[—–-]{1,2}", rest, 1)[0].strip(" .")
            nm = re.match(r"^\s*(\d{1,3})[.,]", s)
            prev_num = idx_entries[-1]["num"] if idx_entries else 0
            num = int(nm.group(1)) if nm and int(nm.group(1)) > prev_num else prev_num + 1
            idx_entries.append({"num": num, "part": part, "year_section": year_sec, "index_recipient": name,
                                "index_image": f"page_{img:03d}.jpg"})
idx_by_num = {e["num"]: e for e in idx_entries}

# --------------------------------------------------------------------------
# 5. Split letters
# --------------------------------------------------------------------------
HEAD_RE = re.compile(r"^\s*(\S{1,5}?(?: \S{1,3})?)[.,]\s*(Carta|CARTA|Carra|Carla)\s+(a|al|á|A|AL)\s+(.+?)\s*$")
body = []    # (img, line_no, text)
for img in range(FIRST_LETTER_IMG, LAST_LETTER_IMG + 1):
    p = pages[img]
    lines = p["lines"]
    for k, line in enumerate(lines):
        if k == p["head_idx"]:
            continue
        body.append((img, k + 1, line))

heads = [i for i, (_, _, t) in enumerate(body) if HEAD_RE.match(t)]

MONTHS = {
    1: r"ene(ro)?|jan(uary)?", 2: r"feb(rero|ruary)?|fbro", 3: r"mar(zo|ch)?|mzo",
    4: r"abr(il)?|apr(il)?", 5: r"may(o)?", 6: r"jun(io|e)?", 7: r"jul(io|y)?",
    8: r"ag(osto|to)?|aug(ust)?", 9: r"sep(t(iembre|ember)?)?|set(iembre)?|sbre",
    10: r"oct(ubre|ober)?|obre", 11: r"nov(iembre|ember)?|nbre", 12: r"dic(iembre)?|dec(ember)?|dbre",
}
MONTH_ALT = "|".join(f"(?P<m{k}>{v})" for k, v in MONTHS.items())
DAY = r"(?P<day>\d{1,2})\s*(?:st|nd|rd|th|o|º|\.[º”\"2o°]|\.)?"
MJUNK = r"[\.\*'’\"”]*"
DATE_RE = re.compile(DAY + r"\s*(?:de\s+|of\s+)?(?:" + MONTH_ALT + r")" + MJUNK + r"\s*,?\s*(?:de\s+|del\s+)?,?\s*(?P<year>1[89]\d\d)",
                     re.IGNORECASE)
MONTH_FIRST_RE = re.compile(r"(?:" + MONTH_ALT + r")" + MJUNK + r"\s+" + DAY + r",?\s*(?:de\s+)?(?P<year>1[89]\d\d)", re.IGNORECASE)
YEAR_ONLY = re.compile(r"1[89]\d\d")
SIGNOFF_RE = re.compile(r"^\s*\W?\s*([A-Z][\w.]*\.?\s+){0,3}[A-Z][A-Za-zÁÉÍÓÚáéíóúñÑ]+\.?,?\s*$")


CITY_KEYS = [(r"Hong\s?-?kong|Hongkong|Hong Kong", "Hong Kong"), (r"Y\s?oko\w*ama|Y\s?ok\w*ama", "Yokohama"),
             (r"T[oó]ki?y?o", "Tokyo"), (r"Kobe", "Kobe"), (r"Nagasaki", "Nagasaki"), (r"Manila", "Manila"),
             (r"Lower Castle Terrace", "Hong Kong"), (r"Miyokoj", "Yokohama")]
DEST_KEYS = CITY_KEYS[:6] + [(r"Leitmeritz", "Leitmeritz (Litoměřice)"), (r"Madrid", "Madrid"), (r"Shang", "Shanghai"),
             (r"Par[ií]s", "Paris"), (r"Barcelona", "Barcelona"), (r"New Orleans", "New Orleans"), (r"Maca[ou]", "Macau"),
             (r"Singap", "Singapore"), (r"Zaragoza", "Zaragoza"), (r"Washington", "Washington, D.C."),
             (r"Malolos", "Malolos"), (r"Hon\s?g\s?-?\s?[kKR]\s?on\s?g", "Hong Kong"), (r"Londres|London", "London"),
             (r"Nueva York|New York", "New York"), (r"Berl[ií]n", "Berlin"), (r"Praga|Prague", "Prague"),
             (r"Viena|Vienna|Wien", "Vienna"), (r"Saig[oó]n", "Saigon"), (r"Bruselas|Brussels", "Brussels"),
             (r"Nueva Orleans", "New Orleans"), (r"Flon\s?g\s?kong", "Hong Kong"), (r"Haarlem", "Haarlem"),
             (r"Osaka", "Osaka"), (r"Dresd", "Dresden"), (r"Montreal", "Montreal"), (r"T[aá]rlac", "Tarlac")]
CITY_COORDS = {"Leitmeritz (Litoměřice)": (50.5335, 14.1318), "Madrid": (40.4168, -3.7038), "Shanghai": (31.2304, 121.4737),
               "Paris": (48.8566, 2.3522), "Barcelona": (41.3874, 2.1686), "New Orleans": (29.9511, -90.0715),
               "Macau": (22.1987, 113.5439), "Singapore": (1.2903, 103.8519), "Zaragoza": (41.6488, -0.8891),
               "Washington, D.C.": (38.9072, -77.0369), "Malolos": (14.8433, 120.8114), "London": (51.5072, -0.1276),
               "New York": (40.7128, -74.0060), "Berlin": (52.5200, 13.4050), "Prague": (50.0755, 14.4378),
               "Vienna": (48.2082, 16.3738), "Saigon": (10.7769, 106.7009), "Brussels": (50.8503, 4.3517),
               "Haarlem": (52.3874, 4.6462), "Osaka": (34.6937, 135.5023), "Dresden": (51.0504, 13.7373),
               "Montreal": (45.5019, -73.5674), "Tarlac": (15.4755, 120.5963)}
# Dates checked by eye against the page images where OCR could not read them
MANUAL_DATES = {12: "1897-09-09", 142: "1899-03-04", 159: "1899-04-05", 238: "1900-02-02",
                109: "1898-11-20"}
CITY_COORDS.update({"Hong Kong": (22.2819, 114.1581), "Yokohama": (35.4437, 139.6380), "Tokyo": (35.6895, 139.6917),
               "Kobe": (34.6901, 135.1955), "Nagasaki": (32.7503, 129.8779), "Manila": (14.5995, 120.9842)})
PART_BASE = {"PONCE EN HONGKONG": "Hong Kong", "PONCE EN YOKOHAMA (JAPÓN)": "Yokohama",
             "PONCE CON LICENCIA, EN HONGKONG": "Hong Kong", "PONCE DE VUELTA EN JAPÓN": "Yokohama"}


def dehyphen(lines):
    out = ""
    for ln in lines:
        ln = ln.strip()
        if not ln:
            out += "\n\n"
            continue
        if out.endswith("-") and ln[:1].islower():
            out = out[:-1] + ln
        elif out and not out.endswith("\n"):
            out += " " + ln
        else:
            out += ln
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


letters = []
for n, hi in enumerate(heads, 1):
    end = heads[n] if n < len(heads) else len(body)
    seg = body[hi:end]
    img0, ln0, head_line = seg[0]
    m = HEAD_RE.match(head_line)
    ocr_num = m.group(1)
    recip = re.sub(r"(\s+[l|I1]|[\s«»•·|])+$", "", m.group(4)).strip()
    flags = []
    if not re.fullmatch(str(n), ocr_num or ""):
        flags.append(f"heading number read by OCR as '{ocr_num}'")

    rest = seg[1:]
    texts = [t for _, _, t in rest]
    # find date line: first line within 14 containing a year and a month/date
    date_i, dm = None, None
    for j, t in enumerate(texts[:14]):
        t = t.replace("€", "8")          # OCR misreads old-style 8 as the euro sign
        mm = DATE_RE.search(t) or MONTH_FIRST_RE.search(t)
        if mm:
            date_i, dm = j, mm
            break
    if date_i is None:
        for j, t in enumerate(texts[:14]):
            if YEAR_ONLY.search(t):
                date_i = j
                break
    # place/date block may start on preceding address lines ending with ','
    blk_start = date_i
    if date_i is not None:
        while blk_start > 0 and texts[blk_start - 1].rstrip().endswith(",") and "—" not in texts[blk_start - 1]:
            blk_start -= 1
    summ_lines, notes = [], []
    for t in texts[: blk_start if blk_start is not None else 0]:
        if re.match(r"^\s*(Por el|Por vapor|Vía|Via|\(|\[)", t) and "—" not in t:
            notes.append(t.strip())
        elif t.strip():
            summ_lines.append(t.strip())
    place_date_lines = [t.strip() for t in texts[blk_start:date_i + 1]] if date_i is not None else []
    place_date = " ".join(place_date_lines).replace("€", "8") if place_date_lines else ""

    day = month = year = None
    place = None
    if dm:
        day = int(dm.group("day"))
        month = next(k for k in MONTHS if dm.group(f"m{k}"))
        year = int(dm.group("year"))
        place = place_date[: place_date.find(dm.group(0))] if dm.group(0) in place_date else None
        if place is not None:
            place = place.strip(" ,.;”\"'’“")
            place = re.sub(r"^[^\wÁÉÍÓÚ]+", "", place)
        if not (1 <= day <= 31):
            flags.append("day out of range")
            day = None
    else:
        flags.append("date not parsed automatically")
        ym = YEAR_ONLY.search(place_date)
        year = int(ym.group()) if ym else None

    # addressee block + salutation
    after = texts[date_i + 1:] if date_i is not None else texts[len(summ_lines):]
    after_off = (date_i + 1) if date_i is not None else len(summ_lines)
    sal_i = None
    for j, t in enumerate(after[:7]):
        if ":" in t and t.split(":", 1)[1].strip():   # salutation runs straight into the body
            sal_i = j
            break
    if sal_i is None:                                  # fallback: salutation alone on its line
        for j, t in enumerate(after[:7]):
            if ":" in t and not re.search(r"\bEsq", t):
                sal_i = j
                break
    addressee = [t.strip() for t in after[: sal_i if sal_i is not None else 0] if t.strip()]
    salutation = after[sal_i].split(":", 1)[0].strip() if sal_i is not None else None
    body_start = after_off + (sal_i if sal_i is not None else 0)
    body_lines = texts[body_start:]
    # trim trailing blank / stray lines
    while body_lines and not body_lines[-1].strip():
        body_lines.pop()
    if sal_i is None:
        flags.append("salutation not found")

    # signatory guess: last short capitalised line mentioning a name
    signatory = None
    for t in reversed(body_lines[-6:]):
        s = t.strip()
        if 2 < len(s) < 40 and SIGNOFF_RE.match(s) and not s.lower().startswith(("con ", "no. ")):
            signatory = s.rstrip(",")
            break

    imgs = sorted({i for i, _, _ in seg})
    confs = [pages[i]["conf"] for i in imgs if pages[i]["conf"] is not None]
    idx = idx_by_num.get(n)
    if idx is None:
        prev_e = max((e for k, e in idx_by_num.items() if k < n), key=lambda e: e["num"], default={})
        idx = {"part": prev_e.get("part"), "year_section": prev_e.get("year_section"), "index_recipient": None}
        flags.append("no index entry found by OCR; part/year taken from preceding letter")
    if n in MANUAL_DATES:
        year, month, day = (int(v) for v in MANUAL_DATES[n].split("-"))
        flags = [f for f in flags if f != "date not parsed automatically"]
        flags.append("date read manually from page image (OCR garbled it)")
    ysec = idx.get("year_section")
    if year and not (1897 <= year <= 1900):
        flags.append(f"OCR year '{year}' outside 1897-1900; replaced by index year section {ysec}")
        year = ysec
    elif year and ysec and abs(year - ysec) > 1:
        flags.append(f"year {year} disagrees with index year section {ysec}; check image")

    # origin city: first known city in the place/date block, else Ponce's base in this part
    origin_city, origin_basis = None, None
    for key, city in CITY_KEYS:
        if re.search(key, place_date or "", re.IGNORECASE):
            origin_city, origin_basis = city, "place/date line"
            break
    if not origin_city and idx.get("part"):
        origin_city = PART_BASE.get(idx["part"])
        origin_basis = "inferred from book part (Ponce's residence)" if origin_city else None
    loc_guess = addressee[-1].rstrip(".") if addressee and len(addressee[-1].split()) <= 3 \
        and not re.match(r"^(Sr|Sra|D|Dr|Mr|Mrs|Prof|Hon|Excmo|Ilmo|Srta)\b", addressee[-1]) and len(addressee) > 1 else None
    dest_city = None
    probe = loc_guess or (addressee[-1] if len(addressee) > 1 else "")
    for key, city in DEST_KEYS:
        if probe and re.search(key, probe, re.IGNORECASE):
            dest_city = city
            break
    summary = dehyphen(summ_lines)
    key_ideas = [k.strip(" .") for k in re.split(r"\s*[—–]+\s*", summary) if k.strip(" .")]

    letters.append(OrderedDict([
        ("id", f"ponce-{n:03d}"),
        ("letter_number", n),
        ("heading", head_line.strip()),
        ("recipient_as_printed", recip),
        ("recipient_index_form", idx.get("index_recipient")),
        ("recipient_normalized", None),
        ("sender", "Mariano Ponce"),
        ("signatory_as_printed", signatory),
        ("part", idx.get("part")),
        ("year_section", idx.get("year_section")),
        ("place_date_as_printed", place_date or None),
        ("place_as_printed", place or None),
        ("date_iso", f"{year:04d}-{month:02d}-{day:02d}" if (year and month and day) else None),
        ("date_year", year),
        ("date_month", month),
        ("date_day", day),
        ("origin_place_normalized", origin_city),
        ("origin_basis", origin_basis),
        ("origin_lat", CITY_COORDS.get(origin_city, (None, None))[0]),
        ("origin_lon", CITY_COORDS.get(origin_city, (None, None))[1]),
        ("addressee_block", addressee),
        ("destination_as_printed_guess", loc_guess),
        ("destination_place_normalized", dest_city),
        ("destination_basis", "last line of addressee block (auto)" if dest_city else None),
        ("destination_lat", CITY_COORDS.get(dest_city, (None, None))[0]),
        ("destination_lon", CITY_COORDS.get(dest_city, (None, None))[1]),
        ("salutation", salutation),
        ("transmission_notes", notes),
        ("editorial_summary", summary),
        ("key_ideas", key_ideas),
        ("text_diplomatic", "\n".join(body_lines).strip("\n")),
        ("text_reading", dehyphen(body_lines)),
        ("source_images", [f"page_{i:03d}.jpg" for i in imgs]),
        ("printed_pages", sorted({pages[i]["printed_filled"] for i in imgs if pages[i]["printed_filled"]})),
        ("start", {"image": f"page_{img0:03d}.jpg", "line": ln0}),
        ("ocr_mean_confidence", round(statistics.mean(confs), 1) if confs else None),
        ("review_flags", flags),
    ]))

prev = None
for L in letters:
    if L["date_iso"] and prev and L["date_iso"] < prev:
        L["review_flags"].append("date earlier than the preceding letter (book order is not strictly chronological; check image)")
    if L["date_iso"]:
        prev = L["date_iso"]

with open(os.path.join(HERE, "cartas_letters.json"), "w", encoding="utf-8") as fh:
    json.dump({"source": "Mariano Ponce, Cartas sobre la revolución, 1897-1900 (Manila, 1932). "
                         "UMich Digital Collections afj2286.0001.001",
               "ocr": "Tesseract 4.1.1 spa, psm 6, images downscaled 50%",
               "count": len(letters),
               "fields_to_fill": ["recipient_normalized", "origin_* and destination_* (pre-filled automatically where recognisable; verify)",
                                  "destination_place_normalized", "destination_lat", "destination_lon"],
               "letters": letters}, fh, ensure_ascii=False, indent=2)

flat_cols = ["id", "letter_number", "recipient_as_printed", "recipient_index_form", "recipient_normalized",
             "signatory_as_printed", "part", "year_section", "place_date_as_printed", "place_as_printed",
             "date_iso", "origin_place_normalized", "origin_basis", "origin_lat", "origin_lon", "addressee_block",
             "destination_as_printed_guess", "destination_place_normalized", "destination_basis", "destination_lat", "destination_lon",
             "salutation", "editorial_summary", "key_ideas", "source_images", "printed_pages",
             "ocr_mean_confidence", "review_flags", "text_reading"]
with open(os.path.join(HERE, "cartas_letters.csv"), "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(flat_cols)
    for L in letters:
        row = []
        for c in flat_cols:
            v = L[c]
            if isinstance(v, list):
                v = " | ".join(str(x) for x in v)
            row.append("" if v is None else v)
        w.writerow(row)

with open(os.path.join(HERE, "ocr_corrections_log.csv"), "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=["image", "line", "from", "to", "rule"])
    w.writeheader()
    w.writerows(corr_log)

print(f"pages: {len(pages)}  letters: {len(letters)}  index entries: {len(idx_entries)}  corrections: {len(corr_log)}")
print("dated:", sum(1 for L in letters if L["date_iso"]), " salutations:", sum(1 for L in letters if L["salutation"]))
print("flagged:", sum(1 for L in letters if L["review_flags"]))
