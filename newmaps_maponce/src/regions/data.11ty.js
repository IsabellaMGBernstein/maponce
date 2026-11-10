// /regions/data.json: the places and letters for the Regions map, and the three regions.
// Read straight from ../Maponce_Data/map_corrected/cartas_map_data.json; independent of the other maps' data.
import { readFile } from "node:fs/promises";
export const data = { permalink: "/regions/data.json", eleventyExcludeFromCollections: true };

// Each region lists its destinations with their country in the 1890s.
// view = [[south, west], [north, east]]. The map puts the Americas east of Asia (longitude + 360),
// so North America's view uses 240-296 for 120°W-64°W.
export const REGIONS = [
  { key: "europe", name: "Europe",
    places: { "Leitmeritz (Litoměřice)": "Austria-Hungary (Bohemia)", "Paris": "France",
              "Madrid": "Spain", "Barcelona": "Spain", "Sant Climent de Llobregat": "Spain",
              "Vilanova i la Geltrú": "Spain", "Zaragoza": "Spain",
              "Berlin": "Germany", "Dresden": "Germany", "Haarlem": "Netherlands" },
    view: [[36, -10], [55.5, 20]] },
  { key: "asia", name: "Asia",
    places: { "Hong Kong": "Hong Kong (British)", "Macau": "Macao (Portuguese)", "Shanghai": "China (Qing)",
              "Singapore": "Straits Settlements (British)",
              "Tokyo": "Japan", "Yokohama": "Japan", "Osaka": "Japan", "Nagahama": "Japan",
              "Manila": "Philippines", "Malolos": "Philippines", "Tarlac": "Philippines" },
    view: [[-8, 92], [44, 150]] },
  { key: "north-america", name: "North America",
    places: { "New Orleans": "United States", "Washington, D.C.": "United States", "Philadelphia": "United States",
              "Montreal": "Canada", "Mexico City": "Mexico" },
    view: [[10, 240], [54, 296]] },
];

export async function render() {
  const { places, letters } = JSON.parse(await readFile(new URL("../../../Maponce_Data/map_corrected/cartas_map_data.json", import.meta.url), "utf8"));
  return JSON.stringify({ places, letters, regions: REGIONS });
}
