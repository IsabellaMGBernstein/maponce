// /years/data.json: the places and letters for the Years map, read straight from the file the Python build
// makes (../Maponce_Data/map_corrected/cartas_map_data.json). Independent of the other maps' data.
import { readFile } from "node:fs/promises";
export const data = { permalink: "/years/data.json", eleventyExcludeFromCollections: true };
export async function render() {
  const { places, letters } = JSON.parse(await readFile(new URL("../../../Maponce_Data/map_corrected/cartas_map_data.json", import.meta.url), "utf8"));
  return JSON.stringify({ places, letters });
}
