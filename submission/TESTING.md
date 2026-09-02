# Judge testing instructions

1. Open the live URL in ChatGPT's in-app browser or Google Chrome with WebMCP enabled.
2. Ask: "I am flying VFR from KTPF to KTLH at 6 PM in a C172. Check my route."
3. The agent should set the flight context, inspect three airport conditions, identify the destination IFR condition and deteriorating northern corridor, and show the overlapping G-AIRMET IFR scenario.
4. Ask for comparatively better nearby alternates. The tool should return KOCF, KGNV, and KVDF as VFR stations in the reproducible scenario, with an explicit warning that this is not a landing-suitability determination.
5. Ask: "What changes if I delay, choose an alternate, or cancel?" The response should compare the options but leave `preferred` empty and require the pilot's choice.
6. Ask it to record "delay". The response should log the human decision while stating that it does not authorize or clear a flight.
7. Open the Live WebMCP Trace to inspect the structured inputs, outputs, provenance, limitations, and safety boundary.
8. In the Live Free AI section, run the prefilled pilot request. GPT-OSS 120B on Groq should create an allowlisted plan, execute the WebMCP tools in sequence, and report model token usage.
9. Select "Check live sources." The route card should show each live AWC airport category, observation time, and freshness state separately from the reproducible scenario.
10. Select "Load Apple global weather." The globe should show twelve current WeatherKit samples with condition, cloud cover, temperature, wind, and update time. This layer is cached for one hour.
11. Select "Enable a Second Pair of Eyes." The demo should configure route monitoring, show the worsening KTLH ceiling attention cue, and add the related WebMCP calls to the trace.

No credentials are required for scenario mode. The live-source button uses server-side NOAA Aviation Weather Center and Apple WeatherKit connections. Live data is supplemental to the reproducible judging scenario and must not be interpreted as an official briefing.
