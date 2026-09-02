const ALLOWED_TOOLS = [
  "set_flight_context",
  "check_airport_conditions",
  "check_route_advisories",
  "assess_route_weather",
  "find_safer_alternates",
  "compare_route_options",
  "explain_imc_risk",
  "configure_route_watch",
  "check_route_changes",
  "validate_weather_alert",
];

export default async function handler(request, response) {
  if (request.method !== "POST")
    return response.status(405).json({ error: "Method not allowed" });
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  if (!apiKey)
    return response
      .status(503)
      .json({ error: "Free AI demo is not configured." });
  const prompt = String(request.body?.prompt || "")
    .trim()
    .slice(0, 500);
  if (!prompt)
    return response.status(400).json({ error: "A pilot request is required." });
  const system = `You are the natural-language planner inside IMC Guardian, a clearly labeled aviation decision-support prototype. You do not invent weather, issue a clearance, say a flight is safe, or make a go/no-go decision. Choose an ordered subset of these site-owned WebMCP tools: ${ALLOWED_TOOLS.join(", ")}. For the standard KTPF to KTLH VFR request, include route context, airport conditions, advisories, assessment, alternates, and comparison. If the user asks for monitoring, include configure_route_watch, check_route_changes, and validate_weather_alert in that order. Return strict JSON with keys interpretation (string), toolPlan (array of allowed tool names), and pilotMessage (short string that says the site tools will supply evidence and the pilot decides).`;
  try {
    const runModel = async (model) => {
      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_completion_tokens: 500,
        }),
      });
      return { upstream, payload: await upstream.json() };
    };
    let { upstream, payload } = await runModel("openai/gpt-oss-20b");
    if (!upstream.ok) ({ upstream, payload } = await runModel("llama-3.1-8b-instant"));
    if (!upstream.ok) return response.status(upstream.status).json({ error: "Free model is temporarily unavailable.", detail: payload.error?.message || "Unknown model error" });
    const content = payload.choices?.[0]?.message?.content || "{}";
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const plan = JSON.parse(jsonText);
    plan.toolPlan = (Array.isArray(plan.toolPlan) ? plan.toolPlan : []).filter(
      (name) => ALLOWED_TOOLS.includes(name),
    );
    response.setHeader("Cache-Control", "no-store");
    return response
      .status(200)
      .json({
        provider: "Groq",
        model: payload.model || "Groq hosted open-weight model",
        usage: payload.usage || null,
        ...plan,
      });
  } catch (error) {
    return response
      .status(502)
      .json({
        error: "The free AI planning demo could not complete.",
        detail: error.message,
      });
  }
}
