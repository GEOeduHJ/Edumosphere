---
name: Open-Meteo TypeScript SDK
description: Rules for using the official Open-Meteo SDK
applyTo: "src/api/openMeteo*.ts,src/api/weather*.ts,src/lib/openmeteo*.ts"
---

# Open-Meteo SDK instructions

- Use the `openmeteo` package for weather data retrieval when possible.
- Prefer `fetchWeatherApi(...)` over manual fetch for supported weather endpoints.
- Keep one adapter layer that transforms SDK responses into plain typed objects for the rest of the app.
- Be careful with variable index ordering; requested variables and read indices must match.
- Support multi-location requests where comparison views benefit from one combined request.
- Use AbortController-aware request flows for rapidly changing selections.
- Avoid leaking FlatBuffers-specific parsing details into React components.
- Keep retry strategy simple and aligned with SDK capabilities.