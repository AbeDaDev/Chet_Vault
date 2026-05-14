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

    return json({ results });
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
