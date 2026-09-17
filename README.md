# Bean There Boston

Decision-support prototype for the question: **Where should you open a new cafe in Boston?**

This is a class-project site that compares Boston neighborhoods using public, neighborhood-level data. It is meant to help a small-business owner or student analyst choose neighborhoods for deeper site visits. It does **not** predict profitability, recommend a specific storefront, or use paid/private/sensitive data.

## What It Includes

- Responsive Vite + React site
- Interactive Boston neighborhood choropleth map
- Adjustable Cafe Opportunity Score with presets
- Top recommendations that update as weights change
- Ranking table with sorting and search
- Component comparison chart for 2-4 neighborhoods
- Demand-vs-competition scatter plot
- Sources, methodology, assumptions, and limitations
- Reproducible data fetch, build, and validation scripts

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
- `public/data/source_manifest.json`

Generated review artifacts:

- `data/processed/neighborhood_metrics.json`
- `data/processed/neighborhood_boundaries.geojson`
- `data/processed/build_report.json`
- `data/processed/validation_report.json`

Raw public files are cached in `data/raw/`. The source manifest records the URL used, fetch timestamp, file size, hash, publisher, units, fields, and whether a direct download or fallback endpoint was used.

## Public Sources

The project uses the PRD-listed public sources:

- City of Boston Active Food Establishment Licenses
- BPDA Neighborhood Boundaries
- City of Boston 2025 Population Estimates, Neighborhood Level
- MBTA GTFS stops
- City of Boston Parking Meters

If a direct Boston download is blocked, `scripts/fetch_data.py` falls back to the CKAN datastore API for CSV resources. The neighborhood GeoJSON direct download returned `403` during implementation, so the script uses the public BPDA ArcGIS FeatureServer GeoJSON endpoint and records that in the manifest.

## Methodology

Boston neighborhood boundaries are the canonical geography. Point datasets are assigned to neighborhoods with a point-in-polygon join:

- Active food licenses become broad food-establishment competition.
- Cafe-like businesses are flagged with approximate name/category terms such as coffee, cafe, espresso, tea, bakery, donut, barista, roast, and boba.
- MBTA GTFS stops become transit access.
- Active parking meter rows become a short-term parking proxy.

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

1. Open the site and frame the question as early neighborhood screening.
2. Show the map colored by opportunity score.
3. Review the top three recommended neighborhoods and explanation text.
4. Switch to the Student Cafe preset and note how rankings change.
5. Compare two to four neighborhoods in the component chart.
6. Use the table search/sort for a neighborhood-level drilldown.
7. End on the sources and limitations sections.

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

Before signing a lease, collect storefront rent, pedestrian counts, nearby anchors, zoning constraints, direct competitor menus/prices, and on-the-ground observations.
