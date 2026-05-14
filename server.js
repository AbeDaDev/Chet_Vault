import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 8787;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const WIKIMEDIA_HEADERS = {
  'User-Agent': 'CheatVault/1.0 (video game search; local development)',
  'Accept': 'application/json',
};

app.use(express.json());

app.get('/api/search-games', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const query = q.toLowerCase();
    if (query.length < 2) {
      return res.json({ results: [] });
    }

    const [wikipediaResults, hintedResults] = await Promise.all([
      searchWikipedia(query),
      searchHintedGames(query),
    ]);

    const merged = dedupeResults([...wikipediaResults, ...hintedResults]);
    const coversById = await loadCovers(merged);
    const enriched = merged
      .slice(0, 18)
      .map((item) => ({
        ...item,
        cover: coversById[item.id] || item.cover || null,
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

async function searchWikidata(query) {
  const first = await searchWikidataOnce(query);
  if (first.length > 0) return first;
  const fallbackOne = await searchWikidataOnce(`${query} video game`);
  if (fallbackOne.length > 0) return fallbackOne;
  return searchWikidataOnce(`${query} game`);
}

async function searchWikipedia(query) {
  const first = await searchWikipediaOnce(query);
  if (first.length > 0) return first;
  const fallbackOne = await searchWikipediaOnce(`${query} video game`);
  if (fallbackOne.length > 0) return fallbackOne;
  return searchWikipediaOnce(`${query} game`);
}

async function searchWikidataOnce(search) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', search);
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('type', 'item');
  url.searchParams.set('limit', '10');

  const response = await fetch(url, { headers: WIKIMEDIA_HEADERS });
  const data = await readJson(response);
  if (!Array.isArray(data?.search)) return [];

  const results = [];
  for (const item of data.search) {
    if (!/video game|game|arcade|console|platform/i.test(item.description || '')) continue;
    results.push({
      id: item.id,
      title: item.label,
      description: item.description || 'Video game',
      cover: null,
      source: 'wikidata',
    });
  }
  return results;
}

async function searchWikipediaOnce(search) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', search);
  url.searchParams.set('srlimit', '10');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const response = await fetch(url, { headers: WIKIMEDIA_HEADERS });
  const data = await readJson(response);
  const hits = Array.isArray(data?.query?.search) ? data.query.search : [];
  const pages = await loadWikipediaPageData(hits.slice(0, 10).map((hit) => hit.title));
  const results = [];

  for (const hit of hits) {
    const page = pages[hit.title.toLowerCase()] || null;
    if (!isGamePage(page, hit.title)) continue;
    const cover = page?.thumbnail?.source || page?.original?.source || await loadWikipediaSummaryCover(page?.title || hit.title);

    results.push({
      id: `wiki-${slugify(hit.title)}`,
      title: page?.title || hit.title,
      description: page?.description || 'Video game',
      cover,
      source: 'wikipedia',
    });
  }

  return results;
}

async function loadWikipediaPageData(titles) {
  try {
    const cleanTitles = [...new Set((titles || []).filter(Boolean))];
    if (cleanTitles.length === 0) return {};

    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', cleanTitles.join('|'));
    url.searchParams.set('prop', 'description|pageimages');
    url.searchParams.set('piprop', 'thumbnail|original');
    url.searchParams.set('pithumbsize', '600');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const response = await fetch(url, { headers: WIKIMEDIA_HEADERS });
    if (!response.ok) return {};
    const data = await readJson(response);
    const pages = data?.query?.pages || {};
    const byTitle = {};

    for (const page of Object.values(pages)) {
      if (!page?.title) continue;
      byTitle[String(page.title).toLowerCase()] = page;
    }

    return byTitle;
  } catch {
    return {};
  }
}

async function loadCovers(results) {
  try {
    const wikidataIds = [...new Set(results.map((item) => item.id).filter((id) => /^Q\d+$/i.test(id)))];
    if (wikidataIds.length === 0) return {};

    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', wikidataIds.join('|'));
    url.searchParams.set('languages', 'en');
    url.searchParams.set('props', 'claims|sitelinks/urls');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const response = await fetch(url, { headers: WIKIMEDIA_HEADERS });
    const data = await readJson(response);
    const entities = data?.entities || {};
    const covers = {};

    for (const item of results) {
      if (!/^Q\d+$/i.test(item.id)) continue;
      const entity = entities?.[item.id];
      const imageName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (imageName) {
        covers[item.id] = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageName)}`;
        continue;
      }

      const wikiTitle = entity?.sitelinks?.enwiki?.title;
      if (wikiTitle) {
        const cover = await loadWikipediaSummaryCover(wikiTitle);
        if (cover) {
          covers[item.id] = cover;
          continue;
        }
      }

      if (/minecraft/i.test(item.title || "")) {
        covers[item.id] = 'https://commons.wikimedia.org/wiki/Special:FilePath/Minecraft%20Key-art.png';
      }
    }

    return covers;
  } catch {
    return {};
  }
}

async function loadWikipediaSummaryCover(title) {
  try {
    if (!title) return null;
    const url = new URL(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const response = await fetch(url, { headers: WIKIMEDIA_HEADERS });
    if (!response.ok) return null;
    const data = await readJson(response);
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch {
    return null;
  }
}

const SEARCH_HINTS = [
  {
    pattern: /toy story/i,
    titles: [
      "Toy Story (video game)",
      "Toy Story 2 (video game)",
      "Toy Story 3 (video game)",
      "Toy Story Mania! (video game)",
      "Toy Story Racer",
      "Toy Story 2: Buzz Lightyear to the Rescue",
    ],
  },
];

async function searchHintedGames(query) {
  const lower = String(query || "").toLowerCase();
  const hint = SEARCH_HINTS.find((entry) => entry.pattern.test(lower));
  if (!hint) return [];

  const pages = await loadWikipediaPageData(hint.titles);
  const results = [];

  for (const title of hint.titles) {
    const page = pages[title.toLowerCase()] || null;
    if (!page) continue;
    const cover = page.thumbnail?.source || page.original?.source || await loadWikipediaSummaryCover(page.title || title);
    results.push({
      id: `wiki-${slugify(title)}`,
      title: page.title || title,
      description: page.description || 'Video game',
      cover,
      source: 'wikipedia',
    });
  }

  return results;
}

function isGamePage(summary, title) {
  const text = `${summary?.description || ''} ${summary?.title || title || ''}`.toLowerCase();
  return /video game|computer game|arcade|game/i.test(text);
}

function dedupeResults(results) {
  const seen = new Set();
  const merged = [];

  for (const item of results) {
    const key = `${String(item.title || '').toLowerCase()}|${String(item.source || '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function readJson(response) {
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}
