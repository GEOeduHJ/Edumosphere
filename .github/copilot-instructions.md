# Project-wide Copilot Instructions

## Project Goal
- Build a web-based climate data platform for geography teachers.
- The platform uses live climate and weather data from Open-Meteo.
- The uploaded spreadsheet is for reference only and must not be used as a runtime data source.

## Product Scope
Main MVP features:
1. 데이터 설정
2. 데이터 및 그래프 열람
3. 지점 간 비교
4. 지도화

## Open-Meteo Usage Rules
- Use the hosted Open-Meteo APIs for runtime data access.
- For weather and historical weather retrieval, prefer the official Open-Meteo TypeScript SDK (`openmeteo`) instead of hand-written raw fetch code.
- Use the SDK's `fetchWeatherApi` function for weather-related endpoints when possible.
- Assume browser-based direct API access is acceptable for the MVP.
- Do not require an API key in the MVP unless a protected deployment is explicitly requested later.
- Keep usage within fair-use expectations for non-commercial classroom and prototype use.

## API Architecture Rules
- Separate Geocoding API access from weather data access.
- Geocoding can use a normal fetch-based client.
- Weather and historical weather retrieval should use the Open-Meteo TypeScript SDK where compatible.
- Keep endpoint-specific client logic isolated in API modules.

## Required Attribution
- Wherever Open-Meteo-derived data is displayed in the app, include visible attribution such as:
  - Weather data by Open-Meteo.com
- Keep attribution visible in the footer and near exported views if practical.

## Tech Stack
- Use React + TypeScript + Vite.
- Use Plotly for charts.
- Use Leaflet for maps.
- Use functional components and hooks.
- Prefer reusable components and typed utility functions.

## UI Rules
- UI language must be Korean.
- Keep the interface simple enough for teachers.
- Prioritize readability for classroom projection.
- Include loading, empty, and error states.
- Make charts and legends readable on large screens and laptops.

## Data Processing Rules
- Fetch raw data from Open-Meteo and aggregate it inside the app.
- Prefer daily data as the base for monthly and yearly summaries.
- Handle missing values explicitly.
- Do not hardcode city lists.
- Do not silently replace null climate values with zero.
- Keep API logic separate from UI logic.

## Engineering Rules
- Separate API modules, aggregation utilities, types, hooks, and UI components.
- Use clear type definitions for API responses and processed climate records.
- Support request cancellation when long-running weather requests are active.
- Avoid oversized page components.
- Prefer custom hooks when logic is reused.
- Keep code concise, typed, and maintainable.

## Licensing and Compliance Notes
- Remember that Open-Meteo data requires attribution in the app UI.
- The Open-Meteo TypeScript SDK itself is MIT-licensed.
- This project consumes public APIs and SDKs; it does not repackage Open-Meteo server code.