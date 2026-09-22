# Bean There Boston

Bean There Boston helps people explore **where a new cafe could thrive in Boston**. The site combines public neighborhood, business-license, transit, and parking-proxy data into an interactive map, comparison views, rankings, and a transparent methods section.

It is designed for early neighborhood exploration: use it to compare areas, understand tradeoffs, and decide where to visit next. It does not predict profitability, choose a storefront, or replace rent, foot-traffic, zoning, and on-the-ground due diligence.

## What It Includes

- Responsive Vite + React site
- Overview screen with headline, project context, and key dataset counts
- Full-screen Boston map with real OpenStreetMap raster-tile context
- Warm opportunity-score overlay with a readable legend
- Point-layer toggles for food licenses, cafe-like businesses, MBTA bus stops, and MBTA train stops
- Desktop map panels for score controls and selected-neighborhood details
- Mobile map layout with score controls before the map and selected-neighborhood details below it
- Adjustable Cafe Opportunity Score with presets and normalized weights
- Selected-neighborhood score breakdown and tailored interpretation
- Cafe-like business hover details on desktop
- Neighborhood Archetypes, Neighborhood Signal Mix, and Opportunity Gap comparison views
- Searchable ranking table with Excel-style multi-column sorting
- Methods section with metric definitions, public source links, field examples, limitations, and practical next steps
- Floating section navigation for Overview, Map, Compare, Rankings, and Methods
- Reproducible data fetch, build, and validation scripts

## Supporting Files

Supporting analysis and submission files are in `deliverables/`:

- `collected_neighborhood_dataset.csv` — processed neighborhood-level dataset
- `one_page_data_methodology_note.md` — one-page data and methods note
- `five_minute_presentation.md` — five-minute presentation outline and demo flow
- `reflection.md` — short reflection on what the data supports and cannot prove
- `requirement_audit.md` — checklist against the assignment requirements

Published site: https://bean-there-boston.yinuozhao959.chatgpt.site

## Setup

```bash
npm install
npm run prepare:data
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`.

For a production build:

```bash
npm run build
npm run preview
```

## Data Pipeline

The pipeline uses only the Python standard library.

```bash
npm run fetch:data
npm run build:data
npm run validate:data
```

Generated frontend data:

- `public/data/neighborhood_metrics.json`
- `public/data/neighborhood_boundaries.geojson`
- `public/data/map_points.json`
- `public/data/source_manifest.json`

Generated review artifacts:

- `data/processed/neighborhood_metrics.json`
- `data/processed/neighborhood_boundaries.geojson`
- `data/processed/map_points.json`
- `data/processed/build_report.json`
- `data/processed/validation_report.json`

Raw public files are cached in `data/raw/`. The source manifest records the URL used, fetch timestamp, file size, hash, publisher, units, fields, and whether a direct download or fallback endpoint was used.

## Public Sources

The project uses these public sources:

- City of Boston Active Food Establishment Licenses
- BPDA Neighborhood Boundaries
- City of Boston 2025 Population Estimates, Neighborhood Level
- MBTA GTFS stops
- City of Boston Parking Meters

If a direct Boston download is blocked, `scripts/fetch_data.py` falls back to the CKAN datastore API for CSV resources. The neighborhood GeoJSON is fetched from the public BPDA ArcGIS FeatureServer GeoJSON endpoint and recorded in the manifest.

## Methodology

Boston neighborhood boundaries are the canonical geography. Point datasets are assigned to neighborhoods with a point-in-polygon join:

- Active food licenses become broad food-establishment competition.
- Cafe-like businesses are flagged with approximate name/category terms such as coffee, cafe, espresso, tea, bakery, donut, barista, roast, and boba.
- MBTA GTFS stops become transit access and are split into bus-stop and train-stop point layers for the map.
- Active parking meter rows become a short-term parking proxy in the score.

The point sources are also exported to `map_points.json` for exploratory map layers. These layers help users inspect activity inside large neighborhoods, while the official score remains neighborhood-level.

The population estimates provide:

- Population density
- Young adult share
- Student share
- Higher-income household share
- Transit commute share
- Walk commute share

Each score input is min-max normalized from 0 to 100 across Boston neighborhoods. Competition is inverted so lower competition receives a higher component score. Weight sliders are automatically normalized to 100% when the score is calculated.

Default weights:

- Population density: 20%
- Young adult/student demand: 20%
- Higher-income household share: 15%
- Transit access: 20%
- Walk commute share: 10%
- Parking access: 5%
- Low competition: 10%

## Demo Flow

1. Open the overview and frame the decision as choosing promising Boston neighborhoods for cafe site visits.
2. Move to the map and read the warm opportunity-score overlay with the legend.
3. Toggle cafe-like businesses, food licenses, bus stops, and train stops to inspect local activity inside larger neighborhoods.
4. Adjust the score controls or presets to test how different business priorities change the map and rankings.
5. Select a neighborhood to review its score, rank context, indicators, and component breakdown.
6. Use Neighborhood Archetypes to spot different cafe strategy profiles.
7. Use Neighborhood Signal Mix to compare selected neighborhoods across the core metrics.
8. Use Opportunity Gap to find neighborhoods with stronger demand and lighter cafe-like competition.
9. Use the ranking table search and sortable headers for a neighborhood-level drilldown.
10. Review Methods for metric definitions, source links, limitations, and practical next steps.

## Current Validation Notes

Latest local validation produced:

- 26 neighborhoods
- 26 boundary features
- 5 source manifest entries
- No validation errors

Warnings:

- Leather District, Bay Village, and Harbor Islands have zero population in the 2025 neighborhood demographics output used here. They remain visible because they exist in the canonical boundary layer, but their demographic-derived indicators are zero and should be interpreted cautiously.

## Limitations

- No rent, lease availability, foot-traffic, buildout cost, or exact storefront data.
- Food licenses overstate cafe competition because they include many food-service businesses.
- Cafe-like competition is an approximate text match, not a verified business taxonomy.
- Neighborhood averages hide block-by-block differences.
- MBTA stop counts do not measure frequency, reliability, ridership, or crowding.
- Parking meters do not represent all parking supply or curb rules.
- Public datasets may lag real-world openings, closures, and demographic shifts.

Use the map, comparisons, and rankings to choose where to look more closely. Before committing to a location, validate storefront rent, pedestrian counts, nearby anchors, zoning constraints, direct competitor menus and prices, and on-the-ground observations.
