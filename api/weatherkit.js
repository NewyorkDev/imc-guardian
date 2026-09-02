import jwt from 'jsonwebtoken';

const TEAM_ID = (process.env.APPLE_TEAM_ID || '').trim();
const KEY_ID = (process.env.APPLE_MAPKIT_KEY_ID || '').trim();
const SERVICE_ID = (process.env.APPLE_WEATHERKIT_SERVICE_ID || '').trim();
const PRIVATE_KEY = (process.env.APPLE_MAPKIT_PRIVATE_KEY || '').trim();

function token() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iss: TEAM_ID, sub: SERVICE_ID, iat: now, exp: now + 3600 }, PRIVATE_KEY, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: KEY_ID, id: `${TEAM_ID}.${SERVICE_ID}`, typ: 'JWT' }
  });
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  if (!TEAM_ID || !KEY_ID || !SERVICE_ID || !PRIVATE_KEY) return response.status(503).json({ error: 'WeatherKit is not configured for this deployment.' });
  try {
    const auth = token();
    const fetchPoint = async (lat, lon, dataSets = 'currentWeather') => {
      const url = new URL(`https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}`);
      url.searchParams.set('dataSets', dataSets);
      url.searchParams.set('timezone', 'America/New_York');
      const upstream = await fetch(url, { headers: { Authorization: `Bearer ${auth}` } });
      if (!upstream.ok) throw new Error(`WeatherKit returned ${upstream.status}`);
      return upstream.json();
    };
    if (request.query.scope === 'us') {
      const points = [
        ['Seattle', 47.61, -122.33, 8, 13], ['San Francisco', 37.77, -122.42, 10, 49], ['Los Angeles', 34.05, -118.24, 16, 76],
        ['Denver', 39.74, -104.99, 40, 42], ['Dallas', 32.78, -96.8, 51, 71], ['Minneapolis', 44.98, -93.27, 56, 24],
        ['Chicago', 41.88, -87.63, 65, 37], ['New Orleans', 29.95, -90.07, 65, 82], ['Miami', 25.76, -80.19, 86, 88],
        ['Atlanta', 33.75, -84.39, 75, 66], ['New York', 40.71, -74.01, 91, 35], ['Boston', 42.36, -71.06, 96, 25]
      ];
      const samples = await Promise.all(points.map(async ([name, lat, lon, x, y]) => {
        const current = (await fetchPoint(lat, lon)).currentWeather;
        return { name, lat, lon, x, y, asOf: current.asOf, conditionCode: current.conditionCode, cloudCover: current.cloudCover, precipitationIntensity: current.precipitationIntensity, temperature: current.temperature, windSpeed: current.windSpeed, windDirection: current.windDirection };
      }));
      response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=900');
      return response.status(200).json({ attribution: 'Weather data provided by Apple WeatherKit', samples });
    }
    const lat = Number(request.query.lat);
    const lon = Number(request.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return response.status(400).json({ error: 'Valid lat and lon are required.' });
    const data = await fetchPoint(lat, lon, 'currentWeather,forecastHourly,weatherAlerts');
    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    return response.status(200).json(data);
  } catch (error) {
    response.status(502).json({ error: 'WeatherKit is temporarily unavailable.', detail: error.message });
  }
}
