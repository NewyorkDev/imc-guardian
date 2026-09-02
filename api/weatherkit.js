import jwt from "jsonwebtoken";

const TEAM_ID = (process.env.APPLE_TEAM_ID || "").trim();
const KEY_ID = (process.env.APPLE_MAPKIT_KEY_ID || "").trim();
const SERVICE_ID = (process.env.APPLE_WEATHERKIT_SERVICE_ID || "").trim();
const PRIVATE_KEY = (process.env.APPLE_MAPKIT_PRIVATE_KEY || "").trim();

function token() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: TEAM_ID, sub: SERVICE_ID, iat: now, exp: now + 3600 },
    PRIVATE_KEY,
    {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: KEY_ID,
        id: `${TEAM_ID}.${SERVICE_ID}`,
        typ: "JWT",
      },
    },
  );
}

export default async function handler(request, response) {
  if (request.method !== "GET")
    return response.status(405).json({ error: "Method not allowed" });
  if (!TEAM_ID || !KEY_ID || !SERVICE_ID || !PRIVATE_KEY)
    return response
      .status(503)
      .json({ error: "WeatherKit is not configured for this deployment." });
  try {
    const auth = token();
    const fetchPoint = async (lat, lon, dataSets = "currentWeather") => {
      const url = new URL(
        `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}`,
      );
      url.searchParams.set("dataSets", dataSets);
      url.searchParams.set("timezone", "America/New_York");
      const upstream = await fetch(url, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (!upstream.ok)
        throw new Error(`WeatherKit returned ${upstream.status}`);
      return upstream.json();
    };
    if (request.query.scope === "global" || request.query.scope === "tpa-jfk") {
      const points =
        request.query.scope === "global"
          ? [
              ["Seattle", 47.45, -122.31, 17, 31, false],
              ["Los Angeles", 33.94, -118.41, 19, 42, false],
              ["Tampa", 27.98, -82.53, 29, 45, true],
              ["JFK", 40.64, -73.78, 32, 35, true],
              ["Mexico City", 19.43, -99.13, 24, 53, false],
              ["São Paulo", -23.55, -46.63, 39, 70, false],
              ["Reykjavík", 64.15, -21.94, 47, 20, false],
              ["London", 51.47, -0.45, 53, 29, false],
              ["Nairobi", -1.29, 36.82, 63, 58, false],
              ["Singapore", 1.35, 103.82, 81, 59, false],
              ["Tokyo", 35.68, 139.65, 90, 40, false],
              ["Sydney", -33.87, 151.21, 93, 77, false],
            ]
          : [
              ["Tampa", 27.98, -82.53, 17, 85, true],
              ["Jacksonville", 30.49, -81.69, 28, 76, true],
              ["Savannah", 32.08, -81.1, 37, 67, true],
              ["Charleston", 32.9, -80.04, 45, 61, true],
              ["Raleigh", 35.88, -78.79, 54, 50, true],
              ["Richmond", 37.51, -77.32, 62, 42, true],
              ["Washington", 38.85, -77.04, 70, 34, true],
              ["Philadelphia", 39.87, -75.24, 80, 25, true],
              ["JFK", 40.64, -73.78, 90, 16, true],
            ];
      const samples = await Promise.all(
        points.map(async ([name, lat, lon, x, y, onRoute]) => {
          const current = (await fetchPoint(lat, lon)).currentWeather;
          return {
            name,
            lat,
            lon,
            x,
            y,
            onRoute,
            asOf: current.asOf,
            conditionCode: current.conditionCode,
            cloudCover: current.cloudCover,
            precipitationIntensity: current.precipitationIntensity,
            temperature: current.temperature,
            windSpeed: current.windSpeed,
            windDirection: current.windDirection,
          };
        }),
      );
      response.setHeader(
        "Cache-Control",
        "s-maxage=3600, stale-while-revalidate=3600",
      );
      return response
        .status(200)
        .json({
          attribution: "Weather data provided by Apple WeatherKit",
          scope: request.query.scope,
          route: "KTPA-KJFK",
          samples,
        });
    }
    const lat = Number(request.query.lat);
    const lon = Number(request.query.lon);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      return response
        .status(400)
        .json({ error: "Valid lat and lon are required." });
    const data = await fetchPoint(
      lat,
      lon,
      "currentWeather,forecastHourly,weatherAlerts",
    );
    response.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=300",
    );
    return response.status(200).json(data);
  } catch (error) {
    response
      .status(502)
      .json({
        error: "WeatherKit is temporarily unavailable.",
        detail: error.message,
      });
  }
}
