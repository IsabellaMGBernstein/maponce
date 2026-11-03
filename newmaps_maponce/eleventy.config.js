// Eleventy settings for the five Ponce maps.
// Pages and templates are in src/; the finished site is written to _site/.
// The letter data is read from ../Maponce_Data (see src/_data/), so this folder holds no copy of it.
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
    "src/routes/routes.css": "routes/routes.css",   // the Routes map's own files
    "src/routes/routes.js": "routes/routes.js",
    "src/years/years.css": "years/years.css",       // the Years map's own files
    "src/years/years.js": "years/years.js",
    "node_modules/leaflet/dist/leaflet.js": "vendor/leaflet/leaflet.js",
    "node_modules/leaflet/dist/leaflet.css": "vendor/leaflet/leaflet.css",
    "node_modules/topojson-client/dist/topojson-client.min.js": "vendor/topojson-client.min.js",
    "src/static/countries-50m.json": "data/countries-50m.json",   // Natural Earth borders (a copy of ../Maponce_Data/map/countries-50m.json)
  });
  eleventyConfig.addWatchTarget("src/routes/");   // the Routes map's own styles and script
  eleventyConfig.addWatchTarget("src/years/");    // the Years map's own styles and script
  // Nothing outside this folder is watched or copied: that makes Eleventy misread the paths of changed pages
  // and rebuild stale copies. The letter data is still read from ../Maponce_Data at build time; after editing
  // it, run `npm run build` (or restart `npm start`).
  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk", "11ty.js"],
    htmlTemplateEngine: "njk",
  };
}
