# One-Page Data and Methodology Note

## Project

**Bean There Boston** asks: *Where should someone consider opening a new cafe in Boston?* The intended user is a student analyst, small-business planner, or early-stage cafe founder who wants to screen Boston neighborhoods before doing site visits. The tool supports neighborhood-level exploration, not profitability forecasting or storefront selection.

## Data Collected

The project uses public, non-sensitive datasets only. The processed dataset contains 26 Boston neighborhoods and combines:

- City of Boston Active Food Establishment Licenses, accessed September 17, 2026; units: licensed food establishment records.
- BPDA Neighborhood Boundaries, accessed September 17, 2026; units: neighborhood polygons.
- City of Boston 2025 Population Estimates, Neighborhood Level, accessed September 17, 2026; units: neighborhood demographic estimates.
- MBTA GTFS, accessed September 17, 2026; units: transit stop records.
- City of Boston Parking Meters, accessed September 17, 2026; units: parking meter and space records.

Some direct CSV downloads returned `403 Forbidden`, so the fetch script used the CKAN datastore API fallback for Boston CSV resources. The BPDA boundary file used the public ArcGIS FeatureServer GeoJSON endpoint. The source manifest records source URLs, fetch timestamps, hashes, fields, units, and download methods.

## Processing Method

Neighborhood boundaries are the common geography. Point records for food licenses, MBTA stops, and parking meters are assigned to neighborhoods using a point-in-polygon join. Demographic estimates are joined by neighborhood name. The dataset is then transformed into indicators for demand, access, competition, and convenience:

- Demand: population density, young adult share, student share, and higher-income household share.
- Access: MBTA stops per square mile, transit commute share, and walk commute share.
- Competition: active food establishments per 10,000 residents, plus cafe-like establishments per 10,000 residents.
- Convenience: parking spaces per square mile.

The Cafe Opportunity Score is a weighted sum of min-max normalized indicators from 0 to 100. Higher values are better for demand, access, income, walking, and parking. Competition is inverted so lower measured competition receives a higher component score. User sliders are normalized to 100% before calculating the score. The map also displays optional point layers for food licenses, cafe-like establishments, MBTA bus stops, and MBTA train stops so users can inspect activity inside large neighborhoods without changing the neighborhood-level score.

## Main Findings

Under the default weights, the top neighborhoods are West End (71.5), Beacon Hill (66.5), Downtown (63.9), North End (63.0), and Back Bay (60.7). West End ranks first because it combines very high density, strong MBTA access, and a relatively favorable competition signal. Beacon Hill is a strong second option with high density, high young/student demand, and lower broad food-license competition than Downtown. Downtown has excellent transit access and demand, but measured food-license competition is much higher. The comparison views add a second way to read the data by highlighting neighborhood archetypes, component signal mixes, and opportunity gaps between overall demand and cafe-like competition.

## Limitations

The analysis does not include rent, lease availability, buildout cost, foot traffic, storefront size, zoning, real-time openings/closures, prices, menu overlap, or profitability. Food licenses are a broad proxy and can overstate cafe competition. Cafe-like competition is based on text matching and is not a verified business taxonomy. Neighborhood averages hide block-level variation. MBTA stop counts do not measure frequency, reliability, crowding, or ridership. Public datasets can lag real-world conditions. Leather District, Bay Village, and Harbor Islands have zero population in the demographic source used here, so demographic indicators for those neighborhoods should be interpreted cautiously.
