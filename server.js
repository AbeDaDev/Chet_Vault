import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 8787;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.use(express.json());

app.post('/api/cheats', async (req, res) => {
  try {
    const { game } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY in your server environment.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (!game?.title || !game?.platform || !game?.year) {
      return res.status(400).json({ error: 'Missing game data.' });
    }

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: 'system',
          content:
            'You generate cheat code lists for classic video games. Return only JSON that matches the requested schema. No markdown, no extra commentary.',
        },
        {
          role: 'user',
          content: `List the most famous or useful cheat codes for "${game.title}" (${game.platform}, ${game.year}). Include 5-12 cheats. If a platform has multiple input methods, pick the most common one.`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'cheat_codes',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              cheats: {
                type: 'array',
                minItems: 5,
                maxItems: 12,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    code: { type: 'string' },
                    effect: { type: 'string' },
                    howTo: { type: 'string' },
                  },
                  required: ['code', 'effect', 'howTo'],
                },
              },
            },
            required: ['cheats'],
          },
        },
      },
      temperature: 0.4,
      max_output_tokens: 1200,
    });

    const text = response.output_text?.trim();
    if (!text) {
      return res.status(502).json({ error: 'Empty response from OpenAI.' });
    }

    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
