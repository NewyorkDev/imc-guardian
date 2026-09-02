# IMC Guardian 60-second demo script

I built IMC Guardian around a simple idea. What if AI could help a pilot see deteriorating weather before the airplane reaches the clouds?

The pilot asks in plain language. GPT-OSS 120B on Groq interprets the request, then the browser executes the real WebMCP tools. You can see every tool move from queued to executing to the shared interface.

The site exposes the details pilots expect: METARs, ceilings, visibility, winds, TAF trends, advisories, alternatives, and the limits of the analysis. Apple WeatherKit adds an on-demand global view of current conditions across twelve locations.

Second Pair of Eyes watches the metric the pilot configured. Here, the ceiling falls below 1,500 feet. Before showing the alert, WebMCP double-checks the threshold crossing, the TAF context, and the overlapping G-AIRMET.

The AI organizes the evidence and catches the change. It never says the flight is safe and never directs a maneuver. The pilot remains in control of the decision.
