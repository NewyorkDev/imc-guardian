# IMC Guardian

IMC Guardian is an aviation weather decision-support prototype built for the WebMCP Challenge. A pilot can ask an AI to inspect a proposed VFR route. Fifteen site-owned WebMCP tools expose the route, airport conditions, advisories, risk factors, alternate airports, validated route-watch alerts, historical evidence comparisons, decision tradeoffs, and a human decision checkpoint.

The application is not an official weather briefing, flight-planning service, clearance system, or go/no-go authority. The pilot in command remains responsible for every flight decision.

## Data architecture

- NOAA Aviation Weather Center: aviation observations, forecasts, and advisories through a rate-limited server-side proxy
- Apple WeatherKit: supplemental general weather context through server-side JWT signing
- Deterministic scenario mode: reproducible judging flow, clearly labeled as scenario data
- Historical evidence replay: Delta 175 reconstructed from the NTSB final report and 20-item public docket
- Future option: AirNav Business, RadarBox, or a comparable feed for reported position, altitude, ground track, groundspeed, and time-to-weather calculations

## WebMCP tools

`set_flight_context`, `check_airport_conditions`, `check_route_advisories`, `assess_route_weather`, `find_safer_alternates`, `compare_route_options`, `explain_imc_risk`, `configure_route_watch`, `check_route_changes`, `validate_weather_alert`, `acknowledge_weather_alert`, `record_pilot_decision`, `load_incident_replay`, `compare_incident_evidence`, `explain_replay_limits`

## Local development

```bash
npm install
npm test
npm run dev
```

Live WeatherKit requires server-side `APPLE_TEAM_ID`, `APPLE_MAPKIT_KEY_ID`, `APPLE_MAPKIT_PRIVATE_KEY`, and `APPLE_WEATHERKIT_SERVICE_ID`. Never expose these values in client-side variables.
