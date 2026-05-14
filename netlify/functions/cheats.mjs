import OpenAI from "openai";

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!process.env.OPENAI_API_KEY) {
      return json({ error: "Missing OPENAI_API_KEY in your Netlify environment." }, 500);
    }

    const { game } = await req.json();
    if (!game?.title || !game?.platform || !game?.year) {
      return json({ error: "Missing game data." }, 400);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You generate cheat code lists for classic video games. Return only JSON that matches the requested schema. No markdown, no extra commentary.",
        },
        {
          role: "user",
          content: `List the most famous or useful cheat codes for "${game.title}" (${game.platform}, ${game.year}). Include 5-12 cheats. If a platform has multiple input methods, pick the most common one.`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "cheat_codes",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              cheats: {
                type: "array",
                minItems: 5,
                maxItems: 12,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    code: { type: "string" },
                    effect: { type: "string" },
                    howTo: { type: "string" },
                  },
                  required: ["code", "effect", "howTo"],
                },
              },
            },
            required: ["cheats"],
          },
        },
      },
      temperature: 0.4,
      max_output_tokens: 1200,
    });

    const text = response.output_text?.trim();
    if (!text) {
      return json({ error: "Empty response from OpenAI." }, 502);
    }

    return json(JSON.parse(text), 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
};

function json(body, statusCode = 200) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}
