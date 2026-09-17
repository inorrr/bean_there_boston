# Five-Minute Presentation: Bean There Boston

## Slide 1: Question and User

**Question:** Where should someone consider opening a new cafe in Boston?

**User:** A small cafe founder or student analyst doing early neighborhood screening before site visits.

**Important boundary:** This is not a profit forecast and does not recommend an exact storefront.

## Slide 2: Data Collected

I used public, neighborhood-level Boston data:

- Active food establishment licenses for competition.
- BPDA neighborhood boundaries for geography.
- 2025 Boston population estimates for demand and demographics.
- MBTA GTFS stops for transit access.
- Parking meter data for short-term parking access.

The scripts cache raw files, record source URLs and hashes, and use CKAN or ArcGIS API fallbacks when direct downloads are blocked.

## Slide 3: How the Score Works

The Cafe Opportunity Score combines seven normalized factors:

- Population density.
- Young adult and student demand.
- Higher-income household share.
- Transit access.
- Walk commute share.
- Parking access.
- Low competition.

Users can change the weights, choose presets, and switch the competition definition. The score updates in the browser, so the ranking changes as assumptions change.

## Slide 4: Site Walkthrough

Demonstrate:

1. The hero indicators: 26 neighborhoods, top score, and data sources.
2. The interactive map colored by opportunity score.
3. The top-three recommendation cards.
4. The weight sliders and presets.
5. The comparison panel and ranking table.
6. The sources and limitations section.

## Slide 5: Main Findings

Under the default weights:

- West End ranks first with a score of 71.5 because it combines high density, strong MBTA access, and relatively favorable broad competition.
- Beacon Hill ranks second with a score of 66.5 and is a strong candidate for a neighborhood cafe concept.
- Downtown ranks third with a score of 63.9 because access and demand are strong, but food-license competition is much higher.
- North End and Back Bay also score strongly but need extra on-the-ground competitor checks.

## Slide 6: Recommendations

Recommendation 1: Prioritize West End and Beacon Hill for early site visits. They combine strong density and access with useful demand signals.

Recommendation 2: Treat Downtown as a high-access but high-competition option. It may fit a grab-and-go concept, but direct competitor menus, rents, and foot traffic should be checked before moving forward.

Recommendation 3: Use Longwood, Fenway, Mission Hill, and Allston for a student-focused sensitivity check. These neighborhoods rank highly on young/student demand, even if they are not all top-five under the default score.

## Slide 7: What the Data Cannot Prove

The data can support neighborhood screening, but it cannot prove profitability. It does not include rent, exact storefront availability, lease terms, pedestrian counts, business costs, zoning constraints, or real-time competitor openings and closures. The output should guide field research, not replace it.

## Suggested Live Demo Timing

- 0:00-0:45: Introduce the question, user, and limits.
- 0:45-1:30: Explain the datasets and score.
- 1:30-3:30: Demonstrate the map, controls, comparison chart, and table.
- 3:30-4:30: Explain findings and recommendations.
- 4:30-5:00: End with limitations and next steps.
