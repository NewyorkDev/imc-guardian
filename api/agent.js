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
  const safePlan = () => {
    const monitoring = /monitor|watch|alert|notify|change|deteriorat/i.test(prompt);
    return {
      interpretation: "Check the route, surface the weather evidence, compare options, and leave the operational decision to the pilot.",
      toolPlan: [
        "set_flight_context",
        "check_airport_conditions",
        "check_route_advisories",
        "assess_route_weather",
        "find_safer_alternates",
        "compare_route_options",
        ...(monitoring
          ? [
              "configure_route_watch",
              "check_route_changes",
              "validate_weather_alert",
            ]
          : []),
      ],
      pilotMessage:
        "IMC Guardian will assemble and cross-check the evidence. The pilot makes the final decision.",
    };
  };
  try {
    const runModel = async (model, strictJson = true) => {
      const requestBody = {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_completion_tokens: 500,
      };
      if (strictJson) requestBody.response_format = { type: "json_object" };
      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      return { upstream, payload: await upstream.json() };
    };
    const attempts = [
      ["openai/gpt-oss-120b", true],
      ["openai/gpt-oss-120b", false],
      ["openai/gpt-oss-20b", true],
      ["openai/gpt-oss-20b", false],
    ];
    let upstream;
    let payload;
    for (const [model, strictJson] of attempts) {
      ({ upstream, payload } = await runModel(model, strictJson));
      if (upstream.ok) break;
    }
    if (!upstream?.ok) {
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json({
        provider: "IMC Guardian fallback",
        model: "Validated deterministic planner",
        usage: null,
        fallback: true,
        upstreamDetail:
          payload?.error?.message || "Free model temporarily unavailable",
        ...safePlan(),
      });
    }
    const content = payload.choices?.[0]?.message?.content || "{}";
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || "{}";
    let plan;
    try {
      plan = JSON.parse(jsonText);
    } catch {
      plan = safePlan();
      plan.fallback = true;
    }
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
