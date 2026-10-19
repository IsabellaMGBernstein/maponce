# Mapping Mariano Ponce’s Letters: A Cartography of the Philippine Revolution

This digital humanities project centers on the creation of an interactive world map and website that shows the correspondence of 19<sup>th</sup> century politician and revolutionary Mariano Ponce during the Hong Kong Junta, the Philippine revolutionary government in exile. In total, there are 244 letters. This project is intended to serve as a pedagogical tool. Using leaflet and CARTO, the interactive map will have a variety of functionalities, which I will break down below:

This project asks the following questions:

1. With whom did Mariano Ponce build a network to further the Philippine revolutionary cause? Is there a commonality between all 70 recipients?

2. To what locations did Ponce most frequently send his correspondence? Did these regions correspond with areas that the *ilustrados* (the educated mestizo and criollo elite in the Philippines) traveled/visited/studied?

3. What themes are most prevalent in his letters? Does he write about certain themes to some correspondents/recipients and not to others? Or to some areas and not to others?

> <u>These questions culminate in one general question: According to Mariano Ponce, what is the Philippine nation? How does he represent the transformation from colony to sovereign nation in his letters?</u>

## Basic Design

Each map will showcase a world map that allows users to zoom in and out. Users can click on each path/route. When selected, the path/route will be highlighted in green, and the other paths will be greyed out. There will be a key in the lower right-hand corner that users can minimize or maximize. The location from which Ponce sends each letter will be marked using a black circle. The destination will be marked using a red star. The key will show this aforementioned information. In the upper left-hand corner, there will be a drop-down menu to select which map visualization users would like to consult. There will be six maps classified by recipient biography (1), year (1), theme (1), and geographic region (3: Asia, Europe, and North America).

## Visualization by recipient

The map will showcase the location where Ponce sent each letter and the destination of its recipient. There are 70 recipients. Each line on the map will be color coded to correspond with the recipient of the letter. For example, all letters to Blumentritt will be assigned the color red. All letters to Aguinaldo will be assigned blue. When you click on each path, a biography for each recipient, which I will craft manually using my own research, will appear. In addition to the key mentioned above, there will be a side-bar on the right-hand side of the map that showcases statistics like how many letters each person received as well as common themes in the letters sent to that person. I will use word embeddings using word2vec to extract common themes. Users will also be able to see statistics like how many letters were sent to a certain correspondent in 1897, 1898, 1899, and 1900 respectively.

## Visualization by year

The map will contain all the routes of the letters color-coded by year. 1897 will be red. 1898 will be blue. 1899 will be purple. 1900 will be orange. There will be an additional key alongside the basic key that indicates which color is each year. When you select a letter that was sent in 1897, for example, there will be a side-bar on the right-hand side of the map that will showcase everyone who he wrote to that year and the top 5 most common themes. I will derive the top 5 most common themes using word (word2vec) or document embedding (doc2vec). No matter what path the user selects, only the year and common themes will appear on the side.

## Visualization by theme

The map will be color coded by theme. Up to 10 common themes will be included. In a table, I will match the letter to the theme after performing word embedding on word2vec. For example, the map will show how many times “revolution,” “sovereignty,” or “liberalism” are used. There will be an additional key alongside the basic key that indicates which color is each theme. This visualization by theme feature will also include common figures that Ponce references. Once a theme is selected, the side-bar will show all the letters, the transcript of each letter in its entirety (which one will be able to see when the user clicks on the item to expand it), the date, and the recipient.

## Visualization by geographic region

The goal of this map is to focus on areas to which Ponce commonly sent letters: Europe (Spain, France, Germany), Asia (Singapore, Japan, Macao, Philippines), and North America (New Orleans, Washington DC, Montreal, Mexico). There will be a total of three maps to correspond with the three regions. Each map will isolate the region and only show the letters sent there. The basic key will remain but there will be a drop-down menu at the top left of the map to select the region. There will be a bar at the bottom to show statistics like letters per region and recipients in the region.

## General page

There will be a general page that explains Mariano Ponce’s life and contributions in addition to context on the Philippine revolution and Hong Kong junta.

## Project reference

Everything above describes the planned site. This section records what exists in the folder today.

### Source

Mariano Ponce, *Cartas sobre la revolución, 1897-1900* (Manila: Bureau of Printing, 1932), from the University of Michigan Library Digital Collections, item afj2286.0001.001. The letters are in Spanish. The page scans are in `Maponce_Data/cartas-images/` (`page_001.jpg` to `page_520.jpg`, plus the PDF).

### Folder layout

| Path | What it is |
|---|---|
| `Maponce_Data/ocr/` | Raw Tesseract OCR of the book and the first letter table (`cartas_letters.csv` / `.json`). Read only: never edit by hand. See `README_OCR.md`. |
| `Maponce_Data/corrected/` | Corrected data, the rules and logs behind every correction, and the scripts that rebuild it. See `README.md` there for conventions. |
| `Maponce_Data/corrected/cartas_letters_revised.csv` | **The main table.** 244 rows, one per letter, with corrected names, places, dates and letter text. Use this for the map and for text analysis. |
| `Maponce_Data/corrected/cartas_biographical.csv` | One row per letter with only sender, recipient, places and dates (no letter text). |
| `Maponce_Data/map/` | Map builder: `build_data.py`, `template.html` (Leaflet 1.9.4) and `countries-50m.json` (Natural Earth country borders, embedded into the map at build time). The outputs in this folder are from the older, uncorrected data. |
| `Maponce_Data/map_corrected/` | Current map built from the corrected table: `cartas_map.html`, `cartas_map_data.json`, `cartas_links.csv`. |
| `Maponce_Data/word2vec_corrected/` | Word2Vec model trained on the corrected letter texts, its cleaned text and its training script. |
| `Maponce_Data/similar_words.py` | Looks up the most similar words in the corrected model. |
| `Maponce_Data/clean_and_train.py`, `cartas_word2vec.model`, `Cartas_cleaned.txt`, `Cartas_sobre_la_revolucion.txt` | Older model trained on the library's own OCR text. Superseded by `word2vec_corrected/`. |
| `cartas_letters_lowercase.csv`, `cartas_letters_editedcsv.numbers` | Earlier hand-edited copies of the raw letter table. Not used by any script. |
| `spa.traineddata` | Tesseract's Spanish language data, used for the OCR. |
| `.venv/` (Python 3.8), `.venv-1/` (Python 3.9, with Jupyter) | Virtual environments. Both have gensim and pandas. Neither has Pillow, which `corrected/crop_checks.py` needs. |

### Commands

Run these from `Maponce_Data/` with a virtual environment active (`source ../.venv/bin/activate`).

    # rebuild the corrected data, in this order
    python3 corrected/apply_corrections.py
    python3 corrected/make_text.py
    python3 corrected/make_revised_csv.py
    python3 corrected/make_biographical_csv.py

    # rebuild the map from the corrected table
    python3 map/build_data.py corrected/cartas_letters_revised.csv map_corrected

    # query the Word2Vec model
    python similar_words.py independencia 20

To view the map, open `Maponce_Data/map_corrected/cartas_map.html` in a browser. There is no build step, server, test suite or git repository.

### Data facts

- 244 letters to 70 recipients (`recipient_normalized`). By year: 1897: 37, 1898: 76, 1899: 120, 1900: 11.
- Ponce sent 86 letters from Hong Kong and 158 from Yokohama.
- 160 letters print a destination. The map builder infers 55 more, and 29 have no location.
- The recipients with the most letters are Fernando Blumentritt (39), G. Apacible (34) and A. Vergel de Dios (15).
- Destinations in the data: Hong Kong, Shanghai, Macao, Singapore, Tokyo, Yokohama, Osaka, Nagahama, Manila, Malolos, Tarlac; Leitmeritz (now Litoměřice), Paris, Madrid, Barcelona, Sant Climent de Llobregat, Vilanova i la Geltrú, Zaragoza, Berlin, Dresden, Haarlem; New Orleans, Washington, Montreal, Philadelphia, Mexico City.

### Working conventions

- Fields ending in `_as_printed` record what the 1932 book prints, including its misprints. Do not "fix" them. Real-world identifications go in the `_normalized` fields.
- Make corrections by editing `corrected/rules.csv`, `corrected/manual_corrections.csv` or `corrected/names.csv` and rebuilding, not by editing the output CSVs. Every change must appear in a log.
- Most letters were corrected by rules alone and spot-checked, so the data is not a verified edition. Check quotations against the page images.
- The Word2Vec models strip accents and ñ, so query with `espana` and `revolucion`.
- The map uses no tiles. It draws a flat world map (land, oceans, present-day borders, continent and ocean names). It scrolls sideways across exactly one world, with its edges at 31.5°W in the mid-Atlantic from `map/countries-50m.json` (Natural Earth 1:50m via world-atlas 2.0.2). The borders are modern, not those of 1897-1900.
- The current map has one view. The six visualizations described above are not built yet.
- Recipient biographies and theme assignments are the author's own research. Do not generate them.
