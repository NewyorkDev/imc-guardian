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
  const lat = Number(request.query.lat);
  const lon = Number(request.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return response.status(400).json({ error: 'Valid lat and lon are required.' });
  const url = new URL(`https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}`);
  url.searchParams.set('dataSets', 'currentWeather,forecastHourly,weatherAlerts');
  url.searchParams.set('timezone', 'America/New_York');
  try {
    const upstream = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
    const body = await upstream.text();
    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    response.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json').send(body);
  } catch (error) {
    response.status(502).json({ error: 'WeatherKit is temporarily unavailable.', detail: error.message });
  }
}
