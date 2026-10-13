# Corrected map data (version 1, October 2026)

This folder holds a corrected copy of the fields the map uses. The raw OCR in `../ocr/` is only
read, never changed. Everything here can be rebuilt with one command, and every change is logged.

## Files

| File | What it is |
|---|---|
| `Cartas_OCR_corrected.txt` | All 244 letters as plain text: heading, editorial summary, corrected dateline and addressee, then the letter text with its salutation, signature and recurring name garbles fixed. Other OCR errors in the running text remain. |
| `text_corrections_log.csv` | Every change made to the letter texts for the plain-text file. |
| `make_text.py` | Rebuilds `Cartas_OCR_corrected.txt` (run after `apply_corrections.py`). |
| `cartas_letters_corrected.csv` | Same 244 rows and columns as `../ocr/cartas_letters.csv`, with the map fields corrected. Three columns are added: `signatory_normalized`, `corrected_fields` (which columns differ from the raw file) and `image_checked` (the page crops used as evidence). |
| `corrections_log.csv` | Every change: letter, field, value before, value after, the rule or evidence, and a note. |
| `rules.csv` | Find-and-replace rules for recurring OCR errors (method 3). Edit or add rows here. |
| `manual_corrections.csv` | One-off corrections, mostly read from the page images (method 1). `__KEEP__` means "checked against the image, no change needed". |
| `names.csv` | One normalized name per correspondent (fills `recipient_normalized`). |
| `image_checks/` | Crops of the page images used as evidence, plus the lists of lines that were cropped. |
| `apply_corrections.py` | Rebuilds the corrected CSV and the log. Standard library only. |
| `crop_checks.py` | Crops lines from the page images using the word boxes in `../ocr/pages/*.tsv` (needs Pillow). |

To rebuild after editing a rule or a correction, run from the `Maponce_Data` folder:

    python3 corrected/apply_corrections.py
    python3 corrected/make_text.py

## Fields corrected

`recipient_as_printed`, `recipient_index_form`, `recipient_normalized`, `signatory_as_printed`,
`place_date_as_printed`, `place_as_printed`, `date_iso`, `addressee_block`, the five
`destination_*` fields and `review_flags`. The letter texts, summaries and key ideas are untouched.

## Conventions

- **As printed.** The `*_as_printed` and `addressee_block` fields record what the 1932 book prints, including its own
  spellings and misprints: *Novienbre* (letter 101), *Brenton* for Brinton (119), *Soler* for Seler (93),
  *Suplicada á D. Clemente de Llobregat* (95, 103). Real-world identifications go in `recipient_normalized`, with a note in `names.csv`.
- **Small capitals.** Names set in small capitals (BLUMENTRITT, APACIBLE) are written in normal capitalisation (Blumentritt, Apacible).
- **Superscripts.** Ordinal and abbreviation superscripts are kept: *1.º de Marzo*, *Febº.*, *Novᵉ.*
- **Miyokoji / Miyokojí.** The book prints both forms in different letters. Garbled OCR forms were corrected only where they
  could be resolved; the accent elsewhere is as the OCR read it and is not fully reliable (letter 159 has it in print but not in the OCR).
- **Normalized names.** One form per person, taken from the fullest version printed in the book
  (e.g. *Fernando Blumentritt*, *G. Apacible*). Letters to two or three people list them separated by `; `.

## What was done

1. **Rules (method 3).** 132 rules fix recurring errors: small-capital names (BLumeNTRITT, AraciBLE, Licmauco…),
   split words (*Y ama*, *Hon gkong*), stray marks and ordinals.
2. **Image checks (method 1).** 66 letters were checked against the page images: all 15 letters whose dateline disagreed
   with `date_iso`, plus headings, signatures and addressee blocks the rules could not settle.
   All 18 checked dates were already right in `date_iso`; the datelines themselves are now corrected.
3. **Random sample.** 8 addressee blocks corrected only by rules were checked against the images. 7 were right; one rule
   (*Lower Castle, Terrace*, which really is printed with a comma) was wrong and was removed.

## Findings worth knowing

- Letter 17 is signed *Vale.* (a closing word), not a name; letter 25 is signed *Naning* (the OCR had taken *Tunis* from the postscript);
  letters 23 and 45 are signed *P. Mario*.
- Letter 23 is to three people: D. M. Español, D. M. Reyes and D. F. Consunji.
- Nine more letters now have a printed destination (160 in all, up from 151): letters 26, 55, 71, 103, 119, 147, 160, 222 and 227.
- Letter 119 is addressed only to "Pennsylvania"; it is placed at Philadelphia, where Brinton lived. Verify before publishing.
- Letter 103 reads "Suplicada á D. Clemente de Llobregat" and is placed at Sant Climent de Llobregat like letters 147 and 227. Verify.

## Not yet checked

Most of the 244 letters were corrected by rules alone. The rules were spot-checked, not proven on every letter, so
treat names and datelines as much better than the raw OCR rather than as a verified edition. `corrections_log.csv`
shows exactly which letters each rule touched.

## Revised CSV (version 2, October 2026)

`cartas_letters_revised.csv` is the most complete table: everything in `cartas_letters_corrected.csv`
(corrected map fields) plus the letter texts taken from `Cartas_OCR_corrected.txt`.

- `salutation` and `text_reading` now come from the corrected text (salutations, signatures and recurring
  name garbles fixed). `text_reading` joins end-of-line hyphenation; paragraphs are kept.
- New column `text_diplomatic`: the same corrected text with the printed line breaks.
- New column `text_source`: where the text came from.
- Letters 55, 117 and 244 had addressee lines or page stains inside the text; these were fixed against
  the page images and logged in `revised_csv_log.csv`. Letter 117 now has its addressee (*I. Hirata, Esq.,*),
  and letter 244 its signature (*R. Samper.*).
- `editorial_summary` and `key_ideas` are unchanged.

To rebuild (from `Maponce_Data`, after the two commands above):

    python3 corrected/make_revised_csv.py

## Correspondence table (October 2026)

`cartas_biographical.csv`: one row per letter with only the correspondence details. It is built from
`cartas_letters_revised.csv` by `make_biographical_csv.py` and has no letter text, summaries or key ideas.

- **Date:** `date`, `date_as_printed`.
- **Sender:** `sender` and `signed_as`. The sender is Mariano Ponce, with co-signers added (F. Lichauco, F. Rivero).
  `signed_as` is the signature line as printed, which can be a nickname or pen name such as Naning, Kalipulako,
  R. Samper or P. Mario.
- **Sent from:** `sent_from`, `sent_from_as_printed`, lat/lon and basis.
- **Recipient:** `recipient`, `recipient_as_printed`.
- **Recipient's location:** `recipient_location`, `recipient_location_as_printed`, lat/lon and basis. This is blank
  where the letter prints no address.
- **Source:** `printed_pages`, `source_images`.

Rebuild: `python3 corrected/make_biographical_csv.py` (from `Maponce_Data`).
