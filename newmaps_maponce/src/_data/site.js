// The maps that use the shared layout (src/_includes/base.njk), and the regions of the Regions map.
// The Routes map (/) and the Years map (/years/) are separate: src/index.njk + src/routes/, src/years.njk + src/years/.
export default {
  title: "Mapping Mariano Ponce's Letters",
  maps: [
    { key: "correspondents", title: "Correspondents", url: "/correspondents/" },
    { key: "themes",         title: "Themes",         url: "/themes/" },
    { key: "regions",        title: "Regions",        url: "/regions/" },
  ],
  // Each region lists its destinations with their country in the 1890s.
  // view = [[south, west], [north, east]]. The maps put the Americas east of Asia (longitude + 360),
  // so North America's view uses 240-296 for 120°W-64°W.
  regions: [
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
  ],
};
