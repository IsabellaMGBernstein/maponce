// /recipients/data.json: everything the Recipients map needs, read straight from ../Maponce_Data.
// Independent of the other maps' data.
//   map_corrected/cartas_map_data.json  places and letters (made by map/build_data.py)
//   map/recipient_bios.csv              biographies, written by the author
//   map/letter_themes.csv               theme review sheet: only rows marked "confirmed" are used
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

const DATA = new URL("../../../Maponce_Data/", import.meta.url);
const csv = async (path) => {
  try { return parse(await readFile(new URL(path, DATA), "utf8"), { columns: true, bom: true, skip_empty_lines: true }); }
  catch (e) { if (e.code === "ENOENT") return []; throw e; }
};
export const data = { permalink: "/recipients/data.json", eleventyExcludeFromCollections: true };

export async function render() {
  const { places, letters } = JSON.parse(await readFile(new URL("map_corrected/cartas_map_data.json", DATA), "utf8"));
  const bios = Object.fromEntries((await csv("map/recipient_bios.csv"))
    .filter((r) => (r.biography || "").trim()).map((r) => [r.recipient, r.biography.trim()]));
  const themes = {};   // letter number -> its confirmed themes
  for (const m of await csv("map/letter_themes.csv"))
    if ((m.status || "").trim().toLowerCase() === "confirmed") (themes[m.letter] ||= []).push(m.theme);
  return JSON.stringify({ places, letters, bios, themes });
}
