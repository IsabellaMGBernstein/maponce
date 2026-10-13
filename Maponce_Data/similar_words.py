"""
Find the most similar words with the corrected Word2Vec model.

Usage (in Terminal, from Maponce_Data, with your .venv active):
    python similar_words.py independencia          -> 10 most similar words
    python similar_words.py independencia 20       -> 20 most similar words
    python similar_words.py                        -> asks you for words, one after another
Accents and capitals are handled for you: "España" is looked up as "espana".
"""
import difflib
import sys
import unicodedata
from gensim.models import Word2Vec

MODEL = "word2vec_corrected/cartas_word2vec_corrected.model"
model = Word2Vec.load(MODEL)


def normalize(word):
    word = word.strip().lower()
    return "".join(c for c in unicodedata.normalize("NFD", word) if unicodedata.category(c) != "Mn")


def show(word, n=10):
    w = normalize(word)
    if w not in model.wv:
        close = difflib.get_close_matches(w, model.wv.index_to_key, n=5)
        print(f'"{word}" is not in the model.' + (f" Did you mean: {', '.join(close)}?" if close else ""))
        return
    print(f"\nMost similar to '{w}':")
    for rank, (other, score) in enumerate(model.wv.most_similar(w, topn=n), 1):
        print(f"{rank:3}. {other:20} {score:.3f}")
    print()


if len(sys.argv) > 1:
    show(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10)
else:
    print(f"Loaded {MODEL} ({len(model.wv):,} words). Type a word, or press Return to quit.")
    while True:
        word = input("word> ")
        if not word.strip():
            break
        show(word)
