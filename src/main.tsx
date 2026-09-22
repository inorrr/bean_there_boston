import React from "react";
import ReactDOM from "react-dom/client";
import { ArrowDownUp, BarChart3, Github, MapPinned, Maximize2, Minus, Plus, RotateCcw, ScatterChart, Search, SlidersHorizontal, X } from "lucide-react";
import "./styles.css";

type MetricsFile = {
  metadata: {
    generated_at: string;
    default_weights: WeightState;
    components: Record<string, { label: string; metric: string; positive: boolean }>;
    competition_modes: Record<string, string>;
  };
  neighborhoods: NeighborhoodMetric[];
};

type ManifestFile = {
  generated_at: string;
  sources: SourceEntry[];
};

type MapPoint = {
  lat: number;
  lon: number;
  name: string;
  neighborhood_key: string;
  category?: string;
  spaces?: number;
};

type MapPointLayer = {
  key: PointLayerKey;
  label: string;
  description: string;
  count: number;
  points: MapPoint[];
};

type MapPointsFile = {
  generated_at: string;
  layers: MapPointLayer[];
};

type PointLayerKey = "food_licenses" | "cafe_like" | "mbta_bus_stops" | "mbta_train_stops";

type SourceEntry = {
  key: string;
  name: string;
  publisher: string;
  dataset_url: string;
  source_url_used: string;
  source_downloaded_at: string;
  sha256: string;
  units: string;
  fields: string[];
  download_method: string;
};

type NeighborhoodMetric = {
  neighborhood: string;
  neighborhood_key: string;
  population: number;
  area_sqmi: number;
  population_density: number;
  young_adult_share: number;
  student_share: number;
  young_student_index: number;
  higher_income_share: number;
  transit_commute_share: number;
  walk_commute_share: number;
  food_establishments: number;
  food_establishments_per_10k_residents: number;
  food_establishments_per_sqmi: number;
  cafe_like_establishments: number;
  cafe_like_per_10k_residents: number;
  mbta_stops: number;
  mbta_stops_per_sqmi: number;
  parking_spaces: number;
  parking_spaces_per_sqmi: number;
  default_opportunity_score: number;
  normalized: Record<string, number>;
};

const COMPARISON_COLORS = ["#d8a45f", "#cd6b5c", "#5777a9", "#8d609e"];

type GeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { neighborhood: string; neighborhood_key: string };
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
  }>;
};

type WeightState = {
  population_density: number;
  young_student: number;
  income: number;
  transit: number;
  walk: number;
  parking: number;
  low_competition: number;
};

type SortKey =
  | "neighborhood"
  | "score"
  | "population"
  | "population_density"
  | "food_establishments"
  | "mbta_stops"
  | "parking_spaces"
  | "young_student_index";
type SortRule = { key: SortKey; direction: "asc" | "desc" };

const DEFAULT_WEIGHTS: WeightState = {
  population_density: 20,
  young_student: 20,
  income: 15,
  transit: 20,
  walk: 10,
  parking: 5,
  low_competition: 10,
};

const PRESETS: Record<string, WeightState> = {
  "Student Cafe": {
    population_density: 15,
    young_student: 35,
    income: 8,
    transit: 22,
    walk: 15,
    parking: 0,
    low_competition: 5,
  },
  "Commuter Grab-and-Go": {
    population_density: 24,
    young_student: 12,
    income: 10,
    transit: 34,
    walk: 10,
    parking: 3,
    low_competition: 7,
  },
  "Neighborhood Cafe": {
    population_density: 22,
    young_student: 10,
    income: 23,
    transit: 12,
    walk: 8,
    parking: 10,
    low_competition: 15,
  },
};

const COMPONENT_LABELS: Record<keyof WeightState, string> = {
  population_density: "Population density",
  young_student: "Young adult and student demand",
  income: "Higher-income households",
  transit: "Transit access",
  walk: "Walk commute share",
  parking: "Parking access",
  low_competition: "Low competition",
};

const COMPONENT_COLORS: Record<keyof WeightState, string> = {
  population_density: "#d8a45f",
  young_student: "#cd6b5c",
  income: "#8d609e",
  transit: "#5777a9",
  walk: "#df8b66",
  parking: "#b684c6",
  low_competition: "#efcf9a",
};

const SCORE_COMPONENTS: Array<[keyof WeightState, string]> = [
  ["population_density", "Density"],
  ["young_student", "Young/student"],
  ["income", "Income"],
  ["transit", "Transit"],
  ["walk", "Walk"],
  ["parking", "Parking"],
  ["low_competition", "Low competition"],
];

const POINT_LAYER_STYLES: Record<PointLayerKey, { label: string; color: string; radius: number }> = {
  food_licenses: { label: "Food licenses", color: "#b97830", radius: 1.7 },
  cafe_like: { label: "Cafe-like", color: "#c93f37", radius: 2.45 },
  mbta_bus_stops: { label: "Bus stops", color: "#5f7fa8", radius: 1.65 },
  mbta_train_stops: { label: "Train stops", color: "#7660a6", radius: 2.35 },
};

const LABEL_CALLOUTS: Record<string, { dx: number; dy: number; minScale?: number }> = {
  "west end": { dx: -68, dy: -28 },
  "beacon hill": { dx: -58, dy: 4 },
  downtown: { dx: 64, dy: -22 },
  "north end": { dx: 28, dy: -42 },
  chinatown: { dx: -54, dy: -36 },
  "leather district": { dx: 52, dy: 38, minScale: 1.7 },
  "bay village": { dx: -54, dy: 20, minScale: 1.65 },
};

const LABEL_REVEAL_SCALE: Record<string, number> = {
  "leather district": 1.7,
  "bay village": 1.65,
  "harbor islands": 1.8,
};

const ARCHETYPES = [
  {
    label: "Student-heavy demand",
    metric: "young_student_index",
    description: "Large young-adult and student presence for study, meetups, and daily coffee habits.",
    normalized: false,
  },
  {
    label: "Transit-rich access",
    metric: "mbta_stops_per_sqmi",
    description: "Dense MBTA stop coverage for commuter traffic and car-light visits.",
    normalized: false,
  },
  {
    label: "Lower cafe-like competition",
    metric: "low_competition_cafe",
    description: "Fewer cafe-like competitors relative to residents, useful for spotting whitespace.",
    normalized: true,
  },
] as const;

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "map", label: "Map" },
  { id: "compare", label: "Compare" },
  { id: "rankings", label: "Rankings" },
  { id: "methods", label: "Methods" },
];

const PUBLIC_SOURCE_URLS: Record<string, string> = {
  food_licenses: "https://data.boston.gov/dataset/5e4182e3-ba1e-4511-88f8-08a70383e1b6",
  neighborhood_boundaries: "https://data.boston.gov/dataset/bf1a7b50-4c72-4637-b0fa-11d632e3aff1",
  population_estimates: "https://data.boston.gov/dataset/d2ece0af-e0ad-42e4-b280-bd0aa1561ed0",
  mbta_gtfs: "https://www.mbta.com/developers/gtfs",
  parking_meters: "https://data.boston.gov/dataset/144e2003-ca70-492b-874e-76cc7355e7e3",
};

const SOURCE_FIELD_SUMMARIES: Record<string, string[]> = {
  food_licenses: [
    "Business name",
    "License status",
    "License category",
    "Business description",
    "Latitude and longitude [degrees]",
  ],
  neighborhood_boundaries: ["Neighborhood name", "Polygon geometry [latitude and longitude degrees]", "Neighborhood area [square miles, calculated]"],
  population_estimates: [
    "Neighborhood name",
    "Population [people]",
    "Age groups [share of residents]",
    "Student status [share of residents]",
    "Household income brackets [share of households]",
    "Commute mode [share of workers]",
  ],
  mbta_gtfs: ["Stop name", "Stop latitude and longitude [degrees]", "Route and stop records", "Transit mode [bus, subway, rail, ferry]"],
  parking_meters: ["Meter ID", "Meter latitude and longitude [degrees]", "Number of spaces [parking spaces]", "Meter state", "Space state"],
};

function normalizeWeights(weights: WeightState): WeightState {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return DEFAULT_WEIGHTS;
  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / total])
  ) as WeightState;
}

function scoreNeighborhood(row: NeighborhoodMetric, weights: WeightState, competitionMode: "broad" | "cafe") {
  const normalizedWeights = normalizeWeights(weights);
  const competitionKey = competitionMode === "broad" ? "low_competition_broad" : "low_competition_cafe";
  const value =
    normalizedWeights.population_density * row.normalized.population_density +
    normalizedWeights.young_student * row.normalized.young_student +
    normalizedWeights.income * row.normalized.income +
    normalizedWeights.transit * row.normalized.transit +
    normalizedWeights.walk * row.normalized.walk +
    normalizedWeights.parking * row.normalized.parking +
    normalizedWeights.low_competition * row.normalized[competitionKey];
  return Math.round(value * 10) / 10;
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value || 0);
}

function formatPercent(value: number) {
  return `${Math.round((value || 0) * 100)}%`;
}

function useData() {
  const [data, setData] = React.useState<{
    metrics: MetricsFile;
    geojson: GeoJson;
    manifest: ManifestFile;
    mapPoints: MapPointsFile;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      fetch("/data/neighborhood_metrics.json").then((res) => res.json()),
      fetch("/data/neighborhood_boundaries.geojson").then((res) => res.json()),
      fetch("/data/source_manifest.json").then((res) => res.json()),
      fetch("/data/map_points.json").then((res) => res.json()),
    ])
      .then(([metrics, geojson, manifest, mapPoints]) => setData({ metrics, geojson, manifest, mapPoints }))
      .catch((err) => setError(String(err)));
  }, []);

  return { data, error };
}

function App() {
  const { data, error } = useData();
  const [weights, setWeights] = React.useState<WeightState>(DEFAULT_WEIGHTS);
  const [competitionMode, setCompetitionMode] = React.useState<"broad" | "cafe">("broad");
  const [search, setSearch] = React.useState("");
  const [sortRules, setSortRules] = React.useState<SortRule[]>([{ key: "score", direction: "desc" }]);
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(true);
  const [controlsOpen, setControlsOpen] = React.useState(true);
  const [visiblePointLayers, setVisiblePointLayers] = React.useState<PointLayerKey[]>(["cafe_like"]);

  const rows = React.useMemo(() => {
    if (!data) return [];
    return data.metrics.neighborhoods
      .map((row) => ({ ...row, score: scoreNeighborhood(row, weights, competitionMode) }))
      .sort((a, b) => {
        for (const rule of sortRules) {
          const aValue = a[rule.key];
          const bValue = b[rule.key];
          const result =
            typeof aValue === "string" || typeof bValue === "string"
              ? String(aValue).localeCompare(String(bValue))
              : Number(aValue) - Number(bValue);
          if (result !== 0) return rule.direction === "asc" ? result : -result;
        }
        return a.neighborhood.localeCompare(b.neighborhood);
      });
  }, [data, weights, competitionMode, sortRules]);

  React.useEffect(() => {
    if (rows.length && selectedKeys.length === 0) {
      setSelectedKeys(rows.slice(0, 3).map((row) => row.neighborhood_key));
    }
  }, [rows, selectedKeys.length]);

  if (error) {
    return <main className="state">Could not load processed data: {error}</main>;
  }
  if (!data) {
    return <main className="state">Loading Boston neighborhood data...</main>;
  }

  const filteredRows = rows.filter((row) =>
    row.neighborhood.toLowerCase().includes(search.trim().toLowerCase())
  );
  const top = rows.slice(0, 3);
  const selectedRows = rows.filter((row) => selectedKeys.includes(row.neighborhood_key)).slice(0, 4);
  const activeRow = rows.find((row) => row.neighborhood_key === activeKey) || top[0];
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);

  const selectNeighborhood = (key: string) => {
    setActiveKey(key);
    setDrawerOpen(true);
  };
  const togglePointLayer = (key: PointLayerKey) => {
    setVisiblePointLayers((current) =>
      current.includes(key) ? current.filter((layerKey) => layerKey !== key) : [...current, key]
    );
  };

  return (
    <main>
      <header className="hero screen-section" id="overview">
        <nav>
          <strong>Bean There Boston</strong>
          <a className="github-link" href="https://github.com/inorrr/bean_there_boston" target="_blank" rel="noopener noreferrer" aria-label="Open GitHub repository">
            <Github size={20} />
          </a>
        </nav>
        <section className="hero-grid">
          <div>
            <p className="eyebrow">Where Should You Open a New Cafe in Boston?</p>
            <h1>Find the Boston neighborhoods where your next cafe could thrive.</h1>
            <p className="lede">
              Explore Boston neighborhoods with public data on demand, transit, parking, and nearby food businesses.
              Adjust the score to match your cafe concept, then use the map and rankings to focus your next site visits.
            </p>
          </div>
          <div className="hero-metrics" aria-label="Top score summary">
            <MetricTile label="Neighborhoods" value={rows.length.toString()} />
            <MetricTile label="Top score" value={top[0]?.score.toFixed(1) ?? "0"} />
            <MetricTile label="Data sources" value={data.manifest.sources.length.toString()} />
          </div>
        </section>
      </header>

      <section className="map-screen screen-section" id="map">
        <div className="map-stage">
          <div className="map-base" aria-hidden="true" />
          <BostonMap
            geojson={data.geojson}
            rows={rows}
            metric="score"
            pointLayers={data.mapPoints.layers}
            visiblePointLayers={visiblePointLayers}
            activeKey={activeRow.neighborhood_key}
            onSelect={selectNeighborhood}
          />
        </div>
        <div className="map-toolbar glass-panel" aria-label="Map controls">
          <div className="toolbar-title">
            <h2>Explore Neighborhood Fit</h2>
          </div>
          <div className="toolbar-actions">
            <div className="point-layer-toggles" aria-label="Map point layers">
              {data.mapPoints.layers.map((layer) => {
                const key = layer.key;
                const active = visiblePointLayers.includes(key);
                return (
                  <button
                    key={key}
                    className={active ? "active" : ""}
                    onClick={() => togglePointLayer(key)}
                    title={`${active ? "Hide" : "Show"} ${layer.label.toLowerCase()} (${layer.count})`}
                  >
                    <i style={{ background: POINT_LAYER_STYLES[key].color }} />
                    {POINT_LAYER_STYLES[key].label}
                  </button>
                );
              })}
            </div>
            <div className="score-legend-group">
              <span className="map-mode">Weighted opportunity score</span>
              <div className="map-legend" aria-label="Score color legend">
                <span>Lower</span>
                <i />
                <span>Higher</span>
              </div>
            </div>
            <div className="toolbar-zoom" aria-label="Map zoom controls">
              <button className="icon-button" onClick={() => window.dispatchEvent(new CustomEvent("bean-map-zoom", { detail: 1.25 }))} title="Zoom in">
                <Plus size={17} />
              </button>
              <button className="icon-button" onClick={() => window.dispatchEvent(new CustomEvent("bean-map-zoom", { detail: 0.8 }))} title="Zoom out">
                <Minus size={17} />
              </button>
            </div>
          </div>
        </div>
        <aside className={`neighborhood-drawer glass-panel ${drawerOpen ? "open" : "collapsed"}`} aria-label="Selected neighborhood">
          <div className="drawer-topline">
            <div className="section-title">
              <MapPinned size={18} />
              <h2>Selected Neighborhood</h2>
            </div>
            <button className="icon-button" onClick={() => setDrawerOpen((current) => !current)} title={drawerOpen ? "Collapse neighborhood detail" : "Expand neighborhood detail"}>
              {drawerOpen ? <X size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
          {drawerOpen && (
            <>
              <div className="active-summary">
                <span>Current selection</span>
                <strong>{activeRow.neighborhood}</strong>
                <b>{activeRow.score.toFixed(1)}</b>
                <p>{recommendationCopy(activeRow, competitionMode)}</p>
              </div>
              <div className="detail-strip">
                <span>{formatNumber(activeRow.population_density)} people/sq mi</span>
                <span>{activeRow.food_establishments} food licenses</span>
                <span>{activeRow.mbta_stops} MBTA stops</span>
                <span>{formatNumber(activeRow.parking_spaces)} parking meters</span>
              </div>
              <ComponentBreakdown row={activeRow} competitionMode={competitionMode} />
            </>
          )}
        </aside>
        <aside className={`controls map-controls glass-panel ${controlsOpen ? "open" : "collapsed"}`} aria-label="Score controls">
          <div className="drawer-topline">
            <div className="section-title">
              <SlidersHorizontal size={18} />
              <h2>Score Controls</h2>
            </div>
            <div className="panel-actions">
              {controlsOpen && (
                <button className="icon-button" onClick={() => setWeights(DEFAULT_WEIGHTS)} title="Reset weights">
                  <RotateCcw size={16} />
                </button>
              )}
              <button className="icon-button" onClick={() => setControlsOpen((current) => !current)} title={controlsOpen ? "Collapse score controls" : "Expand score controls"}>
                {controlsOpen ? <X size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>
          {controlsOpen && (
            <>
              <div className="preset-row">
                {Object.entries(PRESETS).map(([name, preset]) => (
                  <button key={name} onClick={() => setWeights(preset)}>
                    {name}
                  </button>
                ))}
              </div>
              <p className="small">Current slider total: {totalWeight}%. Scores automatically normalize this to 100%.</p>
              {Object.entries(COMPONENT_LABELS).map(([key, label]) => (
                <label
                  className="slider"
                  key={key}
                  style={{ "--slider-value": `${(weights[key as keyof WeightState] / 40) * 100}%` } as React.CSSProperties}
                >
                  <span>
                    {label}
                    <b>{weights[key as keyof WeightState]}%</b>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={weights[key as keyof WeightState]}
                    onChange={(event) =>
                      setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))
                    }
                  />
                </label>
              ))}
              <fieldset className="segmented">
                <legend>Competition penalty</legend>
                <button className={competitionMode === "broad" ? "active" : ""} onClick={() => setCompetitionMode("broad")}>
                  Broad food licenses
                </button>
                <button className={competitionMode === "cafe" ? "active" : ""} onClick={() => setCompetitionMode("cafe")}>
                  Cafe-like text match
                </button>
              </fieldset>
            </>
          )}
        </aside>
      </section>

      <section className="analysis-screen screen-section" id="compare">
        <section className="recommendations archetypes">
          <div className="section-intro">
            <span>Compare</span>
            <h2>Neighborhood Archetypes</h2>
            <p>Spot the kinds of neighborhoods that fit different cafe strategies, then compare where each one is strongest.</p>
          </div>
          <ArchetypeCards rows={rows} />
        </section>

        <section className="main-panel">
          <section className="visual-grid comparison-grid flat-compare">
            <article className="panel flat-panel comparison-panel-flat">
              <div className="panel-header">
                <div className="section-title">
                  <BarChart3 size={18} />
                  <h2>Neighborhood Signal Mix</h2>
                </div>
                <select
                  value=""
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value && !selectedKeys.includes(value)) {
                      setSelectedKeys((current) => [...current, value].slice(-4));
                    }
                  }}
                >
                  <option value="">Add neighborhood</option>
                  {rows.map((row) => (
                    <option key={row.neighborhood_key} value={row.neighborhood_key}>
                      {row.neighborhood}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chip-row">
                {selectedRows.map((row, index) => (
                  <button
                    className="chip"
                    key={row.neighborhood_key}
                    onClick={() => setSelectedKeys((keys) => keys.filter((key) => key !== row.neighborhood_key))}
                  >
                    <span className="chip-swatch" style={{ background: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }} aria-hidden="true" />
                    {row.neighborhood} x
                  </button>
                ))}
              </div>
              <ComponentChart rows={selectedRows} />
              <p className="tradeoff">{profileCopy(selectedRows)}</p>
            </article>

            <article className="panel scatter-panel flat-panel">
              <div className="panel-header">
                <div className="section-title">
                  <ScatterChart size={18} />
                  <h2>Opportunity Gap</h2>
                </div>
              </div>
              <ScatterPlot rows={rows} />
              <p>Farther right means stronger fixed demand; lower means fewer cafe-like competitors. The lower-right quadrant is the whitespace to investigate.</p>
            </article>
          </section>

        </section>
      </section>

      <section className="ranking-screen screen-section" id="rankings">
        <section className="panel table-panel">
          <div className="panel-header">
            <div className="section-title">
              <ArrowDownUp size={18} />
              <h2>Ranking Table</h2>
            </div>
            <label className="search">
              <Search size={16} />
              <input placeholder="Filter neighborhoods" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>
          <RankingTable rows={filteredRows} sortRules={sortRules} setSortRules={setSortRules} />
        </section>
      </section>

      <InfoSections manifest={data.manifest} generatedAt={data.metrics.metadata.generated_at} />
      <nav className="floating-nav" aria-label="Page sections">
        {NAV_ITEMS.map((item) => (
          <a key={item.id} href={`#${item.id}`}>
            {item.label}
          </a>
        ))}
      </nav>
    </main>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ComponentBreakdown({
  row,
  competitionMode,
}: {
  row: NeighborhoodMetric & { score: number };
  competitionMode: "broad" | "cafe";
}) {
  return (
    <section className="breakdown" aria-label={`${row.neighborhood} score breakdown`}>
      <h3>Score Breakdown</h3>
      {SCORE_COMPONENTS.map(([key, label]) => {
        const normKey =
          key === "low_competition"
            ? competitionMode === "broad"
              ? "low_competition_broad"
              : "low_competition_cafe"
            : key;
        const value = Math.round(row.normalized[normKey] || 0);
        return (
          <div className="breakdown-row" key={key}>
            <span>{label}</span>
            <div>
              <i style={{ width: `${value}%` }} />
            </div>
            <b>{value}</b>
          </div>
        );
      })}
    </section>
  );
}

function componentProfiles(row: NeighborhoodMetric & { score: number }, competitionMode: "broad" | "cafe") {
  return SCORE_COMPONENTS.map(([key, label]) => {
    const normKey =
      key === "low_competition"
        ? competitionMode === "broad"
          ? "low_competition_broad"
          : "low_competition_cafe"
        : key;
    return { key, label, value: Math.round(row.normalized[normKey] || 0) };
  }).sort((a, b) => b.value - a.value);
}

function describeSignal(label: string, value: number) {
  const level = value >= 75 ? "strong" : value >= 55 ? "solid" : value >= 35 ? "moderate" : "limited";
  return `${level} ${label.toLowerCase()}`;
}

function recommendationCopy(
  row: NeighborhoodMetric & { score: number },
  competitionMode: "broad" | "cafe",
  index?: number
) {
  const profile = componentProfiles(row, competitionMode);
  const strongest = profile.slice(0, 2);
  const weakest = [...profile].reverse()[0];
  const rankPhrase =
    index === 0
      ? "This is the current leading option"
      : index === 1
        ? "This is a strong secondary option"
        : row.score >= 70
          ? "This is a high-potential option"
          : row.score >= 55
            ? "This is a balanced option"
            : "This is a more selective-fit option";

  return `${rankPhrase} for ${row.neighborhood}. Its profile is driven most by ${describeSignal(
    strongest[0].label,
    strongest[0].value
  )} and ${describeSignal(strongest[1].label, strongest[1].value)}, while ${weakest.label.toLowerCase()} is the main area to investigate before prioritizing site visits.`;
}

function collectLonLat(geometry: GeoJson["features"][number]["geometry"]): [number, number][] {
  const coords = geometry.coordinates;
  if (geometry.type === "Polygon") {
    return (coords as number[][][]).flat().map((point) => [point[0], point[1]]);
  }
  return (coords as number[][][][]).flat(2).map((point) => [point[0], point[1]]);
}

function polygonPaths(
  geometry: GeoJson["features"][number]["geometry"],
  project: (point: [number, number]) => [number, number]
) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates as number[][][]] : (geometry.coordinates as number[][][][]);
  return polygons.map((polygon) =>
    polygon
      .map((ring) =>
        ring
          .map((point) => project([point[0], point[1]]))
          .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
          .join(" ")
      )
      .join(" ")
  );
}

function labelPoint(
  geometry: GeoJson["features"][number]["geometry"],
  project: (point: [number, number]) => [number, number]
) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates as number[][][]] : (geometry.coordinates as number[][][][]);
  const candidates = polygons.map((polygon) => {
    const points = polygon[0].map((point) => project([point[0], point[1]]));
    let area = 0;
    let centroidX = 0;
    let centroidY = 0;
    for (let index = 0; index < points.length; index += 1) {
      const [x1, y1] = points[index];
      const [x2, y2] = points[(index + 1) % points.length];
      const cross = x1 * y2 - x2 * y1;
      area += cross;
      centroidX += (x1 + x2) * cross;
      centroidY += (y1 + y2) * cross;
    }
    const signedArea = area / 2;
    if (Math.abs(signedArea) < 0.01) {
      return {
        area: 0,
        point: [
          points.reduce((sum, point) => sum + point[0], 0) / points.length,
          points.reduce((sum, point) => sum + point[1], 0) / points.length,
        ] as [number, number],
      };
    }
    return {
      area: Math.abs(signedArea),
      point: [centroidX / (6 * signedArea), centroidY / (6 * signedArea)] as [number, number],
    };
  });
  return candidates.sort((a, b) => b.area - a.area)[0].point;
}

function mercatorY(lat: number) {
  const radians = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function tileToLon(x: number, zoom: number) {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileToLat(y: number, zoom: number) {
  const radians = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** zoom)));
  return (radians * 180) / Math.PI;
}

function lonToTile(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTile(lat: number, zoom: number) {
  const radians = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom);
}

function BostonMap({
  geojson,
  rows,
  metric,
  pointLayers,
  visiblePointLayers,
  activeKey,
  onSelect,
}: {
  geojson: GeoJson;
  rows: Array<NeighborhoodMetric & { score: number }>;
  metric: string;
  pointLayers: MapPointLayer[];
  visiblePointLayers: PointLayerKey[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const [viewport, setViewport] = React.useState({ scale: 1.42, x: -64, y: 23 });
  const [hoveredCafe, setHoveredCafe] = React.useState<(MapPoint & { x: number; y: number }) | null>(null);
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const panStart = React.useRef<{
    pointerId: number;
    point: { x: number; y: number };
    viewport: { scale: number; x: number; y: number };
  } | null>(null);
  const pinchStart = React.useRef<{
    distance: number;
    center: { x: number; y: number };
    viewport: { scale: number; x: number; y: number };
  } | null>(null);
  const lookup = new Map(rows.map((row) => [row.neighborhood_key, row]));
  const allPoints = geojson.features.flatMap((feature) => collectLonLat(feature.geometry));
  const minLon = Math.min(...allPoints.map((point) => point[0]));
  const maxLon = Math.max(...allPoints.map((point) => point[0]));
  const minLat = Math.min(...allPoints.map((point) => point[1]));
  const maxLat = Math.max(...allPoints.map((point) => point[1]));
  const lonPad = (maxLon - minLon) * 0.08;
  const latPad = (maxLat - minLat) * 0.08;
  const west = minLon - lonPad;
  const east = maxLon + lonPad;
  const south = minLat - latPad;
  const north = maxLat + latPad;
  const minMercator = mercatorY(south);
  const maxMercator = mercatorY(north);
  const values = rows.map((row) => Number(metric === "score" ? row.score : row[metric as keyof NeighborhoodMetric]) || 0);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const inverseScale = 1 / viewport.scale;
  const project = ([lon, lat]: [number, number]): [number, number] => [
    ((lon - west) / (east - west)) * 768,
    (1 - (mercatorY(lat) - minMercator) / (maxMercator - minMercator)) * 548,
  ];
  const tileZoom = Math.max(11, Math.min(15, 12 + Math.round(Math.log2(Math.max(viewport.scale, 0.5) / 0.74))));
  const tilePadFactor = 1.15 + Math.max(0, 1 - viewport.scale) * 0.9;
  const tileLonPad = (east - west) * tilePadFactor;
  const tileLatPad = (north - south) * tilePadFactor;
  const tileWest = west - tileLonPad;
  const tileEast = east + tileLonPad;
  const tileSouth = south - tileLatPad;
  const tileNorth = north + tileLatPad;
  const startTileX = lonToTile(tileWest, tileZoom);
  const endTileX = lonToTile(tileEast, tileZoom);
  const startTileY = latToTile(tileNorth, tileZoom);
  const endTileY = latToTile(tileSouth, tileZoom);
  const tiles = [];
  for (let x = startTileX; x <= endTileX; x += 1) {
    for (let y = startTileY; y <= endTileY; y += 1) {
      const [x1, y1] = project([tileToLon(x, tileZoom), tileToLat(y, tileZoom)]);
      const [x2, y2] = project([tileToLon(x + 1, tileZoom), tileToLat(y + 1, tileZoom)]);
      tiles.push({ x, y, left: x1, top: y1, width: x2 - x1, height: y2 - y1 });
    }
  }
  const clampScale = (scale: number) => Math.max(0.45, Math.min(4, scale));
  const screenToSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const screen = svg.getScreenCTM();
    if (!screen) return null;
    return point.matrixTransform(screen.inverse());
  };
  const getGesture = () => {
    const points = Array.from(pointers.current.values());
    if (points.length < 2) return null;
    const [first, second] = points;
    return {
      distance: Math.hypot(second.x - first.x, second.y - first.y),
      center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    };
  };
  const zoomAround = (center: { x: number; y: number }, nextScale: number, start = viewport) => {
    const scale = clampScale(nextScale);
    const mapX = (center.x - start.x) / start.scale;
    const mapY = (center.y - start.y) / start.scale;
    setViewport({
      scale,
      x: center.x - mapX * scale,
      y: center.y - mapY * scale,
    });
  };
  React.useEffect(() => {
    const handleZoom = (event: Event) => {
      const factor = Number((event as CustomEvent<number>).detail) || 1;
      zoomAround({ x: 384, y: 274 }, viewport.scale * factor);
    };
    window.addEventListener("bean-map-zoom", handleZoom);
    return () => window.removeEventListener("bean-map-zoom", handleZoom);
  }, [viewport]);

  return (
    <svg
      className="boston-map"
      viewBox="0 0 768 548"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Boston neighborhood choropleth map"
      onPointerDown={(event) => {
        const svgPoint = screenToSvgPoint(event.currentTarget, event.clientX, event.clientY);
        if (!svgPoint) return;
        pointers.current.set(event.pointerId, { x: svgPoint.x, y: svgPoint.y });
        event.currentTarget.setPointerCapture(event.pointerId);
        const gesture = getGesture();
        if (gesture) {
          pinchStart.current = { ...gesture, viewport };
          panStart.current = null;
        } else {
          panStart.current = { pointerId: event.pointerId, point: { x: svgPoint.x, y: svgPoint.y }, viewport };
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        const svgPoint = screenToSvgPoint(event.currentTarget, event.clientX, event.clientY);
        if (!svgPoint) return;
        pointers.current.set(event.pointerId, { x: svgPoint.x, y: svgPoint.y });
        const gesture = getGesture();
        if (gesture && pinchStart.current) {
          zoomAround(gesture.center, (pinchStart.current.viewport.scale * gesture.distance) / pinchStart.current.distance, pinchStart.current.viewport);
          return;
        }
        if (panStart.current?.pointerId === event.pointerId && pointers.current.size === 1) {
          setViewport({
            ...panStart.current.viewport,
            x: panStart.current.viewport.x + svgPoint.x - panStart.current.point.x,
            y: panStart.current.viewport.y + svgPoint.y - panStart.current.point.y,
          });
        }
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        pinchStart.current = null;
        panStart.current = null;
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        pinchStart.current = null;
        panStart.current = null;
      }}
    >
      <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
        <g className="map-tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <image
              key={`${tileZoom}-${tile.x}-${tile.y}`}
              href={`https://tile.openstreetmap.org/${tileZoom}/${tile.x}/${tile.y}.png`}
              x={tile.left}
              y={tile.top}
              width={tile.width}
              height={tile.height}
              preserveAspectRatio="none"
            />
          ))}
        </g>
        <rect className="tile-wash" x="-1200" y="-900" width="3168" height="2348" />
        {geojson.features.map((feature) => {
          const row = lookup.get(feature.properties.neighborhood_key);
          const value = Number(metric === "score" ? row?.score : row?.[metric as keyof NeighborhoodMetric]) || 0;
          const intensity = high === low ? 0.5 : (value - low) / (high - low);
          const paths = polygonPaths(feature.geometry, project);
          const fill = colorRamp(intensity);
          return paths.map((points, index) => (
            <polygon
              key={`${feature.properties.neighborhood_key}-${index}`}
              points={points}
              className={feature.properties.neighborhood_key === activeKey ? "active-neighborhood" : ""}
              fill={fill}
              onPointerDown={() => onSelect(feature.properties.neighborhood_key)}
              onClick={() => onSelect(feature.properties.neighborhood_key)}
            >
              <title>
                {feature.properties.neighborhood}: {metric === "score" ? row?.score.toFixed(1) : formatNumber(value, 1)}
              </title>
            </polygon>
          ));
        })}
        <g className="map-point-layers" aria-hidden="true">
          {pointLayers
            .filter((layer) => visiblePointLayers.includes(layer.key))
            .map((layer) => (
              <g className={`point-layer point-layer-${layer.key}`} key={layer.key}>
                {layer.points.map((point, index) => {
                  const [x, y] = project([point.lon, point.lat]);
                  const style = POINT_LAYER_STYLES[layer.key];
                  return (
                    <circle
                      key={`${layer.key}-${index}`}
                      cx={x}
                      cy={y}
                      r={style.radius * inverseScale}
                      fill={style.color}
                      onPointerEnter={() => {
                        if (layer.key === "cafe_like") setHoveredCafe({ ...point, x, y });
                      }}
                      onPointerLeave={() => {
                        if (layer.key === "cafe_like") setHoveredCafe(null);
                      }}
                    >
                      <title>{`${layer.label}: ${point.name}`}</title>
                    </circle>
                  );
                })}
              </g>
            ))}
        </g>
        {geojson.features.map((feature) => {
          const [x, y] = labelPoint(feature.geometry, project);
          const key = feature.properties.neighborhood_key;
          const isActive = feature.properties.neighborhood_key === activeKey;
          const callout = LABEL_CALLOUTS[key];
          const revealScale = LABEL_REVEAL_SCALE[key] ?? callout?.minScale ?? 0;
          const isVisible = isActive || viewport.scale >= revealScale;
          if (!isVisible) return null;
          const labelX = callout ? x + callout.dx : x;
          const labelY = callout ? y + callout.dy : y;
          const labelTransform = `translate(${labelX} ${labelY}) scale(${inverseScale}) translate(${-labelX} ${-labelY})`;
          return (
            <g key={`${feature.properties.neighborhood_key}-label`} className="label-group">
              {callout && (
                <>
                  <line
                    className={isActive ? "label-leader active-leader" : "label-leader"}
                    x1={x}
                    y1={y}
                    x2={labelX}
                    y2={labelY}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle className="label-anchor" cx={x} cy={y} r={1.25 * inverseScale} />
                </>
              )}
              <text
                className={`${callout ? "neighborhood-label callout-label" : "neighborhood-label"}${isActive ? " active-label" : ""}`}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                transform={labelTransform}
              >
                {feature.properties.neighborhood}
              </text>
            </g>
          );
        })}
        {hoveredCafe && (
          <foreignObject
            className="cafe-tooltip"
            x={Math.min(hoveredCafe.x + 6 * inverseScale, 768 - 136 * inverseScale)}
            y={Math.max(hoveredCafe.y - 44 * inverseScale, 10)}
            width={128 * inverseScale}
            height={58 * inverseScale}
          >
            <div style={{ transform: `scale(${inverseScale})`, transformOrigin: "top left" }}>
              <strong>{hoveredCafe.name}</strong>
              <span>{hoveredCafe.category || "Cafe-like food license"}</span>
              <small>{lookup.get(hoveredCafe.neighborhood_key)?.neighborhood || "Boston"}</small>
            </div>
          </foreignObject>
        )}
      </g>
    </svg>
  );
}

function colorRamp(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  const stops = [
    [255, 249, 224],
    [250, 221, 159],
    [238, 165, 105],
    [205, 102, 78],
    [145, 56, 62],
  ];
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const mix = scaled - index;
  const [r1, g1, b1] = stops[index];
  const [r2, g2, b2] = stops[index + 1];
  const r = Math.round(r1 + (r2 - r1) * mix);
  const g = Math.round(g1 + (g2 - g1) * mix);
  const b = Math.round(b1 + (b2 - b1) * mix);
  return `rgb(${r} ${g} ${b})`;
}

function metricValue(row: NeighborhoodMetric, metric: string, normalized = false) {
  if (normalized) return Number(row.normalized[metric]) || 0;
  return Number(row[metric as keyof NeighborhoodMetric]) || 0;
}

function ArchetypeCards({ rows }: { rows: Array<NeighborhoodMetric & { score: number }> }) {
  return (
    <>
      {ARCHETYPES.map((archetype, index) => {
        const leaders = [...rows]
          .sort((a, b) => metricValue(b, archetype.metric, archetype.normalized) - metricValue(a, archetype.metric, archetype.normalized))
          .slice(0, 3);
        return (
          <article className="recommendation archetype-card" key={archetype.label}>
            <span className="rank">{String(index + 1).padStart(2, "0")}</span>
            <h2>{archetype.label}</h2>
            <p>{archetype.description}</p>
            <ol>
              {leaders.map((row) => (
                <li key={row.neighborhood_key}>
                  <span>{row.neighborhood}</span>
                  <b>{formatNumber(metricValue(row, archetype.metric, archetype.normalized), archetype.normalized ? 0 : 1)}</b>
                </li>
              ))}
            </ol>
          </article>
        );
      })}
    </>
  );
}

function RankedBarChart({ rows }: { rows: Array<NeighborhoodMetric & { score: number }> }) {
  const max = Math.max(...rows.map((row) => row.score), 1);
  return (
    <div className="bar-chart">
      {rows.map((row) => (
        <div className="bar-row" key={row.neighborhood_key}>
          <span>{row.neighborhood}</span>
          <div>
            <i style={{ width: `${(row.score / max) * 100}%`, background: colorRamp(row.score / 100) }} />
          </div>
          <b>{row.score.toFixed(1)}</b>
        </div>
      ))}
    </div>
  );
}

function ComponentChart({ rows }: { rows: Array<NeighborhoodMetric & { score: number }> }) {
  const components = [
    ["population_density", "Density"],
    ["young_student", "Young/student"],
    ["income", "Income"],
    ["transit", "Transit"],
    ["walk", "Walk"],
    ["parking", "Parking"],
    ["low_competition_cafe", "Lower cafe-like competition"],
  ] as const;

  return (
    <div className="component-chart vertical-component-chart" role="img" aria-label="Selected neighborhood signal mix comparison">
      <div className="chart-gridline chart-gridline-25" />
      <div className="chart-gridline chart-gridline-50" />
      <div className="chart-gridline chart-gridline-75" />
      {components.map(([key, label]) => (
        <div className="component-column" key={key}>
          <div className="component-bars">
            {rows.map((row, index) => {
              const value = row.normalized[key];
              return (
                <span
                  key={row.neighborhood_key}
                  style={{ height: `${value}%`, background: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }}
                  title={`${row.neighborhood}: ${Math.round(value)}`}
                />
              );
            })}
          </div>
          <b>{label}</b>
        </div>
      ))}
    </div>
  );
}

function ScatterPlot({ rows }: { rows: Array<NeighborhoodMetric & { score: number }> }) {
  const [hoveredPoint, setHoveredPoint] = React.useState<{
    row: NeighborhoodMetric & { score: number };
    x: number;
    y: number;
    demandScore: number;
    competition: number;
  } | null>(null);
  const width = 520;
  const height = 300;
  const pad = 36;
  const demandScores = rows.map(
    (row) =>
      row.normalized.population_density * 0.28 +
      row.normalized.young_student * 0.24 +
      row.normalized.income * 0.18 +
      row.normalized.transit * 0.18 +
      row.normalized.walk * 0.12
  );
  const compValues = rows.map((row) => row.cafe_like_per_10k_residents);
  const transitValues = rows.map((row) => row.mbta_stops_per_sqmi);
  const densityValues = rows.map((row) => row.population_density);
  const demandMax = Math.max(...demandScores, 1);
  const compMax = Math.max(...compValues, 1);
  const transitMax = Math.max(...transitValues, 1);
  const densityMax = Math.max(...densityValues, 1);
  const midX = width / 2;
  const midY = height / 2;
  const plotCenterX = (pad + (width - pad)) / 2;
  return (
    <svg className="scatter" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Opportunity gap scatter plot">
      <rect className="quadrant quadrant-watch" x={pad} y={pad} width={midX - pad} height={midY - pad} />
      <rect className="quadrant quadrant-crowded" x={midX} y={pad} width={width - pad - midX} height={midY - pad} />
      <rect className="quadrant quadrant-low" x={pad} y={midY} width={midX - pad} height={height - pad - midY} />
      <rect className="quadrant quadrant-gap" x={midX} y={midY} width={width - pad - midX} height={height - pad - midY} />
      <line className="quadrant-line" x1={midX} y1={pad} x2={midX} y2={height - pad} />
      <line className="quadrant-line" x1={pad} y1={midY} x2={width - pad} y2={midY} />
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} />
      <text className="quadrant-label" x={midX + 12} y={midY + 22}>
        Promising gap
      </text>
      <text className="quadrant-label" x={midX + 12} y={pad + 18}>
        Crowded demand
      </text>
      <text x={plotCenterX} y={height - 8} textAnchor="middle">
        Overall demand index
      </text>
      <text x={8} y={24}>
        Cafe-like competition
      </text>
      {rows.map((row, index) => {
        const demandScore = demandScores[index];
        const competition = row.cafe_like_per_10k_residents;
        const x = pad + (demandScore / demandMax) * (width - pad * 2);
        const y = height - pad - (competition / compMax) * (height - pad * 2);
        const r = 4 + (row.mbta_stops_per_sqmi / transitMax) * 11;
        const densityIntensity = row.population_density / densityMax;
        return (
          <circle
            className="scatter-dot"
            key={row.neighborhood_key}
            cx={x}
            cy={y}
            r={r}
            fill={colorRamp(densityIntensity)}
            onMouseEnter={() => setHoveredPoint({ row, x, y, demandScore, competition })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        );
      })}
      {hoveredPoint && (
        <g className="scatter-tooltip" transform={`translate(${Math.min(hoveredPoint.x + 12, width - 156)} ${Math.max(hoveredPoint.y - 62, pad + 4)})`}>
          <rect width="144" height="70" rx="7" />
          <text x="9" y="18" className="tooltip-title">
            {hoveredPoint.row.neighborhood}
          </text>
          <text x="9" y="34">Demand {formatNumber(hoveredPoint.demandScore, 1)}</text>
          <text x="9" y="48">Competition {formatNumber(hoveredPoint.competition, 1)}/10k</text>
          <text x="9" y="62">Transit {formatNumber(hoveredPoint.row.mbta_stops_per_sqmi, 1)}/sq mi</text>
        </g>
      )}
    </svg>
  );
}

function profileCopy(rows: Array<NeighborhoodMetric & { score: number }>) {
  if (rows.length < 2) return "Add two to four neighborhoods to compare raw component profiles.";
  const access = [...rows].sort((a, b) => b.normalized.transit - a.normalized.transit)[0];
  const demand = [...rows].sort((a, b) => b.normalized.young_student - a.normalized.young_student)[0];
  const competition = [...rows].sort((a, b) => b.normalized.low_competition_cafe - a.normalized.low_competition_cafe)[0];
  return `${demand.neighborhood} has the strongest young/student demand profile. ${access.neighborhood} leads this set on transit access, while ${competition.neighborhood} has the lowest cafe-like competition signal.`;
}

function RankingTable({
  rows,
  sortRules,
  setSortRules,
}: {
  rows: Array<NeighborhoodMetric & { score: number }>;
  sortRules: SortRule[];
  setSortRules: React.Dispatch<React.SetStateAction<SortRule[]>>;
}) {
  const headers: Array<[SortKey, string]> = [
    ["neighborhood", "Neighborhood"],
    ["score", "Score"],
    ["population", "Population"],
    ["population_density", "Density"],
    ["food_establishments", "Food licenses"],
    ["mbta_stops", "MBTA stops"],
    ["parking_spaces", "Parking"],
    ["young_student_index", "Young/student"],
  ];
  const updateSort = (key: SortKey) => {
    setSortRules((current) => {
      const existing = current.find((rule) => rule.key === key);
      const direction = existing?.direction === "asc" ? "desc" : "asc";
      return [{ key, direction }, ...current.filter((rule) => rule.key !== key)];
    });
  };
  const sortMeta = (key: SortKey) => {
    const index = sortRules.findIndex((rule) => rule.key === key);
    if (index < 0) return null;
    return { index, direction: sortRules[index].direction };
  };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map(([key, label]) => (
              <th key={key}>
                <button
                  className={sortMeta(key) ? "sorted" : ""}
                  onClick={() => updateSort(key)}
                  aria-label={`Sort by ${label}`}
                >
                  {label}
                  {sortMeta(key) && (
                    <span className="sort-indicator">
                      {sortMeta(key)?.direction === "asc" ? "↑" : "↓"}
                      {sortMeta(key)!.index > 0 ? sortMeta(key)!.index + 1 : ""}
                    </span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.neighborhood_key}>
              <td>{row.neighborhood}</td>
              <td>{row.score.toFixed(1)}</td>
              <td>{formatNumber(row.population)}</td>
              <td>{formatNumber(row.population_density)}</td>
              <td>{row.food_establishments}</td>
              <td>{row.mbta_stops}</td>
              <td>{formatNumber(row.parking_spaces)}</td>
              <td>{formatPercent(row.young_student_index)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoSections({ manifest, generatedAt }: { manifest: ManifestFile; generatedAt: string }) {
  return (
    <section className="info-grid screen-section" id="methods">
      <article className="panel method-panel">
        <div className="method-hero">
          <span>Methodology</span>
          <h2>Data and Methods</h2>
        </div>
        <p>
          The map and ranking combine public neighborhood-level indicators into an opportunity score. Each metric is
          normalized from 0 to 100 across Boston neighborhoods so different units can be compared on the same scale.
          Higher values generally mean stronger fit, except competition: that signal is inverted so fewer nearby
          competitors produces a higher low-competition score. The score controls let users decide how much each metric
          should matter, and the app normalizes those weights to 100% before calculating the final score.
        </p>
        <div className="metric-list">
          <section>
            <h3>Population density</h3>
            <p>Residents per square mile. Denser neighborhoods can support more walk-up demand and repeat local visits.</p>
          </section>
          <section>
            <h3>Young adult and student demand</h3>
            <p>A combined index from young-adult share and student share. It highlights areas where study, social, and daily coffee routines may be stronger.</p>
          </section>
          <section>
            <h3>Higher-income households</h3>
            <p>Share of households in higher income brackets. This is used as a spending-power proxy, not as a guarantee of cafe sales.</p>
          </section>
          <section>
            <h3>Transit access</h3>
            <p>MBTA bus, subway, rail, and ferry stops assigned to each neighborhood and scaled by area. The map separates bus and train stops as point layers for exploration.</p>
          </section>
          <section>
            <h3>Walk commute share</h3>
            <p>Share of residents who commute by walking. This helps identify places where foot traffic and car-light routines may matter more.</p>
          </section>
          <section>
            <h3>Parking access</h3>
            <p>City parking meter spaces assigned to each neighborhood and scaled by area. Parking remains part of the score, but meter dots were removed from the map because the source does not represent all parking supply.</p>
          </section>
          <section>
            <h3>Food licenses and cafe-like competition</h3>
            <p>Active food establishment licenses are assigned to neighborhoods. Cafe-like competitors are a narrower text match using business names and categories such as cafe, coffee, tea, bakery, donut, espresso, barista, roast, and boba.</p>
          </section>
          <section>
            <h3>Opportunity score</h3>
            <p>The final score is the weighted sum of the normalized components. On the map, warmer and deeper colors indicate higher weighted opportunity under the current score controls.</p>
          </section>
        </div>
        <p className="small">Processed data generated: {new Date(generatedAt).toLocaleString()}</p>
      </article>
      <article className="panel">
        <div className="method-hero">
          <span>Source Data</span>
          <h2>Sources</h2>
        </div>
        <p className="source-note">These public datasets provide the neighborhood boundaries, demand signals, access measures, and business locations used throughout the analysis.</p>
        <div className="source-list">
          {manifest.sources.map((source) => (
            <a key={source.key} href={PUBLIC_SOURCE_URLS[source.key] || source.dataset_url} target="_blank" rel="noreferrer">
              <strong>{source.name}</strong>
              <span>{source.publisher}</span>
              <span>
                Accessed {new Date(source.source_downloaded_at).toLocaleDateString()} via {source.download_method}
              </span>
              <span>{source.units}</span>
              <ul>
                {(SOURCE_FIELD_SUMMARIES[source.key] || source.fields).slice(0, 6).map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
              <em>Open public dataset page</em>
            </a>
          ))}
        </div>
      </article>
      <article className="panel limitations">
        <div className="method-hero">
          <span>Interpretation</span>
          <h2>Limitations and Assumptions</h2>
        </div>
        <ul>
          <li>The score works at the neighborhood level, so it helps narrow where to look but cannot choose a specific storefront or block.</li>
          <li>Rent, lease availability, buildout cost, zoning details, floor plan, utilities, and landlord terms are not included.</li>
          <li>Food licenses are an imperfect competition proxy; some licensed businesses are not direct cafe competitors, and some cafe-like matches may be missed.</li>
          <li>MBTA stop counts measure nearby access points, not route frequency, ridership, reliability, crowding, or service quality.</li>
          <li>Parking meters are only one view of parking access and do not cover private lots, garages, curb rules, loading zones, or informal parking conditions.</li>
          <li>Public datasets can lag openings, closures, neighborhood change, and seasonal patterns, so site visits are still essential.</li>
        </ul>
      </article>
      <article className="panel">
        <div className="method-hero">
          <span>Next Steps</span>
          <h2>What to Take Forward</h2>
        </div>
        <p>
          Start with neighborhoods where several signals line up: strong demand, good transit or walk access, and room
          to stand out from nearby cafe-like businesses. West End, Beacon Hill, Downtown, North End, Back Bay, Fenway,
          and Longwood often rise to the top because they combine density, access, and daily activity, but each one
          tells a different story. Some look strongest because of transit and foot traffic; others are more interesting
          because the cafe-like competition signal is less crowded.
        </p>
        <p>
          Use the ranking table to build a short list, then use the map to inspect nearby food licenses, cafe-like
          competitors, and transit stops. Neighborhood Signal Mix helps you understand why a place looks promising, while
          Opportunity Gap points to areas where demand appears stronger than cafe-like competition. Once a few
          neighborhoods stand out, validate the block-level details this site cannot see: asking rent, storefront
          visibility, pedestrian counts by time of day, nearby schools and offices, competitor menus and prices, delivery
          demand, zoning constraints, outdoor seating options, and the feel of the block on weekdays and weekends.
        </p>
      </article>
      <footer className="site-footer">
        <span>© 2026 Yinuo Zhao. Bean There Boston was built with public Boston-area datasets for neighborhood exploration.</span>
        <a href="https://github.com/inorrr/bean_there_boston" target="_blank" rel="noopener noreferrer">
          View project on GitHub
        </a>
      </footer>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
