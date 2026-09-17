#!/usr/bin/env python3
"""Fetch and cache public data for the Boston cafe opportunity prototype."""

from __future__ import annotations

import csv
import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PUBLIC_DATA_DIR = ROOT / "public" / "data"
MANIFEST_PATH = RAW_DIR / "source_manifest.json"

USER_AGENT = "bean-there-boston-class-project/0.1"

SOURCES = [
    {
        "key": "food_licenses",
        "name": "Active Food Establishment Licenses",
        "publisher": "City of Boston Analyze Boston",
        "url": "https://data.boston.gov/dataset/5e4182e3-ba1e-4511-88f8-08a70383e1b6/resource/f1e13724-284d-478c-b8bc-ef042aa5b70b/download/tmpnwx54fxe.csv",
        "fallback": "https://data.boston.gov/api/3/action/datastore_search",
        "resource_id": "f1e13724-284d-478c-b8bc-ef042aa5b70b",
        "filename": "food_licenses.csv",
        "format": "csv",
        "units": "licensed food establishment records",
        "fields": ["businessname", "dbaname", "licstatus", "licensecat", "descript", "latitude", "longitude"],
    },
    {
        "key": "neighborhood_boundaries",
        "name": "BPDA Neighborhood Boundaries",
        "publisher": "Boston Planning and Development Agency",
        "url": "https://data.boston.gov/dataset/bf1a7b50-4c72-4637-b0fa-11d632e3aff1/resource/e5849875-a6f6-4c9c-9d8a-5048b0fbd03e/download/boston_neighborhood_boundaries.geojson",
        "geojson_fallback": "https://gis.bostonplans.org/hosting/rest/services/Hosted/Boston_Neighborhood_Boundaries/FeatureServer/5/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
        "filename": "neighborhood_boundaries.geojson",
        "format": "geojson",
        "units": "neighborhood polygons",
        "fields": ["neighborhood name", "geometry"],
    },
    {
        "key": "population_estimates",
        "name": "2025 Boston Population Estimates, Neighborhood Level",
        "publisher": "City of Boston Analyze Boston",
        "url": "https://data.boston.gov/dataset/d2ece0af-e0ad-42e4-b280-bd0aa1561ed0/resource/b0543358-d03f-4682-bf0c-658ea4573d6f/download/boston_population_estimates_2025_neighborhood_level.csv",
        "fallback": "https://data.boston.gov/api/3/action/datastore_search",
        "resource_id": "b0543358-d03f-4682-bf0c-658ea4573d6f",
        "filename": "population_estimates.csv",
        "format": "csv",
        "units": "neighborhood demographic estimates",
        "fields": ["name", "year", "population", "age", "education", "income", "commute mode"],
    },
    {
        "key": "mbta_gtfs",
        "name": "MBTA GTFS",
        "publisher": "Massachusetts Bay Transportation Authority",
        "url": "https://cdn.mbta.com/MBTA_GTFS.zip",
        "filename": "MBTA_GTFS.zip",
        "format": "zip",
        "units": "transit stop records",
        "fields": ["stops.txt"],
    },
    {
        "key": "parking_meters",
        "name": "Parking Meters",
        "publisher": "City of Boston Analyze Boston",
        "url": "https://data.boston.gov/dataset/144e2003-ca70-492b-874e-76cc7355e7e3/resource/df6dac6b-e484-470d-8757-6ecae4e04f2a/download/parking_meters.csv",
        "fallback": "https://data.boston.gov/api/3/action/datastore_search",
        "resource_id": "df6dac6b-e484-470d-8757-6ecae4e04f2a",
        "filename": "parking_meters.csv",
        "format": "csv",
        "units": "parking meter and space records",
        "fields": ["METER_ID", "LATITUDE", "LONGITUDE", "NUMBEROFSPACES", "METER_STATE", "SPACE_STATE"],
    },
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def request_url(url: str, timeout: int = 120) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def download_direct(source: dict, destination: Path) -> tuple[str, str]:
    data = request_url(source["url"])
    destination.write_bytes(data)
    return source["url"], "direct"


def fetch_ckan_csv(source: dict, destination: Path) -> tuple[str, str]:
    all_records: list[dict] = []
    offset = 0
    limit = 50000
    while True:
        query = urllib.parse.urlencode(
            {"resource_id": source["resource_id"], "limit": limit, "offset": offset}
        )
        url = f"{source['fallback']}?{query}"
        payload = json.loads(request_url(url).decode("utf-8"))
        if not payload.get("success"):
            raise RuntimeError(f"CKAN request failed for {source['key']}")
        records = payload["result"].get("records", [])
        all_records.extend(records)
        if len(records) < limit:
            break
        offset += limit
        time.sleep(0.2)

    fieldnames: list[str] = []
    for record in all_records:
        for field in record.keys():
            if field not in fieldnames:
                fieldnames.append(field)

    with destination.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_records)

    return f"{source['fallback']}?resource_id={source['resource_id']}", "ckan_datastore_api"


def fetch_geojson_fallback(source: dict, destination: Path) -> tuple[str, str]:
    fallback = source["geojson_fallback"]
    data = request_url(fallback)
    parsed = json.loads(data.decode("utf-8"))
    if parsed.get("type") != "FeatureCollection":
        raise RuntimeError(f"GeoJSON fallback for {source['key']} did not return a FeatureCollection")
    destination.write_text(json.dumps(parsed), encoding="utf-8")
    return fallback, "arcgis_feature_service_geojson"


def fetch_source(source: dict) -> dict:
    destination = RAW_DIR / source["filename"]
    source_url = source["url"]
    method = "cached"
    error: str | None = None

    try:
        source_url, method = download_direct(source, destination)
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        if source.get("fallback") and source.get("format") == "csv":
            source_url, method = fetch_ckan_csv(source, destination)
        elif source.get("geojson_fallback") and source.get("format") == "geojson":
            source_url, method = fetch_geojson_fallback(source, destination)
        elif destination.exists():
            method = "cached_after_download_error"
        else:
            raise

    return {
        "key": source["key"],
        "name": source["name"],
        "publisher": source["publisher"],
        "dataset_url": source["url"],
        "source_url_used": source_url,
        "download_method": method,
        "source_downloaded_at": now_iso(),
        "filename": str(destination.relative_to(ROOT)),
        "file_size_bytes": destination.stat().st_size,
        "sha256": sha256(destination),
        "format": source["format"],
        "units": source["units"],
        "fields": source["fields"],
        "download_error": error,
    }


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {"generated_at": now_iso(), "sources": []}

    for source in SOURCES:
        print(f"Fetching {source['name']}...")
        try:
            manifest["sources"].append(fetch_source(source))
        except Exception as exc:
            print(f"ERROR: failed to fetch {source['key']}: {exc}", file=sys.stderr)
            return 1

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (PUBLIC_DATA_DIR / "source_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(f"Wrote {MANIFEST_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
