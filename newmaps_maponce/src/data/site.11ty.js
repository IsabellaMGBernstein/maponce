// /data/site.json: everything the maps need except the letter texts.
export const data = { permalink: "/data/site.json", eleventyExcludeFromCollections: true };
export function render({ cartas, site }) {
  const { places, letters, bios, themes } = cartas;
  return JSON.stringify({ places, letters, bios, themes, regions: site.regions });
}
