# IMC Guardian gallery

## 1. Route overview

IMC Guardian gives a pilot and an AI the same route, weather evidence, limitations, and decision state through twelve native WebMCP tools.

## 2. Aviation evidence

The pilot sees familiar evidence including raw METARs, ceiling AGL, visibility, surface wind, observation time, TAF trends, and advisory validity.

## 3. Human decision checkpoint

The AI compares continuing, delaying, diverting, or canceling, but it never issues a clearance or selects the pilot's decision.

## 4. Native WebMCP trace

Every structured request and response is visible in the page, including tool names, inputs, evidence, limitations, and pilot-controlled outcomes.

## 5. Live Tampa-to-JFK weather

Nine on-demand Apple WeatherKit samples show cloud cover, precipitation, wind, and temperature along an animated Tampa-to-JFK corridor.

## 6. Second Pair of Eyes

A focused ceiling alert is checked against the configured 1,500-foot threshold, TAF context, and overlapping G-AIRMET context before presentation.

## 7. Live AI planner

GPT-OSS 120B on Groq interprets the pilot's sentence, creates an allowlisted tool plan, and executes the actual WebMCP workflow in the shared UI.
