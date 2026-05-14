export default async (req) => {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();

    if (q.length < 2) {
      return json({ results: [] });
    }

    const wikidataUrl = new URL("https://www.wikidata.org/w/api.php");
    wikidataUrl.searchParams.set("action", "wbsearchentities");
    wikidataUrl.searchParams.set("search", q);
    wikidataUrl.searchParams.set("language", "en");
    wikidataUrl.searchParams.set("format", "json");
    wikidataUrl.searchParams.set("origin", "*");
    wikidataUrl.searchParams.set("type", "item");
    wikidataUrl.searchParams.set("limit", "12");

    const response = await fetch(wikidataUrl);
    const data = await response.json();
    const results = Array.isArray(data.search)
      ? data.search
          .filter((item) => /video game|game|arcade|console|platform/i.test(item.description || ""))
          .map((item) => ({
            id: item.id,
            title: item.label,
            description: item.description || "Video game",
            cover: null,
            source: "wikidata",
          }))
      : [];

    const coversById = await loadCovers(results);
    const enriched = results.map((item) => ({
      ...item,
      cover: coversById[item.id] || null,
    }));

    return json({ results: enriched });
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

async function loadCovers(results) {
  try {
    const uniqueIds = [...new Set(results.map((item) => item.id))].filter(Boolean);
    if (uniqueIds.length === 0) {
      return {};
    }

    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", uniqueIds.join("|"));
    url.searchParams.set("languages", "en");
    url.searchParams.set("props", "claims|sitelinks/urls");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

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
