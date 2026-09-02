# IMC Guardian gallery

## 1. Route overview

IMC Guardian gives a pilot and an AI the same route, weather evidence, limitations, and decision state through twelve native WebMCP tools.

## 2. Aviation evidence

The pilot sees familiar evidence including raw METARs, ceiling AGL, visibility, surface wind, observation time, TAF trends, and advisory validity.

## 3. Human decision checkpoint

The AI compares continuing, delaying, diverting, or canceling, but it never issues a clearance or selects the pilot's decision.

## 4. Native WebMCP trace

Every structured request and response is visible in the page, including tool names, inputs, evidence, limitations, and pilot-controlled outcomes.

## 5. Live global Apple weather

Twelve on-demand Apple WeatherKit samples show current conditions, cloud cover, temperature, and wind on a global weather view. Aviation categories remain sourced separately from AWC.

## 6. Second Pair of Eyes

A focused ceiling alert is checked against the configured 1,500-foot threshold, TAF context, and overlapping G-AIRMET context before presentation.

## 7. Live AI planner

GPT-OSS 120B on Groq interprets the pilot's sentence, creates an allowlisted tool plan, and executes the actual WebMCP workflow in the shared UI.

## 8. Concrete route outcome

The completed AI run states the HIGH route assessment, worst condition, three material factors, next review, validated monitoring status, token usage, and pilot decision boundary.

## 9. Live sources without blending the scenario

The live AWC panel shows each airport's current category and observation time, flags a stale report, and explicitly says that live reports do not validate the reproducible deterioration scenario.
