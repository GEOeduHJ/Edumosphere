---
mode: agent
description: Build the MVP climate platform for geography teachers using Open-Meteo
---

[ROLE]
You are a senior frontend engineer and data visualization developer.

[PROJECT CONTEXT]
- This project is a web-based climate data platform for geography teachers.
- The uploaded spreadsheet is reference material for UI and workflow ideas only.
- Real runtime data must come from Open-Meteo APIs.
- The app must work as a browser-based MVP without login.
- UI language must be Korean.

[OPEN-METEO IMPLEMENTATION RULES]
- Use the official Open-Meteo TypeScript SDK (`openmeteo`) for weather and historical weather retrieval where compatible.
- The SDK uses `fetchWeatherApi` and is optimized for efficient weather data transfer and parsing.
- The SDK supports multiple locations in a single request.
- The SDK includes retry support and can accept fetch options.
- Support AbortController-based cancellation for weather requests.
- Keep Geocoding API access as a separate client module because place search is a separate API concern.
- Add visible source attribution such as "Weather data by Open-Meteo.com".

[CORE GOAL]
Build an MVP with these 4 features:
1. 데이터 설정
2. 데이터 및 그래프 열람
3. 지점 간 비교
4. 지도화

[MANDATORY DATA RULES]
- Use Open-Meteo Geocoding API for location search.
- Use Open-Meteo weather/historical endpoints through the TypeScript SDK where possible.
- Aggregate daily data into monthly and yearly summaries inside the app.
- Do not use spreadsheet files as runtime data.
- Do not hardcode city lists.
- Keep Geocoding and weather retrieval in separate API modules.
- Add visible source attribution in the UI.

[TECH STACK]
- React + TypeScript + Vite
- Plotly for charts
- Leaflet for maps
- Responsive UI
- Clean component-based architecture

[FEATURE REQUIREMENTS]

1. 데이터 설정
- City search input
- Search result candidate list
- Country and administrative area display
- Start year and end year input
- Metric selection
- Shared app state for selected locations and options

2. 데이터 및 그래프 열람
- Metadata card for selected location
- Monthly summary table
- Yearly summary table
- Climate chart
- Trend chart
- Summary cards
- CSV export
- Visible Open-Meteo attribution

3. 지점 간 비교
- Compare 2 to 4 locations
- Same period comparison
- Same metric comparison
- Comparison table
- Overlay chart
- Difference cards

4. 지도화
- World map with markers
- Popup with city, country, and selected metric
- Variable selector
- Legend
- Fit bounds to selected points

[ARCHITECTURE REQUIREMENTS]
- Separate API layer, aggregation utilities, types, hooks, and UI components
- Use typed interfaces for location, daily weather, monthly aggregate, and yearly aggregate
- Add loading, empty, and error states
- Keep aggregation logic reusable and pure
- Keep attribution rendering reusable as a shared component or footer block
- Decode SDK responses into app-friendly plain objects before they reach UI components

[DELIVERABLE FORMAT]
Provide:
1. implementation strategy
2. folder structure
3. data model
4. API module design
5. file-by-file code
6. setup commands
7. run instructions
8. extension points