---
name: Frontend React TypeScript
description: Rules for React and TypeScript files
applyTo: "**/*.ts,**/*.tsx"
---

# Frontend instructions

- Use React functional components only.
- Use TypeScript interfaces or types for all major API responses and processed climate records.
- Keep components small and focused.
- Prefer composable UI over monolithic page components.
- Separate presentational UI from data-fetching logic when practical.
- Prefer custom hooks for reusable stateful logic.
- Use Korean labels and messages in the UI.
- Ensure responsive layout.
- Include loading, empty, and error states.
- Keep projector-friendly readability in mind.
- Use reusable cards, tables, chart wrappers, and map panels.
- Keep attribution UI visible and consistent across screens.
- UI components must not directly parse low-level Open-Meteo SDK response objects; convert them first in the API or adapter layer.