---
name: API and data layer
description: Rules for Open-Meteo API modules and aggregation logic
applyTo: "src/api/**/*.ts,src/utils/**/*.ts,src/hooks/**/*.ts"
---

# API and data instructions

- Prefer the official Open-Meteo TypeScript SDK (`openmeteo`) for weather-related requests.
- Use the SDK's `fetchWeatherApi` for forecast or historical weather endpoints where compatible.
- Keep geocoding in a separate fetch-based API client.
- Keep geocoding, weather retrieval, response decoding, and aggregation as separate concerns.
- Decode SDK responses into plain typed application objects before passing data to hooks or UI components.
- Respect variable ordering when reading SDK response variable arrays.
- Preserve location metadata such as latitude, longitude, elevation, timezone, and timezone abbreviation when available.
- Use helper functions to convert SDK time ranges into normal JavaScript date arrays.
- Handle network failures with user-friendly messages.
- Support request cancellation with AbortController when a screen can trigger replacement requests.
- Use retry behavior thoughtfully and do not stack redundant retry loops on top of the SDK unless necessary.
- Avoid duplicated API calls where memoization is possible.
- Keep aggregation logic pure and reusable.
- Convert daily data into reusable monthly and yearly aggregates.
- Handle missing values explicitly rather than converting them to zero.
- Add a clear attribution string in data-consuming UI layers.