---
name: Maps and geospatial UI
description: Rules for map-related files
applyTo: "src/components/map/**/*.tsx,src/features/map/**/*.tsx,src/pages/**/*Map*.tsx"
---

# Map instructions

- Use Leaflet for world map rendering.
- Display selected locations as markers.
- Fit bounds to selected locations automatically.
- Show city name, country, and selected metric in marker popups.
- Keep legends visible and easy to read.
- Prefer simple point mapping for MVP.
- Avoid advanced GIS interpolation, contouring, or raster analysis in MVP.
- Keep map interactions clear enough for classroom use.
- The map layer should consume already-decoded plain location and climate summary objects, not raw Open-Meteo SDK response objects.
- Keep attribution visible in or near the map view.