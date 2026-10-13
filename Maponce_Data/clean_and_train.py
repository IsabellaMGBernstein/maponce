"""
Clean "Cartas sobre la revolución" (OCR text) and train a Word2Vec model.

Run from Terminal (with your .venv active):
    python clean_and_train.py
"""
import re
from pathlib import Path
from gensim.models import Word2Vec

# ---------------------------------------------------------------- settings
dirpath = Path(__file__).resolve().parent          # the folder this script is in
input_file = dirpath / "Cartas_sobre_la_revolucion.txt"
cleaned_file = dirpath / "Cartas_cleaned.txt"      # cleaned text, one sentence per line
model_file = dirpath / "cartas_word2vec.model"

# Fix OCR errors you care about here ("wrong": "right").
# Cleaning removes accents and turns ñ into n (the OCR drops them inconsistently),
# so write both sides WITHOUT accents or ñ: españa -> "espana".
# The ñ is often misread as "fi" or "ni" (espafia, espania); add words as you find them.
CORRECTIONS = {
    "espafia": "espana",
    "espania": "espana",
    "espanfa": "espana",
    "espafiol": "espanol",
    "espaniol": "espanol",
    "espafiola": "espanola",
    "espaniola": "espanola",
    "espafioles": "espanoles",
    "espanioles": "espanoles",
    "espafoles": "espanoles",
    "espafiolas": "espanolas",
    "campafia": "campana",
    "pequefio": "pequeno",
    "pequefia": "pequena",
    "pequefias": "pequenas",
    "sefior": "senor",
    "sefiores": "senores",
    "compafiero": "companero",
    "compafieros": "companeros",
    "afio": "ano",
    "afios": "anos",
}

# ---------------------------------------------------------------- 1. read
text = input_file.read_text(encoding="utf-8")
print(f"Read {len(text):,} characters from {input_file.name}")

# ---------------------------------------------------------------- 2. clean
def clean_text(text):
    # Split on the page labels and drop the unnumbered pages
    # (library covers, preservation notes, blank sheets).
    parts = re.split(r"^(===== Page .*? =====)$", text, flags=re.MULTILINE)
    kept = []
    for label, body in zip(parts[1::2], parts[2::2]):
        if "[unnumbered]" not in label:
            kept.append(body)
    text = "\n".join(kept)

    # Rejoin words hyphenated across line breaks: "es-\npañoles" -> "españoles"
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)

    text = text.lower()

    # The OCR is inconsistent with accents ("revolucion", "revoluci6n",
    # "revolucio'n", "revolución"), so remove accents and ñ everywhere and
    # repair the common misreadings. All four become "revolucion".
    text = re.sub(r"(?<=[a-z])6(?=[a-z]|\b)", "o", text)   # "6" misread for "ó"
    text = re.sub(r"(?<=[a-z])'(?=[a-z])", "", text)        # "revolucio'n" -> "revolucion"
    text = text.translate(str.maketrans("áéíóúàèìòùüñ", "aeiouaeiouun"))

    # Word-level OCR corrections
    for wrong, right in CORRECTIONS.items():
        text = re.sub(r"\b" + wrong + r"\b", right, text)

    return text


def to_sentences(text):
    """Split into sentences, each a list of words (the format Word2Vec needs)."""
    sentences = []
    for chunk in re.split(r"[.!?;:]+|\n\s*\n", text):
        words = re.findall(r"[a-z]+", chunk)          # letters only
        words = [w for w in words if len(w) > 1 or w in ("a", "y", "o", "e", "u")]
        if len(words) >= 3:
            sentences.append(words)
    return sentences


cleaned = clean_text(text)
sentences = to_sentences(cleaned)
n_words = sum(len(s) for s in sentences)
print(f"Cleaned into {len(sentences):,} sentences / {n_words:,} words")
print("Sample:", " ".join(sentences[len(sentences) // 2]))

# Save the cleaned text so you can inspect it
cleaned_file.write_text("\n".join(" ".join(s) for s in sentences), encoding="utf-8")
print(f"Saved cleaned text to {cleaned_file.name}")

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
print(f"Trained model: {len(model.wv):,} words in vocabulary. Saved to {model_file.name}")

# ---------------------------------------------------------------- 4. try it
for word in ["revolucion", "filipinas", "espana", "rizal", "independencia"]:
    if word in model.wv:
        similar = ", ".join(w for w, _ in model.wv.most_similar(word, topn=8))
        print(f"{word:>14}: {similar}")
    else:
        print(f"{word:>14}: (not in vocabulary)")
