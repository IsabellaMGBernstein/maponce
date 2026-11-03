// The letters and places, read from the files the Python build in ../Maponce_Data already makes.
//   map_corrected/cartas_map_data.json   places (with coordinates) and one record per letter (route, dates, names)
//   map/recipient_bios.csv               biographies, written by hand
//   map/themes.csv, theme_words.csv,     themes and their words, and the review sheet of suggested themes;
//   map/letter_themes.csv                only rows marked "confirmed" are used
//   corrected/cartas_letters_revised.csv the full letter texts (for the transcripts on the themes map)
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

const DATA = new URL("../../../Maponce_Data/", import.meta.url);
const read = (path) => readFile(new URL(path, DATA), "utf8");
const csv = async (path) => {
  try { return parse(await read(path), { columns: true, bom: true, skip_empty_lines: true }); }
  catch (e) { if (e.code === "ENOENT") return []; throw e; }
};

export default async function () {
  const { places, letters } = JSON.parse(await read("map_corrected/cartas_map_data.json"));

  const bios = Object.fromEntries((await csv("map/recipient_bios.csv"))
    .filter((r) => r.biography && r.biography.trim())
    .map((r) => [r.recipient, r.biography.trim()]));

  const themeRows = (await csv("map/themes.csv")).filter((r) => r.theme && r.theme.trim());
  const words = await csv("map/theme_words.csv");
  const marks = await csv("map/letter_themes.csv");
  const status = (r) => (r.status || "").trim().toLowerCase();
  const themes = {
    list: themeRows.map((t) => ({
      name: t.theme.trim(),
      description: (t.description || "").trim(),
      words: words.filter((w) => w.theme === t.theme && (w.use || "").trim().toLowerCase() === "yes").map((w) => w.word),
      pending: marks.filter((m) => m.theme === t.theme && status(m) === "suggested").length,
    })),
    letters: {},   // letter number -> its confirmed themes
  };
  for (const m of marks) {
    if (status(m) === "confirmed" && themeRows.some((t) => t.theme === m.theme)) (themes.letters[m.letter] ||= []).push(m.theme);
  }

  const texts = Object.fromEntries((await csv("corrected/cartas_letters_revised.csv")).map((r) => [r.letter_number, r.text_reading || ""]));

  return { places, letters, bios, themes, texts };
}
