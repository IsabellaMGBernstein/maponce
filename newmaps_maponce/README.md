# Ponce maps (Eleventy)

Five interactive maps of Mariano Ponce's letters (1897–1900), built with [Eleventy](https://www.11ty.dev) 3 and [Leaflet](https://leafletjs.com).

| Map | Address | What it shows |
|---|---|---|
| Routes | `/` | every letter as a route from where Ponce sent it (black circle) to its destination (red star) |
| Correspondents | `/correspondents/` | one line per person; pick someone for their biography, letters per year and letters |
| Years | `/years/` | the letters by year, 1897 (light) to 1900 (dark); pick a route or year for everyone written to that year |
| Themes | `/themes/` | the confirmed themes; pick one to read its letters in full |
| Regions | `/regions/` | the letters to Europe, Asia or North America, chosen in the Region menu, with statistics below |

The Routes and Years maps are fully separate: each has its own page (`src/index.njk`, `src/years.njk`) and its own styles, script and data (`src/routes/`, `src/years/`), sharing no code with any other map. Each map is a separate page with no menu linking it to the others (the Regions map has a Region menu at the top left), and a minimizable map key at the lower right.

## Running it

Needs Node.js (installed with `brew install node`). From this folder:

    npm install      # once: installs Eleventy, Leaflet and the rest into node_modules/
    npm start        # builds the site and serves it at http://localhost:8080, rebuilding when files change
    npm run build    # only builds the site into _site/, ready to upload to any static web host

## Where things are

    eleventy.config.js        Eleventy settings
    src/_data/cartas.js       reads the letters from ../Maponce_Data (nothing is copied here)
    src/_data/site.js         the five maps and the three regions (destinations, 1890s countries, map views)
    src/_includes/base.njk    the page layout every map shares
    src/*.njk                 one page per map: its title and introduction
    src/data/*.11ty.js        write the data files the pages load (/data/site.json, /data/texts.json)
    src/assets/css/style.css  the look, light and dark
    src/assets/js/core.js     shared map code: world map, routes, stars, key, popups, side panel
    src/assets/js/<map>.js    what each map draws and lists

The data comes from `../Maponce_Data`: `map_corrected/cartas_map_data.json` (made by `map/build_data.py`),
`map/recipient_bios.csv`, the theme files in `map/`, and `corrected/cartas_letters_revised.csv` for the letter
texts. After editing those, run `npm run build` (or restart `npm start`): the maps update. Edits inside this
folder (`src/`) show up on their own while `npm start` is running. `src/static/countries-50m.json` is a copy of
the Natural Earth borders from `../Maponce_Data/map/`.
