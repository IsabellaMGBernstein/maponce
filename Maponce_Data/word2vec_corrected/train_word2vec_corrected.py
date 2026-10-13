"""
Train a Word2Vec model on the CORRECTED letter texts of "Cartas sobre la revolución".

Source : corrected/cartas_letters_revised.csv  (column text_reading, one row per letter)
Output : word2vec_corrected/cartas_corrected.txt      cleaned text, one sentence per line
         word2vec_corrected/cartas_word2vec_corrected.model

Run from Terminal (in the Maponce_Data folder, with your .venv active):
    python train_word2vec_corrected.py

Your old model (cartas_word2vec.model, trained on the library OCR) is not touched.
"""
import csv
import re
import unicodedata
from pathlib import Path
from gensim.models import Word2Vec

# ---------------------------------------------------------------- settings
dirpath = Path(__file__).resolve().parent
input_file = dirpath / "corrected" / "cartas_letters_revised.csv"
outdir = dirpath / "word2vec_corrected"
outdir.mkdir(exist_ok=True)
cleaned_file = outdir / "cartas_corrected.txt"
model_file = outdir / "cartas_word2vec_corrected.model"

# True  = remove accents (España -> espana, revolución -> revolucion), like your old model.
#         Easier to type queries; merges pairs such as el/él, si/sí, mas/más.
# False = keep accents exactly as in the corrected OCR (query with "españa").
STRIP_ACCENTS = True

# Also add each letter's editorial summary (written by the 1932 editor, not Ponce)?
INCLUDE_SUMMARIES = False

# ---------------------------------------------------------------- 1. read
rows = list(csv.DictReader(open(input_file, encoding="utf-8-sig")))
texts = []
for r in rows:
    texts.append(r["text_reading"])
    if INCLUDE_SUMMARIES and r["editorial_summary"]:
        texts.append(r["editorial_summary"])
print(f"Read {len(rows)} letters from {input_file.name}")

# ---------------------------------------------------------------- 2. clean
def clean_text(text):
    text = re.sub(r"\(Contin\w+ en la página \d+\)", " ", text)   # editor's continuation notes
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)            # any hyphenation left
    text = text.lower()
    if STRIP_ACCENTS:
        text = "".join(c for c in unicodedata.normalize("NFD", text)
                       if unicodedata.category(c) != "Mn")          # á->a, ñ->n, ü->u
    return text


def to_sentences(text):
    """Split into sentences, each a list of words (the format Word2Vec needs)."""
    sentences = []
    for chunk in re.split(r"[.!?;:¡¿]+|\n\s*\n", text):
        words = re.findall(r"[a-záéíóúüñ]+", chunk)
        words = [w for w in words if len(w) > 1 or w in ("a", "á", "y", "o", "ó", "e", "é", "u")]
        if len(words) >= 3:
            sentences.append(words)
    return sentences


sentences = []
for t in texts:
    sentences.extend(to_sentences(clean_text(t)))
n_words = sum(len(s) for s in sentences)
print(f"Cleaned into {len(sentences):,} sentences / {n_words:,} words")
cleaned_file.write_text("\n".join(" ".join(s) for s in sentences), encoding="utf-8")
print(f"Saved cleaned text to {cleaned_file.relative_to(dirpath)}")

# ---------------------------------------------------------------- 3. train
model = Word2Vec(
    sentences,
    vector_size=100,   # size of each word vector
    window=5,          # words on each side counted as context
    min_count=3,       # ignore words seen fewer than 3 times (drops most OCR junk)
    sg=1,              # 1 = skip-gram (better for small corpora)
    epochs=20,         # passes over the text; small corpus -> more passes
    workers=4,
    seed=42,
)
model.save(str(model_file))
print(f"Trained model: {len(model.wv):,} words in vocabulary. Saved to {model_file.relative_to(dirpath)}")

# ---------------------------------------------------------------- 4. try it
probe = ["revolucion", "filipinas", "espana", "japon", "independencia", "aguinaldo", "americanos"]
if not STRIP_ACCENTS:
    probe = ["revolución", "filipinas", "españa", "japón", "independencia", "aguinaldo", "americanos"]
for word in probe:
    if word in model.wv:
        similar = ", ".join(w for w, _ in model.wv.most_similar(word, topn=8))
        print(f"{word:>14}: {similar}")
    else:
        print(f"{word:>14}: (not in vocabulary)")
