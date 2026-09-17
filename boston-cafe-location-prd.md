# PRD: Where Should You Open a New Cafe in Boston?

## 1. Product Summary

Build a responsive decision-support site that helps a prospective cafe owner compare Boston neighborhoods for a new cafe location. The site should combine public data on food-establishment competition, population, student/young-adult demand, transit access, parking availability, and income mix into an adjustable "Cafe Opportunity Score."

This is a class-project prototype. It should support neighborhood-level exploration and defensible recommendations, not claim to identify an exact storefront or predict business success.

## 2. Intended User

Primary user: a small-business owner or student analyst deciding which Boston neighborhoods deserve deeper investigation before opening a cafe.

Secondary user: an instructor reviewing whether the project uses public data responsibly, explains methodology, includes interactivity, and discusses limitations.

## 3. Core Problem

Opening a cafe depends on demand, accessibility, and competition. Public datasets can show where Boston has:

- Many potential customers.
- High transit access.
- High student or young-adult presence.
- Enough income to support discretionary purchases.
- Existing commercial activity and parking access.
- Lower density of already-licensed food businesses.

The site should answer:

> Which Boston neighborhoods appear most promising for a new cafe, based on publicly available neighborhood-level indicators?

## 4. Recommended Scope

### In Scope

- Neighborhood-level scoring and comparison.
- Public data fetch/ingestion from downloadable CSV, GeoJSON, GTFS ZIP, or CKAN datastore APIs.
- Cleaning and aggregating point datasets into Boston neighborhood polygons.
- User-adjustable score weights.
- Interactive map, ranking table, comparison chart, and source/limitations sections.
- Static deployed frontend or lightweight full-stack app.

### Out of Scope

- Exact address/site selection.
- Paid real-estate rent data.
- Real foot-traffic data.
- Scraped review data.
- Personally identifiable data.
- Claims of profitability, market validation, or real-estate advice.

## 5. Data Sources

Use these public sources. Prefer the direct CSV/GeoJSON/ZIP endpoints where possible. If direct file download receives a 403 from automated scripts, use the CKAN datastore API endpoint for CSV-like resources or download once manually from the dataset page and commit/cache the raw file with a `source_downloaded_at` note.

### 5.1 Active Food Establishment Licenses

Purpose: proxy for existing food-service competition, including cafes, restaurants, takeout, and similar businesses.

- Dataset page: https://data.boston.gov/dataset/active-food-establishment-licenses
- CKAN resource id: `f1e13724-284d-478c-b8bc-ef042aa5b70b`
- Direct CSV: https://data.boston.gov/dataset/5e4182e3-ba1e-4511-88f8-08a70383e1b6/resource/f1e13724-284d-478c-b8bc-ef042aa5b70b/download/tmpnwx54fxe.csv
- CKAN datastore API: `https://data.boston.gov/api/3/action/datastore_search?resource_id=f1e13724-284d-478c-b8bc-ef042aa5b70b&limit=50000`
- Last modified observed: `2026-09-16T16:36:34`

Fields to use:

- `businessname`
- `dbaname`
- `address`
- `city`
- `state`
- `zip`
- `licstatus`
- `licensecat`
- `descript`
- `license_add_dt_tm`
- `property_id`
- `latitude`
- `longitude`

Cleaning notes:

- Keep records where `licstatus` is `Active`.
- Keep records with valid numeric `latitude` and `longitude`.
- Filter to points inside Boston neighborhood polygons.
- For competition, use all active `Eating & Drinking` food establishments as a broad competitor proxy.
- Optional cafe-specific subfilter: flag names containing terms such as `coffee`, `cafe`, `espresso`, `tea`, `bakery`, `donut`, `barista`, `roast`, `boba`. Label this as an approximate text match.

### 5.2 Boston Neighborhood Boundaries

Purpose: map polygons and neighborhood aggregation geography.

- Dataset page: https://data.boston.gov/dataset/bpda-neighborhood-boundaries
- CKAN resource id: `e5849875-a6f6-4c9c-9d8a-5048b0fbd03e`
- GeoJSON: https://data.boston.gov/dataset/bf1a7b50-4c72-4637-b0fa-11d632e3aff1/resource/e5849875-a6f6-4c9c-9d8a-5048b0fbd03e/download/boston_neighborhood_boundaries.geojson
- CSV: https://data.boston.gov/dataset/bf1a7b50-4c72-4637-b0fa-11d632e3aff1/resource/d45a6d03-2616-4449-9687-0c864ec9f9e4/download/boston_neighborhood_boundaries.csv
- ArcGIS FeatureServer: https://gis.bostonplans.org/hosting/rest/services/Hosted/Boston_Neighborhood_Boundaries/FeatureServer
- Last modified observed: `2026-09-13T14:02:33`

Fields to use:

- Neighborhood name field from the GeoJSON properties. Inspect at ingest time and normalize to `neighborhood`.
- Polygon geometry.
- Area field if available; otherwise calculate area from projected geometry.

Cleaning notes:

- Reproject to a local projected CRS for area/distance calculations, such as EPSG:26986 or EPSG:2249.
- Standardize neighborhood names with trimmed lowercase join keys.
- Use this boundary source as the canonical display geography.

### 5.3 2025 Boston Population Estimates, Neighborhood Level

Purpose: demand, density, student/young-adult concentration, income mix, commute mode.

- Dataset page: https://data.boston.gov/dataset/2025-boston-population-estimates-neighborhood-level
- CKAN resource id: `b0543358-d03f-4682-bf0c-658ea4573d6f`
- Direct CSV: https://data.boston.gov/dataset/d2ece0af-e0ad-42e4-b280-bd0aa1561ed0/resource/b0543358-d03f-4682-bf0c-658ea4573d6f/download/boston_population_estimates_2025_neighborhood_level.csv
- GeoJSON: https://data.boston.gov/dataset/d2ece0af-e0ad-42e4-b280-bd0aa1561ed0/resource/faf18a44-8ba1-4d2b-b5c1-2ec1ebe0142d/download/boston_population_estimates_2025_neighborhood_level.geojson
- CKAN datastore API: `https://data.boston.gov/api/3/action/datastore_search?resource_id=b0543358-d03f-4682-bf0c-658ea4573d6f&limit=50000`
- Data dictionary: https://data.boston.gov/dataset/d2ece0af-e0ad-42e4-b280-bd0aa1561ed0/resource/0c0ff51a-e4a2-4d5d-b165-03f3f5c88d32/download/city-of-boston-demographic-data-dictionary.xlsx
- Last modified observed: `2026-09-13T14:03:08`

Fields to use:

- `name`
- `year`
- `arealand_sqmi`
- `population_b01001_001e` or `population_b03002_001e` for total population.
- `population_b01001_male20_to_24years`
- `population_b01001_female20_to_24years`
- `education_b14002_021e`, `education_b14002_025e`, `education_b14002_045e`, `education_b14002_049e` as college/graduate enrollment proxies after confirming in the data dictionary.
- `income_b19037_001e` and income bracket counts, especially `income_b19037_75k_to_99999`, `income_b19037_100k_to_124999`, `income_b19037_125k_to_149999`, `income_b19037_150k_to_199999`, `income_b19037_200k_plus`.
- `labor_b08301_001e`
- `labor_b08301_010e`, likely public transportation commute count; confirm in dictionary.
- `labor_b08301_019e`, likely walked; confirm in dictionary.

Derived fields:

- `population_density = total_population / arealand_sqmi`
- `young_adult_share = (male20_24 + female20_24) / total_population`
- `student_share = selected_college_enrollment_fields / education_b14002_001e`
- `higher_income_share = households_75k_plus / income_b19037_001e`
- `transit_commute_share = public_transport_commuters / labor_b08301_001e`
- `walk_commute_share = walk_commuters / labor_b08301_001e`

### 5.4 MBTA GTFS Stops

Purpose: transit access proxy using stops and stations per neighborhood.

- MBTA GTFS documentation: https://github.com/mbta/gtfs-documentation/blob/master/reference/gtfs.md
- Official GTFS ZIP: https://cdn.mbta.com/MBTA_GTFS.zip
- Mass.gov transit developer page: https://www.mass.gov/lists/mbta-and-transit-data-for-developers

Files to use:

- `stops.txt`
- Optional: `routes.txt` if distinguishing rapid transit, light rail, bus, commuter rail, or ferry.

Fields to use from `stops.txt`:

- `stop_id`
- `stop_name`
- `stop_lat`
- `stop_lon`
- `location_type`
- `parent_station`
- `municipality`
- `vehicle_type`

Cleaning notes:

- Keep stops where `municipality` is `Boston` or where point falls inside a Boston neighborhood polygon.
- To avoid double-counting station platforms and entrances, create two metrics:
  - `all_stop_count`: all valid stops inside neighborhood.
  - `station_count`: records where `location_type` indicates station/parent location, plus stops with blank `parent_station` depending on GTFS structure. Inspect data before finalizing.
- For the prototype, use `all_stop_count_per_sqmi` as the simple default transit metric.

### 5.5 Parking Meters

Purpose: proxy for short-term parking availability near commercial corridors.

- Dataset page: https://data.boston.gov/dataset/parking-meters
- CKAN resource id: `df6dac6b-e484-470d-8757-6ecae4e04f2a`
- CSV: https://data.boston.gov/dataset/144e2003-ca70-492b-874e-76cc7355e7e3/resource/df6dac6b-e484-470d-8757-6ecae4e04f2a/download/parking_meters.csv
- GeoJSON: https://data.boston.gov/dataset/144e2003-ca70-492b-874e-76cc7355e7e3/resource/9314c461-69c3-452e-82dc-9da9dee486f8/download/parking_meters.geojson
- CKAN datastore API: `https://data.boston.gov/api/3/action/datastore_search?resource_id=df6dac6b-e484-470d-8757-6ecae4f2a&limit=50000`
- Correct API URL with full id: `https://data.boston.gov/api/3/action/datastore_search?resource_id=df6dac6b-e484-470d-8757-6ecae4e04f2a&limit=50000`
- Last modified observed: `2026-09-13T14:11:27`

Fields to use:

- `METER_ID`
- `PAY_POLICY`
- `LONGITUDE`
- `LATITUDE`
- `NUMBEROFSPACES`
- `BASE_RATE`
- `METER_STATE`
- `SPACE_STATE`
- `POINT_X`
- `POINT_Y`

Cleaning notes:

- Keep active meters/spaces where `METER_STATE` is `ACTIVE` or `SPACE_STATE` is `ACTIVE`.
- Use `NUMBEROFSPACES` where present; otherwise count each row as 1 space.
- Spatially join meter points to neighborhoods.

### 5.6 Optional: Food Establishment Inspections

Purpose: optional context only, not a scoring factor unless time allows.

- Dataset page: https://data.boston.gov/dataset/food-establishment-inspections
- CKAN resource id: `4582bec6-2b4f-4f9e-bc55-cbaa73117f4c`
- CSV: https://data.boston.gov/dataset/03693648-2c62-4a2c-a4ec-48de2ee14e18/resource/4582bec6-2b4f-4f9e-bc55-cbaa73117f4c/download/tmp6kmpzf7g.csv

Use only if needed for a "data richness" view. Do not use inspection outcomes as a cafe opportunity factor without careful explanation.

## 6. Data Collection and Refresh Strategy

Create a reproducible data pipeline:

1. `scripts/fetch_data.py`
   - Downloads each source into `data/raw/`.
   - Saves a `data/raw/source_manifest.json` containing URL, fetched timestamp, file size, and SHA-256 hash.
   - Uses CKAN datastore API fallback for CSV resources if direct downloads fail.

2. `scripts/build_dataset.py`
   - Loads raw data.
   - Normalizes field names.
   - Performs spatial joins.
   - Creates `data/processed/neighborhood_metrics.json`.
   - Creates `public/data/neighborhood_metrics.json` and `public/data/neighborhood_boundaries.geojson` for the frontend.

3. `scripts/validate_data.py`
   - Confirms required fields exist.
   - Confirms every displayed neighborhood has a geometry and score inputs.
   - Prints record counts by dataset and warnings for missing values.

The build should work with cached files after the first successful fetch so the classroom demo does not depend on live network access.

## 7. Data Cleaning and Join Strategy

### 7.1 Canonical Geography

Use Boston Neighborhood Boundaries as the canonical geometry for display and aggregation.

Steps:

1. Load boundary GeoJSON with GeoPandas or equivalent.
2. Identify the neighborhood name property.
3. Create `neighborhood_key = lower(trim(name))`.
4. Project geometries to a local CRS for area and point-in-polygon work.
5. Calculate `area_sqmi` if not already reliable.

### 7.2 Point Data Joins

For food licenses, MBTA stops, and parking meters:

1. Parse lat/lon as numeric.
2. Drop records with missing or impossible coordinates.
3. Convert to point geometry in EPSG:4326.
4. Reproject to match neighborhoods.
5. Spatial join points to neighborhoods using `within` or `intersects`.
6. Aggregate counts and rates by neighborhood.

### 7.3 Neighborhood Demographic Join

For the 2025 demographic CSV:

1. Use `name` as the neighborhood field.
2. Create `neighborhood_key = lower(trim(name))`.
3. Join to canonical boundary table by key.
4. Track unmatched names in a validation report.
5. If names differ slightly, use an explicit mapping dictionary committed in code. Do not fuzzy-match silently.

### 7.4 Competition Metrics

Create:

- `food_establishments`: count of active food licenses.
- `food_establishments_per_10k_residents`.
- `food_establishments_per_sqmi`.
- `cafe_like_establishments`: approximate text-match count.
- `cafe_like_per_10k_residents`.

Default score should use broad `food_establishments_per_10k_residents` as the competition penalty. Cafe-like counts are useful to show but should be labeled approximate.

### 7.5 Demand Metrics

Create:

- `population`
- `population_density`
- `young_adult_share`
- `student_share`
- `higher_income_share`
- `transit_commute_share`
- `walk_commute_share`

### 7.6 Access Metrics

Create:

- `mbta_stops`
- `mbta_stops_per_sqmi`
- `parking_spaces`
- `parking_spaces_per_sqmi`

For the first version, do not compute route frequency. Stop density is enough for the prototype.

## 8. Opportunity Score

The Cafe Opportunity Score should be explainable and user-adjustable.

### 8.1 Normalization

For each metric, compute min-max normalized values from 0 to 100:

`normalized = 100 * (value - min) / (max - min)`

For negative metrics such as competition:

`competition_score = 100 - normalized(competition_density)`

Handle equal min/max by assigning 50.

### 8.2 Default Score Formula

Default weights:

- Population density: 20%
- Young adult/student demand: 20%
- Higher-income household share: 15%
- Transit access: 20%
- Walk commute share: 10%
- Parking access: 5%
- Low competition: 10%

Formula:

`opportunity_score = sum(weight_i * normalized_metric_i)`

The UI must let users adjust weights. Weights should automatically re-normalize to 100% if sliders do not sum exactly to 100.

### 8.3 User Personas / Presets

Include three weight presets:

- Student Cafe: more weight on young adults/students, transit, walkability.
- Commuter Grab-and-Go: more weight on transit, population density, workers/commute.
- Neighborhood Cafe: more weight on population, income, lower competition, parking.

## 9. Site Features

### 9.1 Required Views

1. Overview
   - Problem statement.
   - Intended user.
   - Top 3 recommended neighborhoods under current weights.
   - Short explanation of why they rank highly.

2. Interactive Map
   - Choropleth by opportunity score.
   - Hover/click neighborhood tooltip with score and key metrics.
   - Toggle layers or metrics: score, competition, population density, transit access, parking.

3. Ranking Table
   - Neighborhood rows sorted by score.
   - Columns: score, population, population density, food establishments, transit stops, parking spaces, young-adult/student indicator.
   - Search or neighborhood filter.
   - Sortable columns.

4. Comparison Panel
   - Select 2-4 neighborhoods.
   - Bar/radar chart comparing normalized score components.
   - Plain-language explanation of tradeoffs.

5. Weight Controls
   - Sliders for each score component.
   - Preset buttons.
   - Reset button.
   - Display "current weights total" or silently normalize weights.

6. Data and Methods
   - Source table with name, publisher, URL, date accessed, units, and fields.
   - Formula explanation.
   - Cleaning and join explanation.

7. Limitations
   - Missing rent and lease availability.
   - No real foot traffic.
   - Food licenses do not perfectly equal cafe competition.
   - Neighborhood averages hide block-by-block differences.
   - Public datasets may lag real-world openings/closings.
   - Parking meters do not represent all parking availability.
   - Transit stop count does not measure frequency or ridership.

### 9.2 Minimum Visuals

At least three of the following must be implemented:

- Choropleth map of score by neighborhood.
- Ranked bar chart of top neighborhoods.
- Component comparison chart for selected neighborhoods.
- Scatter plot: demand vs competition, sized by transit access.
- Metric cards for top recommendation.
- Sortable table.

Recommended MVP: map, ranking table, component bar chart, top-neighborhood cards.

### 9.3 Filters and Controls

Include:

- Neighborhood multi-select.
- Weight sliders.
- Preset selection.
- Metric selector for map color.
- Toggle to use broad food-establishment competition vs approximate cafe-like competition.

## 10. Technical Architecture

Recommended simple architecture:

- Frontend: Vite + React + TypeScript.
- Mapping: Leaflet or MapLibre GL. Leaflet is simpler for a class prototype.
- Charts: Recharts, Chart.js, or Observable Plot.
- Styling: CSS modules, Tailwind, or plain CSS. Keep responsive layout simple.
- Data pipeline: Python scripts with `pandas`, `geopandas`, `shapely`, `requests`.
- Data output: static JSON/GeoJSON files served by the frontend.

Suggested directory structure:

```text
.
├── README.md
├── package.json
├── scripts/
│   ├── fetch_data.py
│   ├── build_dataset.py
│   └── validate_data.py
├── data/
│   ├── raw/
│   └── processed/
├── public/
│   └── data/
│       ├── neighborhood_boundaries.geojson
│       ├── neighborhood_metrics.json
│       └── source_manifest.json
└── src/
    ├── App.tsx
    ├── components/
    ├── data/
    ├── scoring/
    └── styles/
```

The frontend should be able to run entirely from the processed JSON/GeoJSON files. Avoid a backend unless the project already has one.

## 11. Implementation Plan for Autonomous Coding Agent

### Phase 1: Bootstrap and Data Fetch

1. Create or inspect the project structure.
2. Add Python data scripts and requirements.
3. Fetch all required datasets.
4. Save source manifest with URLs, timestamps, file sizes, and hashes.
5. If direct Boston CSV downloads fail, use CKAN datastore API pagination:
   - Start with `limit=50000`.
   - If needed, paginate with `offset`.

### Phase 2: Build Processed Dataset

1. Load Boston neighborhood GeoJSON.
2. Load demographics and join by neighborhood name.
3. Load active food licenses, filter active records, spatially join to neighborhoods.
4. Load MBTA `stops.txt` from GTFS ZIP and spatially join stops to neighborhoods.
5. Load parking meters, filter active meters/spaces, spatially join to neighborhoods.
6. Compute derived metrics and normalized fields.
7. Write processed data files.
8. Run validation and save a text or JSON validation report.

### Phase 3: Frontend

1. Create responsive app shell.
2. Load processed data from `public/data`.
3. Implement score calculation in frontend so sliders update instantly.
4. Add map colored by selected metric.
5. Add top recommendation cards.
6. Add ranking table.
7. Add comparison chart.
8. Add data/methods/limitations sections.
9. Add responsive mobile layout.

### Phase 4: Verification

1. Run data scripts from a clean checkout.
2. Run frontend build.
3. Start local dev server and inspect the site.
4. Verify:
   - At least three visuals render.
   - Weight sliders change rankings.
   - Map tooltips work.
   - Mobile viewport does not overlap text.
   - Source links work.
   - Limitations section is visible.

## 12. Acceptance Criteria

Data:

- The project fetches or uses cached versions of all required public datasets.
- Source manifest includes exact URLs and fetch timestamps.
- Processed neighborhood metrics include at least 15 Boston neighborhoods.
- Every displayed neighborhood has a score and geometry.
- Validation reports source row counts and unmatched neighborhoods.

Scoring:

- Score uses at least five components.
- User can adjust weights.
- Rankings update when weights change.
- Competition can be interpreted as a penalty.
- Score formula is visible and understandable.

Site:

- Includes a clear problem statement and intended user.
- Includes at least three charts/maps/tables/indicators.
- Includes filters or comparison controls.
- Includes at least two practical recommendations.
- Includes sources, dates, units, and definitions.
- Includes missing data, bias, uncertainty, and limitations.
- Works on desktop and phone.

Technical:

- `npm run build` succeeds.
- Data pipeline can be run with documented commands.
- README explains setup, data sources, and known limitations.
- No sensitive personal data is collected.

## 13. Practical Recommendations the Site Should Generate

The site should generate recommendations dynamically from score results, but the copy should follow this pattern:

1. "Prioritize [Neighborhood] for further site visits because it combines [high demand metric] with [high access metric], while competition is [low/moderate/high]."
2. "Treat [Neighborhood] as a secondary option because it has [strength], but investigate [weakness] before committing."
3. "Do not use the score alone. Before leasing, collect storefront rent, pedestrian counts, nearby anchors, and direct competitor menus/prices."

## 14. Recommended MVP Narrative

The strongest class-project story is:

> We combined Boston public licensing, demographics, transit, and parking data to compare neighborhoods for a new cafe. The model is adjustable because different cafe concepts care about different tradeoffs. A student-focused cafe may prioritize young adults and transit, while a neighborhood cafe may prioritize population, income, parking, and lower competition.

## 15. Known Risks and Mitigations

- Risk: Direct Analyze Boston CSV links may block automated downloads.
  - Mitigation: Use CKAN datastore API or cache raw files with manifest.

- Risk: Neighborhood names may not match perfectly.
  - Mitigation: Use explicit mapping and validation report.

- Risk: Food licenses overstate cafe competition because they include many restaurants.
  - Mitigation: Show broad competition and optional cafe-like text-match mode.

- Risk: Transit stop count does not measure service quality.
  - Mitigation: Label it as access proxy; do not call it ridership or frequency.

- Risk: Score can look falsely authoritative.
  - Mitigation: Show component values, formula, and limitations near recommendations.

## 16. Final Deliverables

- Working responsive site.
- Data fetch/build scripts.
- Processed JSON/GeoJSON used by the site.
- Source manifest.
- Validation report.
- README with setup, methodology, and demo instructions.
- Short in-site sources and limitations section.

## 17. Suggested Demo Flow

1. Open the site and explain the question: where should a new cafe owner investigate first?
2. Show the map colored by opportunity score.
3. Show the top three neighborhoods and why they rank highly.
4. Adjust weights to the "Student Cafe" preset and show ranking changes.
5. Compare two neighborhoods in the comparison chart.
6. Show sources/methods and limitations.
7. End with practical recommendations and next data to collect before a real lease decision.

