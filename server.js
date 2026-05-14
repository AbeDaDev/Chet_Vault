import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 8787;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.use(express.json());

app.get('/api/search-games', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ results: [] });
    }

    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', q);
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('type', 'item');
    url.searchParams.set('limit', '12');

    const response = await fetch(url);
    const data = await response.json();
    const results = Array.isArray(data.search)
      ? data.search
          .filter((item) => /video game|game|arcade|console|platform/i.test(item.description || ''))
          .map((item) => ({
            id: item.id,
            title: item.label,
            description: item.description || 'Video game',
            cover: null,
            source: 'wikidata',
          }))
      : [];

    const coversById = await loadCovers(results);
    const enriched = results.map((item) => ({
      ...item,
      cover: coversById[item.id] || null,
    }));

    return res.json({ results: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/cheats', async (req, res) => {
  try {
    const { game } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY in your server environment.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (!game?.title) {
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
          content: `List the most famous or useful cheat codes for "${game.title}"${game.platform || game.year || game.description ? ` (${[game.platform, game.year, game.description].filter(Boolean).join(', ')})` : ''}. Include 5-12 cheats. For every cheat, include the console or platform in a "console" field. If a cheat works on multiple versions, pick the most common one.`,
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
                    console: { type: 'string' },
                  },
                  required: ['code', 'effect', 'howTo', 'console'],
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

async function loadCovers(results) {
  try {
    const uniqueIds = [...new Set(results.map((item) => item.id))].filter(Boolean);
    if (uniqueIds.length === 0) {
      return {};
    }

    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', uniqueIds.join('|'));
    url.searchParams.set('languages', 'en');
    url.searchParams.set('props', 'claims|sitelinks/urls');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const response = await fetch(url);
    const data = await response.json();
    const entities = data?.entities || {};
    const covers = {};

    for (const item of results) {
      const entity = entities?.[item.id];
      const imageName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (imageName) {
        covers[item.id] = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageName)}`;
        continue;
      }

      const wikiTitle = entity?.sitelinks?.enwiki?.title;
      const wikipediaCover = await loadWikipediaCover(wikiTitle || item.title);
      if (wikipediaCover) {
        covers[item.id] = wikipediaCover;
        continue;
      }

      if (/minecraft/i.test(item.title || "")) {
        covers[item.id] = "https://commons.wikimedia.org/wiki/Special:FilePath/Minecraft%20Logo-en.svg";
      }
    }

    return covers;
  } catch {
    return {};
  }
}

async function loadWikipediaCover(title) {
  try {
    if (!title) return null;

    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", title);
    url.searchParams.set("prop", "images");
    url.searchParams.set("imlimit", "20");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const response = await fetch(url);
    const data = await response.json();
    const page = Object.values(data?.query?.pages || {})[0];
    const images = Array.isArray(page?.images) ? page.images.map((image) => image.title) : [];
    const pick = pickBestImage(images);
    return pick ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(pick.replace(/^File:/, ""))}` : null;
  } catch {
    return null;
  }
}

function pickBestImage(images) {
  const ranked = images
    .filter(Boolean)
    .filter((name) => !/icon|logo|edit-ltr|commons-logo/i.test(name))
    .sort((a, b) => scoreImage(b) - scoreImage(a));

  const best = ranked[0] || images.find(Boolean) || null;
  return best;
}

function scoreImage(name) {
  const lower = String(name).toLowerCase();
  if (/(cover|box art|boxart|box|front cover|poster|key art)/i.test(lower)) return 100;
  if (/logo/i.test(lower)) return 80;
  if (/art/i.test(lower)) return 60;
  if (/screenshot/i.test(lower)) return 20;
  return 10;
}
