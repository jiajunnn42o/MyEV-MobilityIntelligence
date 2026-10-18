# MyEV — Design System v1

## Visual principle
Premium automotive intelligence: editorial typography, ample whitespace, crisp data visualization, restrained electric lime. No left sidebar.

## Font
Inter (only Medium **500** and SemiBold **600**). Heading tracking -0.06 to -0.08em; navigation approx 12–14px; data values tabular lining. Google Fonts is loaded at runtime; users without network fall back to the browser sans-serif. **No font files are bundled.**

## Colors
| Token | Light | Dark |
|---|---|---|
| canvas | `#F5F5F3` | `#191B1A` |
| surface | `#FFFFFF` | `#232625` |
| soft surface | `#EFEFED` | `#303431` |
| primary text | `#171918` | `#F0F2EC` |
| muted | `#818680` | `#ABB0AA` |
| border | `#E3E4DF` | `#383D39` |
| electric accent | `#ADFA22` | `#B0FF28` |

**Rule:** No dark green surfaces or dark-green UI colors. Black/charcoal/grey replace dark green. Lime is a deliberate signal only, not a default background.

## Navigation
Top, sticky (82px desktop / 65px mobile). Overview, Markets, Geospatial (Geographic Explorer / Charging), Intelligence (Forecasting / Policy / Scenario), Sustainability, Reports. Responsive full-width dropdown, **never a left sidebar**.

## Components
- Section kicker uppercase, 10px Inter 600 with a tiny lime dot
- Editorial page title Inter 600 with close tracking
- Hairline 1px borders, 9–15px radius, nearly invisible shadows
- High-data-density but spacious KPIs with thin separators rather than individual rainbow cards
- Chart background white, grey gridlines, lime EV and slate Hybrid
- Map national outline in grey; lime marks only selected **geographic reference** locations
- Charcoal featured research card with lime forecast trace and visible methodological caveat
- All numbers formatted as tabular-nums

## Page map
1. **Overview** — real KPIs, series, national map preview, forecast, composition, policy
2. **Market Intelligence** — full interactive series, fuel mix, 2025 seasonality heatmap, last 8 months table
3. **Geographic Explorer** — real Malaysia country outline + city reference pins, explicitly missing state metrics
4. **Charging Infrastructure** — infrastructure data integration plan, no invented markers
5. **Forecasting Lab** — actual refit M9 share forecast + conditional 95% interval, methodological notes
6. **Policy Intelligence** — interactive event timeline; event correlation is not causal evidence
7. **Scenario Simulator** — illustrative slider-based What-If prototype, explicitly differentiated from M9
8. **Sustainability** — SDG 7 & 13 aligned research, no invented CO2 savings
9. **Reports** — real CSV export; PDF future work

## Responsive layout
Wide desktop max content width 1560px, two-column charts/maps; 1070px tablet single-column; 740px mobile stacked KPI and menu.

## Next development
Phase 2: JPJ state transactions, DOSM administrative boundaries, officially sourced EV charger POIs, MapLibre layers, report generator, backend API and model provenance registry.
