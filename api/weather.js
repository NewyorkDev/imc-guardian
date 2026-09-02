const ALLOWED = new Set(['metar', 'taf', 'pirep', 'airsigmet', 'gairmet', 'cwa', 'stationinfo', 'airport']);

export default async function handler(request, response) {
  const type = String(request.query.type || 'metar').toLowerCase();
  if (!ALLOWED.has(type)) return response.status(400).json({ error: 'Unsupported aviation weather product.' });
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query)) {
    if (key !== 'type' && typeof value === 'string' && /^[A-Za-z0-9,.:_-]{1,120}$/.test(value)) params.set(key, value);
  }
  if (!params.has('format')) params.set('format', 'json');
  try {
    const upstream = await fetch(`https://aviationweather.gov/api/data/${type}?${params}`, {
      headers: { 'User-Agent': 'IMC-Guardian-WebMCP-Challenge/0.1 contact:newyorkdev' }
    });
    if (upstream.status === 204) return response.status(200).json([]);
    const body = await upstream.text();
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    response.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json').send(body);
  } catch (error) {
    response.status(502).json({ error: 'Aviation Weather Center is temporarily unavailable.', detail: error.message });
  }
}
