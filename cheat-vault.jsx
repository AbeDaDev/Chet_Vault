import { useState, useEffect } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

// ── Seed game database ──────────────────────────────────────────────────────
const GAME_DB = [
  { id: "gta-sa", title: "GTA: San Andreas", platform: "PS2 / PC / Xbox", year: 2004, cover: "https://upload.wikimedia.org/wikipedia/en/3/33/San_Andreas_poster.jpg" },
  { id: "mortal-kombat-11", title: "Mortal Kombat 11", platform: "Multi", year: 2019, cover: "https://upload.wikimedia.org/wikipedia/en/4/43/MK11_Cover_Art.jpg" },
  { id: "sonic-3", title: "Sonic the Hedgehog 3", platform: "Sega Genesis", year: 1994, cover: "https://upload.wikimedia.org/wikipedia/en/8/8b/Sonic_the_Hedgehog_3_US_cover.jpg" },
  { id: "doom-1993", title: "DOOM (1993)", platform: "PC / Multi", year: 1993, cover: "https://upload.wikimedia.org/wikipedia/en/5/57/Doom_cover_art.jpg" },
  { id: "zelda-ocarina", title: "The Legend of Zelda: Ocarina of Time", platform: "N64", year: 1998, cover: "https://upload.wikimedia.org/wikipedia/en/5/57/The_Legend_of_Zelda_Ocarina_of_Time.jpg" },
  { id: "street-fighter-2", title: "Street Fighter II", platform: "SNES / Arcade", year: 1991, cover: "https://upload.wikimedia.org/wikipedia/en/b/b4/Street_Fighter_II_SNES_cover.jpg" },
  { id: "gta-vice-city", title: "GTA: Vice City", platform: "PS2 / PC", year: 2002, cover: "https://upload.wikimedia.org/wikipedia/en/b/b1/Grand_Theft_Auto_Vice_City_cover.jpg" },
  { id: "resident-evil-2", title: "Resident Evil 2 (1998)", platform: "PS1 / PC", year: 1998, cover: "https://upload.wikimedia.org/wikipedia/en/6/68/Resident_Evil_2_%281998%29_cover_art.jpg" },
  { id: "tony-hawk-pro-skater-2", title: "Tony Hawk's Pro Skater 2", platform: "PS1 / N64 / PC", year: 2000, cover: "https://upload.wikimedia.org/wikipedia/en/e/e3/THPS2.jpg" },
  { id: "contra", title: "Contra", platform: "NES / Arcade", year: 1988, cover: "https://upload.wikimedia.org/wikipedia/en/e/e2/Contra_NES_Cover.jpg" },
  { id: "mortal-kombat-2", title: "Mortal Kombat II", platform: "SNES / Genesis / Arcade", year: 1993, cover: "https://upload.wikimedia.org/wikipedia/en/b/bf/Mortal_Kombat_II_flyer.jpg" },
  { id: "nba-jam", title: "NBA Jam", platform: "SNES / Genesis", year: 1993, cover: "https://upload.wikimedia.org/wikipedia/en/8/88/NBA_Jam_Coverart.png" },
  { id: "goldeneye-007", title: "GoldenEye 007", platform: "N64", year: 1997, cover: "https://upload.wikimedia.org/wikipedia/en/3/36/GoldenEye007box.jpg" },
  { id: "diablo-ii", title: "Diablo II", platform: "PC", year: 2000, cover: "https://upload.wikimedia.org/wikipedia/en/9/93/Diablo_II_Coverart.png" },
  { id: "simcity-2000", title: "SimCity 2000", platform: "PC / SNES", year: 1993, cover: "https://upload.wikimedia.org/wikipedia/en/8/80/SimCity_2000_coverart.jpg" },
];

const PLATFORMS = ["All", "NES", "SNES", "N64", "PS1", "PS2", "PC", "Sega Genesis", "Arcade", "Multi"];

// ── Storage helpers ─────────────────────────────────────────────────────────
function getStorage() {
  if (typeof window === "undefined") return null;
  if (window.storage) return window.storage;
  const fallback = window.localStorage;
  return {
    async get(key) {
      const value = fallback.getItem(key);
      return value == null ? null : { value };
    },
    async set(key, value) {
      fallback.setItem(key, value);
    },
  };
}

async function loadFavorites() {
  try {
    const storage = getStorage();
    if (!storage) return [];
    const r = await storage.get("cheat-vault-favorites");
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}
async function saveFavorites(favs) {
  try {
    const storage = getStorage();
    if (!storage) return;
    await storage.set("cheat-vault-favorites", JSON.stringify(favs));
  } catch {}
}
async function loadCheatCache() {
  try {
    const storage = getStorage();
    if (!storage) return {};
    const r = await storage.get("cheat-vault-cache");
    return r ? JSON.parse(r.value) : {};
  } catch { return {}; }
}
async function saveCheatCache(cache) {
  try {
    const storage = getStorage();
    if (!storage) return;
    await storage.set("cheat-vault-cache", JSON.stringify(cache));
  } catch {}
}

// ── Pixel / scanline CSS ────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --panel: #12121c;
    --card: #1a1a28;
    --border: #2a2a44;
    --neon: #00ffcc;
    --neon2: #ff3c6e;
    --neon3: #ffe600;
    --text: #e0e0f0;
    --muted: #5a5a7a;
    --font-pixel: 'Press Start 2P', monospace;
    --font-mono: 'Share Tech Mono', monospace;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* scanlines overlay */
  body::before {
    content: '';
    position: fixed; inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.15) 2px,
      rgba(0,0,0,0.15) 4px
    );
    pointer-events: none;
    z-index: 9999;
  }

  .app { max-width: 1200px; margin: 0 auto; padding: 24px 16px 80px; }

  /* Header */
  .header { text-align: center; padding: 40px 0 32px; position: relative; }
  .header-title {
    font-family: var(--font-pixel);
    font-size: clamp(18px, 4vw, 32px);
    color: var(--neon);
    text-shadow: 0 0 10px var(--neon), 0 0 30px rgba(0,255,204,0.4);
    letter-spacing: 2px;
    line-height: 1.4;
    animation: flicker 4s infinite;
  }
  .header-sub {
    font-size: 13px;
    color: var(--muted);
    margin-top: 10px;
    letter-spacing: 1px;
  }
  @keyframes flicker {
    0%,95%,100% { opacity: 1; }
    96% { opacity: 0.7; }
    97% { opacity: 1; }
    98% { opacity: 0.5; }
    99% { opacity: 1; }
  }

  /* Tabs */
  .tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--border); margin-bottom: 24px; }
  .tab {
    font-family: var(--font-pixel);
    font-size: 9px;
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all .2s;
    letter-spacing: 1px;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--neon); border-bottom-color: var(--neon); text-shadow: 0 0 8px var(--neon); }

  /* Search bar */
  .search-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; align-items: center; }
  .search-input {
    flex: 1; min-width: 200px;
    background: var(--panel);
    border: 2px solid var(--border);
    border-radius: 4px;
    padding: 12px 16px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 14px;
    outline: none;
    transition: border-color .2s, box-shadow .2s;
  }
  .search-input:focus {
    border-color: var(--neon);
    box-shadow: 0 0 12px rgba(0,255,204,0.2);
  }
  .search-input::placeholder { color: var(--muted); }

  .filter-select {
    background: var(--panel);
    border: 2px solid var(--border);
    border-radius: 4px;
    padding: 12px 14px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 13px;
    cursor: pointer;
    outline: none;
    transition: border-color .2s;
  }
  .filter-select:focus { border-color: var(--neon); }

  /* Game grid */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 20px; }

  /* Game card */
  .game-card {
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: transform .15s, border-color .2s, box-shadow .2s;
    position: relative;
  }
  .game-card:hover {
    transform: translateY(-4px);
    border-color: var(--neon);
    box-shadow: 0 0 20px rgba(0,255,204,0.2), 0 8px 24px rgba(0,0,0,0.5);
  }
  .game-cover {
    width: 100%; aspect-ratio: 3/4; object-fit: cover;
    display: block;
    background: var(--panel);
  }
  .game-cover-placeholder {
    width: 100%; aspect-ratio: 3/4;
    background: linear-gradient(135deg, #1a1a30, #0d0d1f);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--muted);
    text-align: center;
    padding: 12px;
  }
  .game-info { padding: 12px; }
  .game-title {
    font-family: var(--font-pixel);
    font-size: 8px;
    color: var(--text);
    line-height: 1.6;
    margin-bottom: 6px;
  }
  .game-meta { font-size: 11px; color: var(--muted); }
  .fav-badge {
    position: absolute; top: 8px; right: 8px;
    background: var(--neon2);
    color: #000;
    font-size: 10px;
    border-radius: 3px;
    padding: 2px 5px;
    font-family: var(--font-pixel);
  }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
    padding: 16px;
    animation: fadeIn .15s ease;
  }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  .modal {
    background: var(--panel);
    border: 2px solid var(--neon);
    border-radius: 8px;
    width: 100%; max-width: 680px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 0 40px rgba(0,255,204,0.15), 0 20px 60px rgba(0,0,0,0.7);
    animation: slideUp .2s ease;
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

  .modal-header {
    display: flex; gap: 16px; padding: 20px;
    border-bottom: 2px solid var(--border);
    position: sticky; top: 0;
    background: var(--panel);
    z-index: 1;
  }
  .modal-cover {
    width: 80px; height: 108px; object-fit: cover;
    border: 2px solid var(--border);
    border-radius: 4px;
    flex-shrink: 0;
    background: var(--card);
  }
  .modal-cover-placeholder {
    width: 80px; height: 108px;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 4px;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
  }
  .modal-title-group { flex: 1; min-width: 0; }
  .modal-title {
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--neon);
    line-height: 1.6;
    margin-bottom: 6px;
  }
  .modal-platform { font-size: 12px; color: var(--muted); margin-bottom: 14px; }

  .btn {
    font-family: var(--font-pixel);
    font-size: 8px;
    padding: 9px 14px;
    border-radius: 4px;
    border: 2px solid;
    cursor: pointer;
    transition: all .15s;
    letter-spacing: .5px;
  }
  .btn-neon { color: var(--neon); border-color: var(--neon); background: transparent; }
  .btn-neon:hover { background: rgba(0,255,204,0.1); box-shadow: 0 0 12px rgba(0,255,204,0.3); }
  .btn-red { color: var(--neon2); border-color: var(--neon2); background: transparent; }
  .btn-red:hover { background: rgba(255,60,110,0.1); }
  .btn-close {
    background: transparent; border: none; color: var(--muted);
    font-size: 22px; cursor: pointer; padding: 4px 8px;
    line-height: 1;
    transition: color .15s;
  }
  .btn-close:hover { color: var(--text); }
  .btn-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

  .modal-body { padding: 20px; }

  /* Cheat list */
  .cheat-loading { text-align: center; padding: 40px; color: var(--muted); }
  .loading-dots::after {
    content: '';
    animation: dots 1.2s infinite;
  }
  @keyframes dots {
    0%,20% { content: '.'; }
    40% { content: '..'; }
    60%,100% { content: '...'; }
  }

  .cheat-item {
    background: var(--card);
    border: 1px solid var(--border);
    border-left: 4px solid var(--neon3);
    border-radius: 4px;
    padding: 14px 16px;
    margin-bottom: 12px;
    transition: border-color .2s;
  }
  .cheat-item:hover { border-left-color: var(--neon); }
  .cheat-code {
    font-family: var(--font-pixel);
    font-size: 9px;
    color: var(--neon3);
    letter-spacing: 1px;
    margin-bottom: 8px;
    word-break: break-word;
  }
  .cheat-effect {
    font-size: 14px;
    color: var(--text);
    font-weight: bold;
    margin-bottom: 6px;
  }
  .cheat-how {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
  }

  .empty-state { text-align: center; padding: 60px 20px; color: var(--muted); }
  .empty-icon { font-size: 48px; margin-bottom: 16px; }
  .empty-title { font-family: var(--font-pixel); font-size: 10px; margin-bottom: 10px; }

  .section-label {
    font-family: var(--font-pixel);
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 2px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  /* Favorite cards — only image+title */
  .fav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
  .fav-card {
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: transform .15s, border-color .2s, box-shadow .2s;
  }
  .fav-card:hover {
    transform: translateY(-4px);
    border-color: var(--neon2);
    box-shadow: 0 0 18px rgba(255,60,110,0.25);
  }
  .fav-card-title {
    font-family: var(--font-pixel);
    font-size: 7px;
    color: var(--text);
    padding: 10px;
    line-height: 1.6;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--muted); }

  @media (max-width: 500px) {
    .grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .fav-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
    .modal-header { flex-wrap: wrap; }
  }
`;

// ── Cover image component ────────────────────────────────────────────────────
function GameCover({ src, alt, className }) {
  const [err, setErr] = useState(false);
  if (err) {
    return className?.includes("modal") ? (
      <div className="modal-cover-placeholder">🕹️</div>
    ) : (
      <div className="game-cover-placeholder">{alt?.slice(0, 30)}</div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setErr(true)} />;
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function CheatVault() {
  const [tab, setTab] = useState("browse");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("All");
  const [favorites, setFavorites] = useState([]);
  const [selected, setSelected] = useState(null);
  const [cheats, setCheats] = useState(null);
  const [cheatLoading, setCheatLoading] = useState(false);
  const [cheatError, setCheatError] = useState(null);
  const [cache, setCache] = useState({});
  const [storageReady, setStorageReady] = useState(false);

  // Load persisted data
  useEffect(() => {
    (async () => {
      const [favs, ch] = await Promise.all([loadFavorites(), loadCheatCache()]);
      setFavorites(favs);
      setCache(ch);
      setStorageReady(true);
    })();
  }, []);

  // Filter games
  const filtered = GAME_DB.filter(g => {
    const q = query.toLowerCase();
    const matchQ = !q || g.title.toLowerCase().includes(q) || g.platform.toLowerCase().includes(q);
    const matchP = platform === "All" || g.platform.includes(platform);
    return matchQ && matchP;
  });

  const isFav = (id) => favorites.some(f => f.id === id);

  const toggleFav = (game, e) => {
    e?.stopPropagation();
    setFavorites(prev => {
      const next = isFav(game.id) ? prev.filter(f => f.id !== game.id) : [...prev, game];
      saveFavorites(next);
      return next;
    });
  };

  const openGame = async (game, cacheSnapshot = cache) => {
    setSelected(game);
    if (cacheSnapshot[game.id]) {
      setCheats(cacheSnapshot[game.id]);
      setCheatError(null);
      return;
    }
    setCheats(null);
    setCheatError(null);
    setCheatLoading(true);
    try {
      const res = await fetch("/api/cheats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load cheats.");
      }

      setCheats(data.cheats);
      setCache(prev => {
        const next = { ...prev, [game.id]: data.cheats };
        saveCheatCache(next);
        return next;
      });
    } catch (e) {
      setCheatError("Couldn't load cheats. Check your connection and try again.");
    } finally {
      setCheatLoading(false);
    }
  };

  const closeModal = () => { setSelected(null); setCheats(null); setCheatError(null); };

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-title">⚡ CHEAT VAULT ⚡</div>
          <div className="header-sub">// UNLIMITED POWER — NO SKILL REQUIRED //</div>
        </header>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>
            BROWSE
          </button>
          <button className={`tab ${tab === "favorites" ? "active" : ""}`} onClick={() => setTab("favorites")}>
            SAVED ({favorites.length})
          </button>
        </div>

        {/* Browse tab */}
        {tab === "browse" && (
          <>
            <div className="search-row">
              <input
                className="search-input"
                placeholder="Search games..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <select className="filter-select" value={platform} onChange={e => setPlatform(e.target.value)}>
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="section-label">// {filtered.length} GAMES FOUND</div>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">NO RESULTS</div>
                <div style={{ fontSize: 12 }}>Try a different search</div>
              </div>
            ) : (
              <div className="grid">
                {filtered.map(game => (
                  <div key={game.id} className="game-card" onClick={() => openGame(game)}>
                    {isFav(game.id) && <div className="fav-badge">★</div>}
                    <GameCover src={game.cover} alt={game.title} className="game-cover" />
                    <div className="game-info">
                      <div className="game-title">{game.title}</div>
                      <div className="game-meta">{game.platform} · {game.year}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Favorites tab */}
        {tab === "favorites" && (
          <>
            {favorites.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🕹️</div>
                <div className="empty-title">NO SAVED GAMES YET</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>Browse games and hit the ★ SAVE button to pin cheats here</div>
              </div>
            ) : (
              <>
                <div className="section-label">// YOUR SAVED GAMES — CLICK TO VIEW CHEATS</div>
                <div className="fav-grid">
                  {favorites.map(game => (
                    <div key={game.id} className="fav-card" onClick={() => openGame(game)}>
                      <GameCover src={game.cover} alt={game.title} className="game-cover" />
                      <div className="fav-card-title">{game.title}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <GameCover src={selected.cover} alt={selected.title} className="modal-cover" />
              <div className="modal-title-group">
                <div className="modal-title">{selected.title}</div>
                <div className="modal-platform">{selected.platform} · {selected.year}</div>
                <div className="btn-row">
                  <button
                    className={`btn ${isFav(selected.id) ? "btn-red" : "btn-neon"}`}
                    onClick={(e) => toggleFav(selected, e)}
                  >
                    {isFav(selected.id) ? "★ SAVED" : "☆ SAVE"}
                  </button>
                  <button className="btn btn-red" onClick={() => { const nc = {...cache}; delete nc[selected.id]; setCache(nc); saveCheatCache(nc); openGame(selected, nc); }}>
                    ↺ RELOAD
                  </button>
                </div>
              </div>
              <button className="btn-close" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">
              {cheatLoading && (
                <div className="cheat-loading">
                  <div style={{ fontFamily: "var(--font-pixel)", fontSize: 10, color: "var(--neon)", marginBottom: 12 }}>
                    LOADING CHEATS<span className="loading-dots" />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Accessing the cheat database...</div>
                </div>
              )}
              {cheatError && (
                <div className="empty-state">
                  <div className="empty-icon">⚠️</div>
                  <div className="empty-title">ERROR</div>
                  <div style={{ fontSize: 12 }}>{cheatError}</div>
                </div>
              )}
              {cheats && cheats.map((c, i) => (
                <div key={i} className="cheat-item">
                  <div className="cheat-code">{c.code}</div>
                  <div className="cheat-effect">{c.effect}</div>
                  <div className="cheat-how">📋 {c.howTo}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
