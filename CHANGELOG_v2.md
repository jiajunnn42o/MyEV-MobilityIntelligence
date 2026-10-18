# MyEV v2 — Geographic & Iconsax Correction

## Why the giant grey information icon appeared

The original CSS applied `width:100%; height:100%` to **every** `svg` below `.malaysia-map`, including the tiny information icon. This made the icon fill most of the map card. The corrected rule only targets the map SVG: `.malaysia-map > .malaysia-map-art`.

## What changed

- Kept the **top horizontal navigation**, Inter 500/600 typography, monochrome surfaces and neon green accent.
- Replaced hand-drawn React icons with the **official Vuesax / Iconsax web component library**, using `type="twotone"` throughout.
- Updated the Overview map: refined coastlines/texture, cleaner pin and label treatments, location focus card, zoom in/out and reset, compact unobtrusive source disclaimer.
- Geographic Explorer now features a fully interactive **Leaflet** map using CARTO Minimal and OpenStreetMap street tiles. Markers focus the five real cities, with a location details panel. The page is designed to fall back to local national outline if tile requests fail.
- Did **not** invent state-by-state EV registrations. The uploaded national JPJ CSV has no state field.
- Kept other dashboards, Forecast, Policy, Scenario, SDG and Reports unchanged.

## Run

Extract the ZIP, open the folder containing `package.json`, then:

```powershell
npm install
npm run dev
```

The newly added packages are `iconsax` and `leaflet`; they are downloaded when you run `npm install` on your machine. **Map tiles require an internet connection**; if unavailable, the Geographic page shows a national-outline fallback. The standalone HTML can be opened locally to preview Overview without installing Node.js; it uses local two-tone-style icon fallbacks because the actual Iconsax package is only loaded in React.

## Data / Sources

- JPJ national vehicle-registration dataset: carried over from v1.
- National geographic vector preview: carried over from v1, from Natural Earth outline data.
- Interactive web map: OpenStreetMap contributors and CARTO basemaps, attributions shown on map.
- State metrics: unavailable until a reliable state-coded JPJ dataset is added.

## Current verification status

- Standalone HTML generated and its JavaScript passed `node --check`.
- Fixed selector verified absent from the new CSS.
- Source references and changed files verified.
- Full React build / browser screenshot **not run successfully in this environment** because npm registry access and headless browser navigation are restricted. Run `npm install` and `npm run dev` locally to verify the browser build.
