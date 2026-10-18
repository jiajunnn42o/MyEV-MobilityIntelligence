# MyEV — Malaysia Electric Mobility Intelligence

Premium visual design prototype (React + Vite). Top horizontal navigation, Inter 500/600, monochrome palette with electric-lime accents, responsive desktop/mobile, native SVG charts and a Malaysia national map.

## Start

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (normally http://localhost:5173).

## Content

- Overview: real JPJ car KPIs, interactive time-series chart, map, forecast & policy cards
- Market Intelligence: shares, volumes, fuel mix, seasonal heatmap, data table
- Geographic Explorer: Natural Earth outline + true city reference points; **no invented state metrics**
- Charging Infrastructure: honest integration-state screen, no fictional POIs
- Forecasting Lab: fitted M9 Logistic Ceiling + AR(1) forecast from supplied CSV to Dec 2030
- Policy Intelligence: interactive event timeline (descriptive; not a causal finding)
- Scenario Studio: labeled demonstration simulator, not the validated M9 model
- SDG Center: measured adoption indicators and requirements for credible CO₂ analysis
- Reports: working CSV export of the real market series

## Design

Color tokens in `src/styles.css`; use charcoal/grey rather than dark green. Inter Medium 500 and SemiBold 600 only. Light/dark toggle. No left sidebar.

## Data and cautions

- `src/data/market.json`: derived from the user-supplied `registrations_type_fuel(1).csv`, passenger **car** rows, Jan 2022–Aug 2026.
- `src/data/map.json`: Malaysia country outlines from bundled Natural Earth low-res shape and city reference coordinates. This is **not** a state adoption choropleth.
- The model is refit according to the relevant structure in the user's Assignment notebook (Logistic + AR(1) residuals). Conditional intervals are not all-sources-of-uncertainty bounds.
- `build_data.py` can be rerun to regenerate JSON where compatible Python packages and source CSV are available.
- No live APIs and no real EV charging station list are connected in this design release.

## Future integration

Add official JPJ state transaction data, DOSM administrative-1 GeoJSON, licensed charger POI data, API backend and durable model registry; then implement verified regional data layers.


## v2 Map and icon improvements
- Fixed the giant information icon: the earlier `.malaysia-map svg` selector scaled every nested SVG to 100%; the rule is now scoped to the map graphic only.
- Icons use **Vuesax / Iconsax TwoTone** globally via the official `iconsax` web-component package.
- Geographic Explorer now uses a real pan/zoom **Leaflet** map (CARTO / OpenStreetMap tiles) with five geographic reference pins. Tiles require an internet connection.
- Overview keeps a styled local vector preview and zoom controls, so it remains useful offline.
- State-level EV statistics have not been invented; state choropleth requires additional data.

Install new dependencies using `npm install` after extracting, then `npm run dev`.
