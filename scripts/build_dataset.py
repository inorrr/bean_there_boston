#!/usr/bin/env python3
"""Build neighborhood-level metrics for the Boston cafe opportunity prototype."""

from __future__ import annotations

import csv
import json
import math
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
PUBLIC_DATA_DIR = ROOT / "public" / "data"

WGS84_MILES_PER_DEG_LAT = 69.0
CAFE_RE = re.compile(r"\b(coffee|cafe|café|espresso|tea|bakery|donut|barista|roast|boba)\b", re.I)

COMPONENTS = {
    "population_density": {"label": "Population density", "metric": "population_density", "positive": True},
    "young_student": {"label": "Young adult and student demand", "metric": "young_student_index", "positive": True},
    "income": {"label": "Higher-income household share", "metric": "higher_income_share", "positive": True},
    "transit": {"label": "Transit access", "metric": "mbta_stops_per_sqmi", "positive": True},
    "walk": {"label": "Walk commute share", "metric": "walk_commute_share", "positive": True},
    "parking": {"label": "Parking access", "metric": "parking_spaces_per_sqmi", "positive": True},
    "low_competition_broad": {"label": "Low broad competition", "metric": "food_establishments_per_10k_residents", "positive": False},
    "low_competition_cafe": {"label": "Low cafe-like competition", "metric": "cafe_like_per_10k_residents", "positive": False},
}

DEFAULT_WEIGHTS = {
    "population_density": 20,
    "young_student": 20,
    "income": 15,
    "transit": 20,
    "walk": 10,
    "parking": 5,
    "low_competition": 10,
}

NAME_ALIASES = {
    "allston": "allston",
    "back bay": "back bay",
    "bay village": "bay village",
    "beacon hill": "beacon hill",
    "brighton": "brighton",
    "charlestown": "charlestown",
    "chinatown": "chinatown",
    "downtown": "downtown",
    "downtown / financial district": "downtown",
    "downtown/financial district": "downtown",
    "dorchester": "dorchester",
    "east boston": "east boston",
    "fenway": "fenway",
    "fenway/kenmore": "fenway",
    "hyde park": "hyde park",
    "jamaica plain": "jamaica plain",
    "leather district": "leather district",
    "longwood": "longwood",
    "mattapan": "mattapan",
    "mission hill": "mission hill",
    "north end": "north end",
    "roslindale": "roslindale",
    "roxbury": "roxbury",
    "south boston": "south boston",
    "south boston waterfront": "south boston waterfront",
    "south end": "south end",
    "west end": "west end",
    "west roxbury": "west roxbury",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def key_name(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return NAME_ALIASES.get(text, text)


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "").replace("%", "")
    if text == "":
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def lower_record(record: dict[str, Any]) -> dict[str, Any]:
    return {str(k).strip().lower(): v for k, v in record.items()}


def iter_positions(geometry: dict) -> list[tuple[float, float]]:
    coords = geometry.get("coordinates", [])
    if geometry.get("type") == "Polygon":
        rings = coords
    elif geometry.get("type") == "MultiPolygon":
        rings = [ring for polygon in coords for ring in polygon]
    else:
        rings = []
    points: list[tuple[float, float]] = []
    for ring in rings:
        points.extend((float(lon), float(lat)) for lon, lat, *_ in ring)
    return points


def ring_area_sqmi(ring: list[list[float]]) -> float:
    if len(ring) < 3:
        return 0
    avg_lat = sum(point[1] for point in ring) / len(ring)
    x_scale = WGS84_MILES_PER_DEG_LAT * math.cos(math.radians(avg_lat))
    y_scale = WGS84_MILES_PER_DEG_LAT
    projected = [(point[0] * x_scale, point[1] * y_scale) for point in ring]
    area = 0.0
    for (x1, y1), (x2, y2) in zip(projected, projected[1:] + projected[:1]):
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def geometry_area_sqmi(geometry: dict) -> float:
    if geometry.get("type") == "Polygon":
        polygons = [geometry.get("coordinates", [])]
    elif geometry.get("type") == "MultiPolygon":
        polygons = geometry.get("coordinates", [])
    else:
        return 0
    total = 0.0
    for polygon in polygons:
        if not polygon:
            continue
        total += ring_area_sqmi(polygon[0])
        for hole in polygon[1:]:
            total -= ring_area_sqmi(hole)
    return max(total, 0.001)


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersects = ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def point_in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    polygons = [geometry.get("coordinates", [])] if geometry.get("type") == "Polygon" else geometry.get("coordinates", [])
    for polygon in polygons:
        if not polygon or not point_in_ring(lon, lat, polygon[0]):
            continue
        if any(point_in_ring(lon, lat, hole) for hole in polygon[1:]):
            continue
        return True
    return False


def load_neighborhoods() -> tuple[list[dict], dict[str, str]]:
    geojson = json.loads((RAW_DIR / "neighborhood_boundaries.geojson").read_text(encoding="utf-8"))
    features = geojson.get("features", [])
    name_field_report: dict[str, str] = {}
    neighborhoods = []
    for feature in features:
        properties = feature.get("properties", {})
        lowered = {str(k).lower(): k for k in properties.keys()}
        name_field = (
            lowered.get("name")
            or lowered.get("neighborhood")
            or lowered.get("nbhd")
            or lowered.get("neighborhoods")
            or next(iter(properties.keys()))
        )
        name = str(properties.get(name_field, "")).strip()
        key = key_name(name)
        geometry = feature["geometry"]
        positions = iter_positions(geometry)
        min_lon = min(p[0] for p in positions)
        max_lon = max(p[0] for p in positions)
        min_lat = min(p[1] for p in positions)
        max_lat = max(p[1] for p in positions)
        area = geometry_area_sqmi(geometry)
        neighborhoods.append(
            {
                "name": name,
                "key": key,
                "geometry": geometry,
                "bbox": (min_lon, min_lat, max_lon, max_lat),
                "area_sqmi": area,
            }
        )
        name_field_report[key] = str(name_field)
    return neighborhoods, name_field_report


def find_neighborhood(lon: float, lat: float, neighborhoods: list[dict]) -> str | None:
    for nbhd in neighborhoods:
        min_lon, min_lat, max_lon, max_lat = nbhd["bbox"]
        if lon < min_lon or lon > max_lon or lat < min_lat or lat > max_lat:
            continue
        if point_in_geometry(lon, lat, nbhd["geometry"]):
            return nbhd["key"]
    return None


def metric_sum(record: dict[str, Any], fields: list[str]) -> float:
    return sum(parse_float(record.get(field)) or 0 for field in fields)


def first_number(record: dict[str, Any], candidates: list[str]) -> float:
    for field in candidates:
        value = parse_float(record.get(field))
        if value is not None:
            return value
    return 0.0


def build_demographics(metrics: dict[str, dict], report: dict) -> None:
    rows = [lower_record(row) for row in read_csv(RAW_DIR / "population_estimates.csv")]
    report["source_counts"]["population_rows"] = len(rows)
    if not rows:
        return
    years = [parse_float(row.get("year")) for row in rows if parse_float(row.get("year")) is not None]
    latest_year = int(max(years)) if years else None
    if latest_year:
        rows = [row for row in rows if int(parse_float(row.get("year")) or 0) == latest_year]
    report["source_counts"]["population_rows_used"] = len(rows)
    report["population_year_used"] = latest_year

    student_fields = [
        "education_b14002_021e",
        "education_b14002_025e",
        "education_b14002_045e",
        "education_b14002_049e",
    ]
    income_fields = [
        "income_b19037_75k_to_99999",
        "income_b19037_100k_to_124999",
        "income_b19037_125k_to_149999",
        "income_b19037_150k_to_199999",
        "income_b19037_200k_plus",
    ]
    unmatched = []
    for row in rows:
        key = key_name(row.get("name"))
        if key not in metrics:
            unmatched.append(row.get("name", ""))
            continue
        population = first_number(row, ["population_b01001_001e", "population_b03002_001e", "total_population"])
        area = first_number(row, ["arealand_sqmi"]) or metrics[key]["area_sqmi"]
        young = metric_sum(row, ["population_b01001_male20_to_24years", "population_b01001_female20_to_24years"])
        student = metric_sum(row, student_fields)
        education_total = first_number(row, ["education_b14002_001e"])
        income_total = first_number(row, ["income_b19037_001e"])
        higher_income = metric_sum(row, income_fields)
        commuters = first_number(row, ["labor_b08301_001e"])
        transit = first_number(row, ["labor_b08301_010e"])
        walk = first_number(row, ["labor_b08301_019e"])

        metrics[key].update(
            {
                "population": population,
                "area_sqmi": area,
                "population_density": population / area if area else 0,
                "young_adult_share": young / population if population else 0,
                "student_share": student / education_total if education_total else 0,
                "young_student_index": ((young / population) if population else 0) * 0.5
                + ((student / education_total) if education_total else 0) * 0.5,
                "higher_income_share": higher_income / income_total if income_total else 0,
                "transit_commute_share": transit / commuters if commuters else 0,
                "walk_commute_share": walk / commuters if commuters else 0,
            }
        )
    report["unmatched_population_neighborhoods"] = sorted(set(unmatched))


def build_food(metrics: dict[str, dict], neighborhoods: list[dict], report: dict, point_layers: dict[str, list[dict]]) -> None:
    rows = [lower_record(row) for row in read_csv(RAW_DIR / "food_licenses.csv")]
    report["source_counts"]["food_license_rows"] = len(rows)
    active = 0
    joined = 0
    for row in rows:
        if str(row.get("licstatus", "")).strip().lower() != "active":
            continue
        lat = parse_float(row.get("latitude"))
        lon = parse_float(row.get("longitude"))
        if lat is None or lon is None or not (-72 < lon < -70) or not (41 < lat < 43):
            continue
        active += 1
        key = find_neighborhood(lon, lat, neighborhoods)
        if not key:
            continue
        joined += 1
        metrics[key]["food_establishments"] += 1
        text = " ".join(str(row.get(field, "")) for field in ["businessname", "dbaname", "descript", "licensecat"])
        name = str(row.get("dbaname") or row.get("businessname") or "Food license").strip()
        category = str(row.get("descript") or row.get("licensecat") or "Active food establishment").strip()
        point = {"lat": round(lat, 6), "lon": round(lon, 6), "name": name, "neighborhood_key": key, "category": category}
        point_layers["food_licenses"].append(point)
        if CAFE_RE.search(text):
            metrics[key]["cafe_like_establishments"] += 1
            point_layers["cafe_like"].append(point)
    report["source_counts"]["active_food_license_rows_with_coordinates"] = active
    report["source_counts"]["food_license_rows_joined"] = joined


def build_parking(metrics: dict[str, dict], neighborhoods: list[dict], report: dict, point_layers: dict[str, list[dict]]) -> None:
    rows = [lower_record(row) for row in read_csv(RAW_DIR / "parking_meters.csv")]
    report["source_counts"]["parking_meter_rows"] = len(rows)
    active = 0
    joined = 0
    for row in rows:
        state = f"{row.get('meter_state', '')} {row.get('space_state', '')}".lower()
        if "active" not in state and state.strip():
            continue
        lat = parse_float(row.get("latitude") or row.get("point_y"))
        lon = parse_float(row.get("longitude") or row.get("point_x"))
        if lat is None or lon is None or not (-72 < lon < -70) or not (41 < lat < 43):
            continue
        active += 1
        key = find_neighborhood(lon, lat, neighborhoods)
        if not key:
            continue
        spaces = parse_float(row.get("numberofspaces")) or 1
        metrics[key]["parking_spaces"] += spaces
        joined += 1
    report["source_counts"]["active_parking_rows_with_coordinates"] = active
    report["source_counts"]["parking_rows_joined"] = joined


def build_mbta(metrics: dict[str, dict], neighborhoods: list[dict], report: dict, point_layers: dict[str, list[dict]]) -> None:
    with zipfile.ZipFile(RAW_DIR / "MBTA_GTFS.zip") as archive:
        with archive.open("stops.txt") as fh:
            rows = list(csv.DictReader((line.decode("utf-8-sig") for line in fh)))
    report["source_counts"]["mbta_stop_rows"] = len(rows)
    joined = 0
    station_like = 0
    seen_station_ids: set[str] = set()
    for original in rows:
        row = lower_record(original)
        lat = parse_float(row.get("stop_lat"))
        lon = parse_float(row.get("stop_lon"))
        if lat is None or lon is None or not (-72 < lon < -70) or not (41 < lat < 43):
            continue
        key = find_neighborhood(lon, lat, neighborhoods)
        if not key:
            continue
        metrics[key]["mbta_stops"] += 1
        point = {
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "name": str(row.get("stop_name") or "MBTA stop").strip(),
            "neighborhood_key": key,
        }
        vehicle_type = str(row.get("vehicle_type", "")).strip()
        location_type = str(row.get("location_type", "")).strip()
        if vehicle_type == "3":
            point_layers["mbta_bus_stops"].append(point)
        elif vehicle_type or location_type in {"1", "2"}:
            point_layers["mbta_train_stops"].append(point)
        joined += 1
        location_type = str(row.get("location_type", "")).strip()
        parent_station = str(row.get("parent_station", "")).strip()
        stop_id = str(row.get("stop_id", "")).strip()
        if location_type in {"1", "2"} or (not parent_station and stop_id not in seen_station_ids):
            metrics[key]["mbta_station_like_stops"] += 1
            seen_station_ids.add(stop_id)
            station_like += 1
    report["source_counts"]["mbta_stop_rows_joined"] = joined
    report["source_counts"]["mbta_station_like_rows_joined"] = station_like


def normalize(values: list[float], positive: bool = True) -> list[float]:
    low = min(values) if values else 0
    high = max(values) if values else 0
    if math.isclose(low, high):
        base = [50.0 for _ in values]
    else:
        base = [100 * (value - low) / (high - low) for value in values]
    if not positive:
        base = [100 - value for value in base]
    return [round(value, 2) for value in base]


def finalize(metrics: dict[str, dict]) -> list[dict]:
    rows = list(metrics.values())
    for row in rows:
        population = row.get("population", 0) or 0
        area = row.get("area_sqmi", 0) or 0.001
        row["food_establishments_per_10k_residents"] = row["food_establishments"] / population * 10000 if population else 0
        row["food_establishments_per_sqmi"] = row["food_establishments"] / area
        row["cafe_like_per_10k_residents"] = row["cafe_like_establishments"] / population * 10000 if population else 0
        row["mbta_stops_per_sqmi"] = row["mbta_stops"] / area
        row["parking_spaces_per_sqmi"] = row["parking_spaces"] / area

    for component_key, config in COMPONENTS.items():
        values = [float(row.get(config["metric"], 0) or 0) for row in rows]
        scores = normalize(values, positive=bool(config["positive"]))
        for row, score in zip(rows, scores):
            row.setdefault("normalized", {})[component_key] = score

    for row in rows:
        norm = row["normalized"]
        broad_score = (
            DEFAULT_WEIGHTS["population_density"] * norm["population_density"]
            + DEFAULT_WEIGHTS["young_student"] * norm["young_student"]
            + DEFAULT_WEIGHTS["income"] * norm["income"]
            + DEFAULT_WEIGHTS["transit"] * norm["transit"]
            + DEFAULT_WEIGHTS["walk"] * norm["walk"]
            + DEFAULT_WEIGHTS["parking"] * norm["parking"]
            + DEFAULT_WEIGHTS["low_competition"] * norm["low_competition_broad"]
        ) / 100
        row["default_opportunity_score"] = round(broad_score, 1)

    return sorted(rows, key=lambda item: item["default_opportunity_score"], reverse=True)


def feature_collection(neighborhoods: list[dict], metrics: dict[str, dict]) -> dict:
    features = []
    for nbhd in neighborhoods:
        metric = metrics[nbhd["key"]]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "neighborhood": metric["neighborhood"],
                    "neighborhood_key": metric["neighborhood_key"],
                    "default_opportunity_score": metric.get("default_opportunity_score", 0),
                },
                "geometry": nbhd["geometry"],
            }
        )
    return {"type": "FeatureCollection", "features": features}


def point_layer_collection(point_layers: dict[str, list[dict]]) -> dict:
    layer_meta = {
        "food_licenses": {
            "label": "Food licenses",
            "description": "Active food establishment licenses with usable coordinates.",
        },
        "cafe_like": {
            "label": "Cafe-like competitors",
            "description": "Active food licenses whose name or category text suggests coffee, tea, bakery, or similar cafe concepts.",
        },
        "mbta_bus_stops": {
            "label": "MBTA bus stops",
            "description": "MBTA GTFS stops with bus vehicle type within Boston neighborhood boundaries.",
        },
        "mbta_train_stops": {
            "label": "MBTA train and rail stops",
            "description": "MBTA GTFS subway, rail, ferry, and station-like stops within Boston neighborhood boundaries.",
        },
    }
    return {
        "generated_at": now_iso(),
        "layers": [
            {
                "key": key,
                "label": meta["label"],
                "description": meta["description"],
                "count": len(point_layers[key]),
                "points": point_layers[key],
            }
            for key, meta in layer_meta.items()
        ],
    }


def main() -> int:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    neighborhoods, name_fields = load_neighborhoods()
    report = {
        "generated_at": now_iso(),
        "source_counts": {},
        "boundary_name_fields": name_fields,
        "warnings": [],
    }
    metrics = {
        nbhd["key"]: {
            "neighborhood": nbhd["name"],
            "neighborhood_key": nbhd["key"],
            "area_sqmi": nbhd["area_sqmi"],
            "population": 0,
            "population_density": 0,
            "young_adult_share": 0,
            "student_share": 0,
            "young_student_index": 0,
            "higher_income_share": 0,
            "transit_commute_share": 0,
            "walk_commute_share": 0,
            "food_establishments": 0,
            "cafe_like_establishments": 0,
            "mbta_stops": 0,
            "mbta_station_like_stops": 0,
            "parking_spaces": 0,
        }
        for nbhd in neighborhoods
    }
    point_layers: dict[str, list[dict]] = {
        "food_licenses": [],
        "cafe_like": [],
        "mbta_bus_stops": [],
        "mbta_train_stops": [],
    }

    build_demographics(metrics, report)
    build_food(metrics, neighborhoods, report, point_layers)
    build_mbta(metrics, neighborhoods, report, point_layers)
    build_parking(metrics, neighborhoods, report, point_layers)
    rows = finalize(metrics)

    metadata = {
        "generated_at": now_iso(),
        "methodology": "Neighborhood-level public-data prototype. Scores are min-max normalized across Boston neighborhoods and recomputed in the browser when weights change.",
        "default_weights": DEFAULT_WEIGHTS,
        "components": COMPONENTS,
        "competition_modes": {
            "broad": "Food establishments per 10,000 residents, from active food licenses.",
            "cafe": "Approximate cafe-like text match per 10,000 residents using business name/category terms.",
        },
    }
    output = {"metadata": metadata, "neighborhoods": rows}
    (PROCESSED_DIR / "neighborhood_metrics.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    (PUBLIC_DATA_DIR / "neighborhood_metrics.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    boundaries = feature_collection(neighborhoods, metrics)
    (PROCESSED_DIR / "neighborhood_boundaries.geojson").write_text(json.dumps(boundaries), encoding="utf-8")
    (PUBLIC_DATA_DIR / "neighborhood_boundaries.geojson").write_text(json.dumps(boundaries), encoding="utf-8")
    map_points = point_layer_collection(point_layers)
    (PROCESSED_DIR / "map_points.json").write_text(json.dumps(map_points, indent=2), encoding="utf-8")
    (PUBLIC_DATA_DIR / "map_points.json").write_text(json.dumps(map_points, indent=2), encoding="utf-8")
    (PROCESSED_DIR / "build_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Built {len(rows)} neighborhoods")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
