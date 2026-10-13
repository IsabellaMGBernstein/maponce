# Mapping Maponce — OCR outputs

Source: Mariano Ponce, *Cartas sobre la revolución, 1897-1900* (Manila: Bureau of Printing, 1932),
UMich Digital Collections afj2286.0001.001. Images: `../cartas-images/page_001.jpg … page_520.jpg`.

## Files

| File | What it is |
|---|---|
| `Cartas_OCR_diplomatic.txt` | The whole book, image by image, with markers such as `===== [image page_200.jpg \| printed p. 162] =====` |
| `cartas_letters.json` | One record per letter (all 244), with metadata plus full text. **This is the file to build the map from.** |
| `cartas_letters.csv` | The same records as a flat table (UTF-8), for Excel, Google Sheets, QGIS, Palladio or StoryMapJS |
| `ocr_corrections_log.csv` | Every automatic correction, with the image, line, before and after |
| `pages/page_NNN.txt`, `.tsv` | Raw Tesseract output for each image. The `.tsv` files have per-word confidence scores and bounding boxes |
| `build_cartas.py` | Rebuilds everything above from `pages/` (`python3 ocr/build_cartas.py`). Standard library only |
| `_to_delete/` | Scratch files left by an interrupted run; safe to delete |

## Transcription conventions (diplomatic)

- Original line breaks, end-of-line hyphenation, spelling, punctuation, capitalisation and accents are
  kept as printed, including period forms such as *á*, *fué*, *dí* and *constituído*.
- The text has had exactly two automatic corrections, both logged:
  1. A free-standing `4` that Tesseract misread for the preposition **á** is changed back to **á**. This is
     skipped in dates, amounts and ranges.
  2. Accents that Tesseract added to *i* are removed. This uses a list curated by reading all 1,398 *í*-words
     in the OCR (e.g. *familía* → *familia*), plus doubled *ií/íi*. Genuine accents are untouched.
- Running heads (`162 CARTAS SOBRE LA REVOLUCIÓN`, `MARIANO PONCE 5`) stay in the .txt file but are removed
  from the letter texts in the JSON/CSV.
- Known limits: words set in SMALL CAPITALS (salutations, some names) often come out garbled or in mixed
  case (`Querino Amico VerGeL` = QUERIDO AMIGO VERGEL). Italic old-style numerals are sometimes misread.
  Pages 1-6 and 517-520 are covers, plates and library leaves (mostly noise). Check quotations against the images.

## Letter record fields (JSON)

- **Identity:** `id`, `letter_number`, `heading`, `recipient_as_printed`, `recipient_index_form` (the name as
  given in the book's table of contents), `signatory_as_printed`.
- **Context:** `part` (the book's four sections: Ponce in Hong Kong / Yokohama / on leave in Hong Kong /
  back in Japan) and `year_section`.
- **Date:** `place_date_as_printed` (the dateline exactly as printed), `place_as_printed`, `date_iso`,
  `date_year`, `date_month`, `date_day`.
- **Origin:** `origin_place_normalized`, `origin_basis`, `origin_lat`, `origin_lon`. Filled for all 244 letters
  from the dateline, or from the book part when the dateline has no city.
- **Destination:** `addressee_block`, `destination_as_printed_guess`, `destination_place_normalized`,
  `destination_basis`, `destination_lat`, `destination_lon`. Filled automatically where the addressee block
  names a recognisable city (about 150 letters). **Verify these.**
- **Ideas:** `editorial_summary` (the 1932 editor's summary under each heading), and `key_ideas` (that summary
  split at each em dash: one idea per item, ready for tags or map pop-ups).
- **Text:** `salutation`, `transmission_notes` (e.g. "Por el v/. 'Empress of India'…"), `text_diplomatic`
  (with line breaks) and `text_reading` (hyphenation joined, for search and NLP).
- **Provenance:** `source_images`, `printed_pages`, `start`, `ocr_mean_confidence`.
- **Needs review:** `review_flags`. Letters whose date was garbled and then read from the image by eye, OCR
  years outside 1897-1900 that were replaced by the index year, letters out of chronological order, and so on.
- **Still blank for you to fill:** `recipient_normalized` (e.g. unify *Blumentritt* / *F. Blumentritt*;
  *Ifortel* is the OCR form of that name).
