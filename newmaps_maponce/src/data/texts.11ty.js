// /data/texts.json: the full text of each letter, loaded only by the themes map.
export const data = { permalink: "/data/texts.json", eleventyExcludeFromCollections: true };
export function render({ cartas }) { return JSON.stringify(cartas.texts); }
