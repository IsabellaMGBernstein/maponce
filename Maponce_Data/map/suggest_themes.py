"""
Suggest themes for the letters, for the author to review. Nothing here decides a theme on its own.

Run from the Maponce_Data folder with the .venv active (it needs gensim):
    python map/suggest_themes.py

Three files in this folder (UTF-8 CSV; open them in Numbers, Excel or a text editor):

  themes.csv         YOU write this: one row per theme (up to 10).
                       theme        the theme's name as it should appear on the map
                       seed_words   the words that signal it, separated by spaces (accents optional)
                       description  optional, shown on the map

  theme_words.csv    The words each theme is searched with. Seed words are added with use=yes.
                     The Word2Vec model (word2vec_corrected/) adds related words with use=maybe;
                     they are NOT searched until you change "maybe" to "yes" (or "no" to drop them).

  letter_themes.csv  The suggestions: one row per letter and theme, with the words found in that
                     letter. Change status from "suggested" to "confirmed" or "rejected".
                     Only confirmed rows appear on the themes map. Your confirmed and rejected rows
                     are never changed when this script runs again; only "suggested" rows are redone.

Afterwards rebuild the maps:  python3 map/build_data.py corrected/cartas_letters_revised.csv map_corrected
"""
import csv
import re
import unicodedata
from pathlib import Path

from gensim.models import Word2Vec

HERE = Path(__file__).resolve().parent
DATA = HERE.parent
LETTERS = DATA / "corrected" / "cartas_letters_revised.csv"
MODEL = DATA / "word2vec_corrected" / "cartas_word2vec_corrected.model"
THEMES, WORDS, SUGGESTIONS = HERE / "themes.csv", HERE / "theme_words.csv", HERE / "letter_themes.csv"

RELATED_PER_SEED = 8      # related words proposed for each seed word
MIN_SIMILARITY = 0.60     # ...if at least this similar in the model
MIN_HITS = 1              # a letter is suggested for a theme if its words occur at least this often


def normalize(text):
    """Lower case, no accents: the same word forms the Word2Vec model was trained on (España -> espana)."""
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text.lower())
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def read(path):
    return list(csv.DictReader(open(path, encoding="utf-8-sig"))) if path.exists() else []


def write(path, fields, rows):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)


themes = [t for t in read(THEMES) if t["theme"].strip()]
if not themes:
    raise SystemExit(f"No themes yet: add rows to {THEMES.name} (theme, seed_words, description).")

# ---------------------------------------------------------------- 1. words per theme
model = Word2Vec.load(str(MODEL))
words = read(WORDS)
known = {(w["theme"], w["word"]) for w in words}
for t in themes:
    for seed in normalize(t["seed_words"]).split():
        if (t["theme"], seed) not in known:
            words.append({"theme": t["theme"], "word": seed, "source": "seed", "similarity": "", "use": "yes"})
            known.add((t["theme"], seed))
        if seed in model.wv:
            for other, sim in model.wv.most_similar(seed, topn=RELATED_PER_SEED):
                if sim >= MIN_SIMILARITY and (t["theme"], other) not in known:
                    words.append({"theme": t["theme"], "word": other, "source": f"word2vec: like {seed}",
                                  "similarity": f"{sim:.2f}", "use": "maybe"})
                    known.add((t["theme"], other))
theme_order = [t["theme"] for t in themes]
words = [w for w in words if w["theme"] in theme_order]
words.sort(key=lambda w: (theme_order.index(w["theme"]), w["source"] != "seed", w["word"]))
write(WORDS, ["theme", "word", "source", "similarity", "use"], words)

# ---------------------------------------------------------------- 2. suggest letters
search = {t: {w["word"] for w in words if w["theme"] == t and w["use"].strip().lower() == "yes"} for t in theme_order}
letters = read(LETTERS)
old = read(SUGGESTIONS)
decided = {(r["letter"], r["theme"]): r for r in old if r["status"].strip().lower() in ("confirmed", "rejected")}
rows = []
for L in letters:
    tokens = re.findall(r"[a-z]+", normalize(L["text_reading"]))
    for t in theme_order:
        key = (L["letter_number"], t)
        found = {}
        for tok in tokens:
            if tok in search[t]:
                found[tok] = found.get(tok, 0) + 1
        if key in decided:
            r = decided.pop(key)                      # keep the author's decision, refresh the evidence
            r["hits"] = sum(found.values())
            r["words_found"] = " ".join(f"{w}×{n}" for w, n in sorted(found.items(), key=lambda x: -x[1]))
            rows.append(r)
        elif sum(found.values()) >= MIN_HITS:
            rows.append({"letter": L["letter_number"], "date": L["date_iso"], "recipient": L["recipient_normalized"],
                         "theme": t, "hits": sum(found.values()),
                         "words_found": " ".join(f"{w}×{n}" for w, n in sorted(found.items(), key=lambda x: -x[1])),
                         "status": "suggested", "note": ""})
rows += decided.values()                                # decisions on themes no longer listed are kept too
rows.sort(key=lambda r: (theme_order.index(r["theme"]) if r["theme"] in theme_order else 99, int(r["letter"])))
write(SUGGESTIONS, ["letter", "date", "recipient", "theme", "hits", "words_found", "status", "note"], rows)

# ---------------------------------------------------------------- 3. report
for t in theme_order:
    mine = [r for r in rows if r["theme"] == t]
    n = lambda s: sum(1 for r in mine if r["status"].strip().lower() == s)
    print(f"{t}: {len(search[t])} words searched · {n('suggested')} suggested, {n('confirmed')} confirmed, {n('rejected')} rejected"
          f" · {sum(1 for w in words if w['theme'] == t and w['use'] == 'maybe')} related words awaiting review")
print(f"Review {SUGGESTIONS.name} (and {WORDS.name}), then rebuild the maps.")
