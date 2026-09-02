# IMC Guardian

IMC Guardian is an aviation weather decision-support prototype built for the WebMCP Challenge. A pilot can ask an AI to inspect a proposed VFR route. Eight site-owned WebMCP tools expose the route, airport conditions, advisories, risk factors, alternate airports, decision tradeoffs, and a human decision checkpoint.

The application is not an official weather briefing, flight-planning service, clearance system, or go/no-go authority. The pilot in command remains responsible for every flight decision.

## Data architecture

- NOAA Aviation Weather Center: aviation observations, forecasts, and advisories through a rate-limited server-side proxy
- Apple WeatherKit: supplemental general weather context through server-side JWT signing
- Deterministic scenario mode: reproducible judging flow, clearly labeled as scenario data
- Future option: AirNav Business or FlightRadar24 for live aircraft position, altitude, speed, heading, and time-to-hazard calculations

## WebMCP tools

`set_flight_context`, `check_airport_conditions`, `check_route_advisories`, `assess_route_weather`, `find_safer_alternates`, `compare_route_options`, `explain_imc_risk`, `record_pilot_decision`

## Local development

```bash
npm install
npm test
npm run dev
```

Live WeatherKit requires server-side `APPLE_TEAM_ID`, `APPLE_MAPKIT_KEY_ID`, `APPLE_MAPKIT_PRIVATE_KEY`, and `APPLE_WEATHERKIT_SERVICE_ID`. Never expose these values in client-side variables.
