import React from "react";
import ReactDOM from "react-dom/client";
import { ArrowDownUp, BarChart3, MapPinned, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
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
  | "score"
  | "population"
  | "population_density"
  | "food_establishments"
  | "mbta_stops"
  | "parking_spaces"
  | "young_student_index";

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

const MAP_METRICS = [
  { key: "score", label: "Opportunity score" },
  { key: "food_establishments_per_10k_residents", label: "Competition" },
  { key: "population_density", label: "Population density" },
  { key: "mbta_stops_per_sqmi", label: "Transit access" },
  { key: "parking_spaces_per_sqmi", label: "Parking access" },
  { key: "young_student_index", label: "Young/student demand" },
] as const;

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
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      fetch("/data/neighborhood_metrics.json").then((res) => res.json()),
      fetch("/data/neighborhood_boundaries.geojson").then((res) => res.json()),
      fetch("/data/source_manifest.json").then((res) => res.json()),
    ])
      .then(([metrics, geojson, manifest]) => setData({ metrics, geojson, manifest }))
      .catch((err) => setError(String(err)));
  }, []);

  return { data, error };
}

function App() {
  const { data, error } = useData();
  const [weights, setWeights] = React.useState<WeightState>(DEFAULT_WEIGHTS);
  const [competitionMode, setCompetitionMode] = React.useState<"broad" | "cafe">("broad");
  const [mapMetric, setMapMetric] = React.useState<(typeof MAP_METRICS)[number]["key"]>("score");
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("score");
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    if (!data) return [];
    return data.metrics.neighborhoods
      .map((row) => ({ ...row, score: scoreNeighborhood(row, weights, competitionMode) }))
      .sort((a, b) => {
        const key = sortKey === "score" ? "score" : sortKey;
        return Number(b[key]) - Number(a[key]);
      });
  }, [data, weights, competitionMode, sortKey]);

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

  return (
    <main>
      <header className="hero">
        <nav>
          <strong>Bean There Boston</strong>
          <span>Neighborhood-level cafe opportunity prototype</span>
        </nav>
        <section className="hero-grid">
          <div>
            <p className="eyebrow">Where Should You Open a New Cafe in Boston?</p>
            <h1>Compare demand, access, and competition before choosing neighborhoods for site visits.</h1>
            <p className="lede">
              This class-project tool combines Boston public licensing, demographics, MBTA GTFS, and parking meter data.
              It supports early screening only: no rent data, no profit forecast, and no exact storefront recommendation.
            </p>
          </div>
          <div className="hero-metrics" aria-label="Top score summary">
            <MetricTile label="Neighborhoods" value={rows.length.toString()} />
            <MetricTile label="Top score" value={top[0]?.score.toFixed(1) ?? "0"} />
            <MetricTile label="Data sources" value={data.manifest.sources.length.toString()} />
          </div>
        </section>
      </header>

      <section className="workspace">
        <aside className="controls" aria-label="Score controls">
          <div className="section-title">
            <SlidersHorizontal size={18} />
            <h2>Weight Controls</h2>
          </div>
          <div className="preset-row">
            {Object.entries(PRESETS).map(([name, preset]) => (
              <button key={name} onClick={() => setWeights(preset)}>
                {name}
              </button>
            ))}
            <button className="icon-button" onClick={() => setWeights(DEFAULT_WEIGHTS)} title="Reset weights">
              <RotateCcw size={16} />
            </button>
          </div>
          <p className="small">
            Current slider total: {totalWeight}%. Scores automatically normalize this to 100%.
          </p>
          {Object.entries(COMPONENT_LABELS).map(([key, label]) => (
            <label className="slider" key={key}>
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
        </aside>

        <section className="main-panel">
          <section className="recommendations">
            {top.map((row, index) => (
              <article className="recommendation" key={row.neighborhood_key}>
                <span className="rank">#{index + 1}</span>
                <h2>{row.neighborhood}</h2>
                <strong>{row.score.toFixed(1)}</strong>
                <p>{recommendationCopy(row, index)}</p>
              </article>
            ))}
          </section>

          <section className="visual-grid">
            <article className="panel map-panel">
              <div className="panel-header">
                <div>
                  <div className="section-title">
                    <MapPinned size={18} />
                    <h2>Interactive Map</h2>
                  </div>
                  <p>Choropleth by selected metric. Select a neighborhood for detail.</p>
                </div>
                <select value={mapMetric} onChange={(event) => setMapMetric(event.target.value as typeof mapMetric)}>
                  {MAP_METRICS.map((metric) => (
                    <option key={metric.key} value={metric.key}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </div>
              <BostonMap
                geojson={data.geojson}
                rows={rows}
                metric={mapMetric}
                activeKey={activeRow.neighborhood_key}
                onSelect={setActiveKey}
              />
              <div className="detail-strip">
                <strong>{activeRow.neighborhood}</strong>
                <span>Score {activeRow.score.toFixed(1)}</span>
                <span>{formatNumber(activeRow.population_density)} people/sq mi</span>
                <span>{activeRow.food_establishments} food licenses</span>
                <span>{activeRow.mbta_stops} MBTA stops</span>
              </div>
            </article>

            <article className="panel">
              <div className="section-title">
                <BarChart3 size={18} />
                <h2>Top Neighborhoods</h2>
              </div>
              <RankedBarChart rows={rows.slice(0, 8)} />
            </article>
          </section>

          <section className="visual-grid comparison-grid">
            <article className="panel">
              <div className="panel-header">
                <div className="section-title">
                  <BarChart3 size={18} />
                  <h2>Comparison Panel</h2>
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
                {selectedRows.map((row) => (
                  <button
                    className="chip"
                    key={row.neighborhood_key}
                    onClick={() => setSelectedKeys((keys) => keys.filter((key) => key !== row.neighborhood_key))}
                  >
                    {row.neighborhood} x
                  </button>
                ))}
              </div>
              <ComponentChart rows={selectedRows} competitionMode={competitionMode} />
              <p className="tradeoff">{tradeoffCopy(selectedRows)}</p>
            </article>

            <article className="panel scatter-panel">
              <h2>Demand vs. Competition</h2>
              <p>Higher and farther right is generally stronger; larger circles have more transit-stop density.</p>
              <ScatterPlot rows={rows} />
            </article>
          </section>

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
            <RankingTable rows={filteredRows} sortKey={sortKey} setSortKey={setSortKey} />
          </section>
        </section>
      </section>

      <InfoSections manifest={data.manifest} generatedAt={data.metrics.metadata.generated_at} />
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

function recommendationCopy(row: NeighborhoodMetric & { score: number }, index: number) {
  const competition =
    row.normalized.low_competition_broad > 66 ? "relatively low" : row.normalized.low_competition_broad > 35 ? "moderate" : "high";
  if (index === 0) {
    return `Prioritize ${row.neighborhood} for site visits because it combines ${formatNumber(
      row.population_density
    )} people per square mile with ${row.mbta_stops} MBTA stops, while broad food competition is ${competition}.`;
  }
  if (index === 1) {
    return `Treat ${row.neighborhood} as a strong secondary option. It scores well on access and demand, but compare nearby storefront rents and direct cafe menus before committing.`;
  }
  return `${row.neighborhood} deserves a closer look, especially if your concept matches its demand profile. Do not use the score alone before leasing.`;
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

function BostonMap({
  geojson,
  rows,
  metric,
  activeKey,
  onSelect,
}: {
  geojson: GeoJson;
  rows: Array<NeighborhoodMetric & { score: number }>;
  metric: string;
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const lookup = new Map(rows.map((row) => [row.neighborhood_key, row]));
  const allPoints = geojson.features.flatMap((feature) => collectLonLat(feature.geometry));
  const minLon = Math.min(...allPoints.map((point) => point[0]));
  const maxLon = Math.max(...allPoints.map((point) => point[0]));
  const minLat = Math.min(...allPoints.map((point) => point[1]));
  const maxLat = Math.max(...allPoints.map((point) => point[1]));
  const values = rows.map((row) => Number(metric === "score" ? row.score : row[metric as keyof NeighborhoodMetric]) || 0);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const project = ([lon, lat]: [number, number]): [number, number] => [
    ((lon - minLon) / (maxLon - minLon)) * 720 + 24,
    (1 - (lat - minLat) / (maxLat - minLat)) * 500 + 24,
  ];
  return (
    <svg className="boston-map" viewBox="0 0 768 548" role="img" aria-label="Boston neighborhood choropleth map">
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
            onClick={() => onSelect(feature.properties.neighborhood_key)}
          >
            <title>
              {feature.properties.neighborhood}: {metric === "score" ? row?.score.toFixed(1) : formatNumber(value, 1)}
            </title>
          </polygon>
        ));
      })}
    </svg>
  );
}

function colorRamp(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  const hue = 26 + clamped * 142;
  const light = 84 - clamped * 34;
  return `hsl(${hue} 64% ${light}%)`;
}

function RankedBarChart({ rows }: { rows: Array<NeighborhoodMetric & { score: number }> }) {
  const max = Math.max(...rows.map((row) => row.score), 1);
  return (
    <div className="bar-chart">
      {rows.map((row) => (
        <div className="bar-row" key={row.neighborhood_key}>
          <span>{row.neighborhood}</span>
          <div>
            <i style={{ width: `${(row.score / max) * 100}%` }} />
          </div>
          <b>{row.score.toFixed(1)}</b>
        </div>
      ))}
    </div>
  );
}

function ComponentChart({
  rows,
  competitionMode,
}: {
  rows: Array<NeighborhoodMetric & { score: number }>;
  competitionMode: "broad" | "cafe";
}) {
  const components: Array<[keyof WeightState, string]> = [
    ["population_density", "Density"],
    ["young_student", "Young/student"],
    ["income", "Income"],
    ["transit", "Transit"],
    ["walk", "Walk"],
    ["parking", "Parking"],
    ["low_competition", "Low competition"],
  ];
  const colors = ["#0f766e", "#b45309", "#2563eb", "#be123c"];
  return (
    <div className="component-chart">
      {components.map(([key, label]) => (
        <div className="component-row" key={key}>
          <span>{label}</span>
          <div>
            {rows.map((row, index) => {
              const normKey =
                key === "low_competition"
                  ? competitionMode === "broad"
                    ? "low_competition_broad"
                    : "low_competition_cafe"
                  : key;
              const value = row.normalized[normKey];
              return <i key={row.neighborhood_key} style={{ width: `${value}%`, background: colors[index % colors.length] }} title={`${row.neighborhood}: ${value}`} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScatterPlot({ rows }: { rows: Array<NeighborhoodMetric & { score: number }> }) {
  const width = 520;
  const height = 300;
  const pad = 36;
  const demandValues = rows.map((row) => row.normalized.young_student);
  const compValues = rows.map((row) => row.food_establishments_per_10k_residents);
  const transitValues = rows.map((row) => row.mbta_stops_per_sqmi);
  const compMax = Math.max(...compValues, 1);
  const transitMax = Math.max(...transitValues, 1);
  return (
    <svg className="scatter" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Demand versus competition scatter plot">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} />
      <text x={width / 2} y={height - 8}>
        Young/student demand
      </text>
      <text x={8} y={24}>
        Competition
      </text>
      {rows.map((row) => {
        const x = pad + (row.normalized.young_student / Math.max(...demandValues, 1)) * (width - pad * 2);
        const y = height - pad - (row.food_establishments_per_10k_residents / compMax) * (height - pad * 2);
        const r = 4 + (row.mbta_stops_per_sqmi / transitMax) * 11;
        return (
          <circle key={row.neighborhood_key} cx={x} cy={y} r={r} opacity="0.62" fill={colorRamp(row.score / 100)}>
            <title>{`${row.neighborhood}: demand ${row.normalized.young_student}, competition ${formatNumber(
              row.food_establishments_per_10k_residents,
              1
            )}/10k residents`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function tradeoffCopy(rows: Array<NeighborhoodMetric & { score: number }>) {
  if (rows.length < 2) return "Add two to four neighborhoods to compare score components.";
  const strongest = [...rows].sort((a, b) => b.score - a.score)[0];
  const access = [...rows].sort((a, b) => b.normalized.transit - a.normalized.transit)[0];
  const competition = [...rows].sort((a, b) => b.normalized.low_competition_broad - a.normalized.low_competition_broad)[0];
  return `${strongest.neighborhood} has the strongest current weighted score. ${access.neighborhood} leads this set on transit access, while ${competition.neighborhood} has the most favorable broad competition signal.`;
}

function RankingTable({
  rows,
  sortKey,
  setSortKey,
}: {
  rows: Array<NeighborhoodMetric & { score: number }>;
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
}) {
  const headers: Array<[SortKey, string]> = [
    ["score", "Score"],
    ["population", "Population"],
    ["population_density", "Density"],
    ["food_establishments", "Food licenses"],
    ["mbta_stops", "MBTA stops"],
    ["parking_spaces", "Parking"],
    ["young_student_index", "Young/student"],
  ];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Neighborhood</th>
            {headers.map(([key, label]) => (
              <th key={key}>
                <button className={sortKey === key ? "sorted" : ""} onClick={() => setSortKey(key)}>
                  {label}
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
    <section className="info-grid">
      <article className="panel">
        <h2>Data and Methods</h2>
        <p>
          The score is a weighted sum of min-max normalized neighborhood indicators. Positive indicators get higher
          scores when the raw value is higher; competition is inverted so lower competition receives a higher component
          score. Sliders are normalized to 100% when scores are calculated.
        </p>
        <p>
          Point datasets are assigned to BPDA neighborhood polygons. Broad competition uses active food licenses per
          10,000 residents. Cafe-like competition is an approximate business-name/category text match and is shown as a
          sensitivity check.
        </p>
        <p className="small">Processed data generated: {new Date(generatedAt).toLocaleString()}</p>
      </article>
      <article className="panel">
        <h2>Sources</h2>
        <div className="source-list">
          {manifest.sources.map((source) => (
            <a key={source.key} href={source.dataset_url} target="_blank" rel="noreferrer">
              <strong>{source.name}</strong>
              <span>{source.publisher}</span>
              <span>
                Accessed {new Date(source.source_downloaded_at).toLocaleDateString()} via {source.download_method}
              </span>
              <span>{source.units}</span>
            </a>
          ))}
        </div>
      </article>
      <article className="panel limitations">
        <h2>Limitations and Assumptions</h2>
        <ul>
          <li>No rent, lease availability, buildout cost, or exact storefront data is included.</li>
          <li>Food licenses are a broad competition proxy and do not perfectly identify cafes.</li>
          <li>Neighborhood averages hide block-by-block differences and nearby anchors.</li>
          <li>MBTA stop count does not measure frequency, crowding, reliability, or ridership.</li>
          <li>Parking meters do not represent all parking supply, private lots, or curb rules.</li>
          <li>Public datasets can lag real-world openings, closures, and demographic change.</li>
        </ul>
      </article>
      <article className="panel">
        <h2>Before Leasing</h2>
        <p>
          Use the ranking to choose neighborhoods for further research, then collect storefront rents, pedestrian
          counts, nearby anchors, direct competitor menus/prices, zoning constraints, and on-the-ground observations.
          This prototype is a screening tool, not a profitability claim or real-estate recommendation.
        </p>
      </article>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
