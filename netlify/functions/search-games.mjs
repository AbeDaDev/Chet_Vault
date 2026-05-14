export default async (req) => {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const query = q.toLowerCase();

    if (query.length < 2) {
      return json({ results: [] });
    }

    const [wikipedia, hinted] = await Promise.all([
      searchWikipedia(query),
      searchHintedGames(query),
    ]);

    const merged = dedupeResults([...wikipedia, ...hinted]);
    const coversById = await loadCovers(merged);

    return json({
      results: merged
        .slice(0, 18)
        .map((item) => ({
          ...item,
          cover: coversById[item.id] || item.cover || null,
        })),
    });
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
  const wikidataUrl = new URL("https://www.wikidata.org/w/api.php");
  wikidataUrl.searchParams.set("action", "wbsearchentities");
  wikidataUrl.searchParams.set("search", search);
  wikidataUrl.searchParams.set("language", "en");
  wikidataUrl.searchParams.set("format", "json");
  wikidataUrl.searchParams.set("origin", "*");
  wikidataUrl.searchParams.set("type", "item");
  wikidataUrl.searchParams.set("limit", "10");

  const response = await fetch(wikidataUrl);
  const data = await readJson(response);
  if (!Array.isArray(data?.search)) return [];

  const results = [];
  for (const item of data.search) {
    if (!/video game|game|arcade|console|platform/i.test(item.description || "")) continue;
    results.push({
      id: item.id,
      title: item.label,
      description: item.description || "Video game",
      cover: null,
      source: "wikidata",
    });
  }
  return results;
}

async function searchWikipediaOnce(search) {
  const wikiUrl = new URL("https://en.wikipedia.org/w/api.php");
  wikiUrl.searchParams.set("action", "query");
  wikiUrl.searchParams.set("list", "search");
  wikiUrl.searchParams.set("srsearch", search);
  wikiUrl.searchParams.set("srlimit", "10");
  wikiUrl.searchParams.set("format", "json");
  wikiUrl.searchParams.set("origin", "*");

  const response = await fetch(wikiUrl);
  const data = await readJson(response);
  const hits = Array.isArray(data?.query?.search) ? data.query.search : [];
  const pages = await loadWikipediaPageData(hits.slice(0, 10).map((hit) => hit.title));
  const results = [];

  for (const hit of hits) {
    const page = pages[hit.title.toLowerCase()] || null;
    if (!isGamePage(page, hit.title)) continue;

    results.push({
      id: `wiki-${slugify(hit.title)}`,
      title: page?.title || hit.title,
      description: page?.description || "Video game",
      cover: page?.thumbnail?.source || page?.original?.source || null,
      source: "wikipedia",
    });
  }

  return results;
}

async function loadWikipediaPageData(titles) {
  try {
    const cleanTitles = [...new Set((titles || []).filter(Boolean))];
    if (cleanTitles.length === 0) return {};

    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", cleanTitles.join("|"));
    url.searchParams.set("prop", "description|pageimages");
    url.searchParams.set("piprop", "thumbnail|original");
    url.searchParams.set("pithumbsize", "600");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const response = await fetch(url);
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

function isGamePage(summary, title) {
  const text = `${summary?.description || ""} ${summary?.title || title || ""}`.toLowerCase();
  return /video game|computer game|arcade|game/i.test(text);
}

async function loadCovers(results) {
  try {
    const wikidataIds = [...new Set(results.map((item) => item.id).filter((id) => /^Q\d+$/i.test(id)))];
    if (wikidataIds.length === 0) return {};

    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", wikidataIds.join("|"));
    url.searchParams.set("languages", "en");
    url.searchParams.set("props", "claims|sitelinks/urls");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const response = await fetch(url);
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
        covers[item.id] = "https://commons.wikimedia.org/wiki/Special:FilePath/Minecraft%20Key-art.png";
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
    const response = await fetch(url);
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
    results.push({
      id: `wiki-${slugify(title)}`,
      title: page.title || title,
      description: page.description || "Video game",
      cover: page.thumbnail?.source || page.original?.source || null,
      source: "wikipedia",
    });
  }

  return results;
}

function dedupeResults(results) {
  const seen = new Set();
  const merged = [];

  for (const item of results) {
    const key = `${String(item.title || "").toLowerCase()}|${String(item.source || "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readJson(response) {
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}
