#!/usr/bin/env python3
"""Validate processed data for the Boston cafe opportunity prototype."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / "data" / "processed"
PUBLIC_DATA_DIR = ROOT / "public" / "data"

REQUIRED_METRICS = [
    "neighborhood",
    "population",
    "population_density",
    "young_adult_share",
    "student_share",
    "higher_income_share",
    "walk_commute_share",
    "food_establishments",
    "food_establishments_per_10k_residents",
    "cafe_like_establishments",
    "mbta_stops",
    "mbta_stops_per_sqmi",
    "parking_spaces",
    "parking_spaces_per_sqmi",
    "normalized",
    "default_opportunity_score",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def main() -> int:
    metrics_path = PUBLIC_DATA_DIR / "neighborhood_metrics.json"
    boundaries_path = PUBLIC_DATA_DIR / "neighborhood_boundaries.geojson"
    manifest_path = PUBLIC_DATA_DIR / "source_manifest.json"
    errors: list[str] = []
    warnings: list[str] = []

    if not metrics_path.exists():
        errors.append("Missing public/data/neighborhood_metrics.json")
        neighborhoods = []
    else:
        metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
        neighborhoods = metrics.get("neighborhoods", [])

    if not boundaries_path.exists():
        errors.append("Missing public/data/neighborhood_boundaries.geojson")
        features = []
    else:
        boundaries = json.loads(boundaries_path.read_text(encoding="utf-8"))
        features = boundaries.get("features", [])

    if not manifest_path.exists():
        errors.append("Missing public/data/source_manifest.json")
        sources = []
    else:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        sources = manifest.get("sources", [])

    if len(neighborhoods) < 15:
        errors.append(f"Expected at least 15 neighborhoods, found {len(neighborhoods)}")
    if len(features) != len(neighborhoods):
        errors.append(f"Boundary feature count {len(features)} does not match metric count {len(neighborhoods)}")
    if len(sources) < 5:
        errors.append(f"Expected at least 5 source manifest entries, found {len(sources)}")

    geometry_keys = {feature.get("properties", {}).get("neighborhood_key") for feature in features}
    for row in neighborhoods:
        missing = [field for field in REQUIRED_METRICS if field not in row]
        if missing:
            errors.append(f"{row.get('neighborhood', 'Unknown')} missing fields: {', '.join(missing)}")
        if row.get("neighborhood_key") not in geometry_keys:
            errors.append(f"{row.get('neighborhood')} has metrics but no geometry")
        if not isinstance(row.get("normalized"), dict) or len(row["normalized"]) < 7:
            errors.append(f"{row.get('neighborhood')} has incomplete normalized score components")
        if row.get("population", 0) == 0:
            warnings.append(f"{row.get('neighborhood')} has zero population in processed metrics")

    report = {
        "validated_at": now_iso(),
        "neighborhood_count": len(neighborhoods),
        "boundary_feature_count": len(features),
        "source_count": len(sources),
        "top_default_neighborhoods": [
            {
                "neighborhood": row.get("neighborhood"),
                "score": row.get("default_opportunity_score"),
            }
            for row in sorted(neighborhoods, key=lambda item: item.get("default_opportunity_score", 0), reverse=True)[:5]
        ],
        "warnings": warnings,
        "errors": errors,
    }
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    (PROCESSED_DIR / "validation_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
