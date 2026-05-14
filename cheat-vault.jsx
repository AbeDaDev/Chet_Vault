import { useState, useEffect } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_COVER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a1a30" />
          <stop offset="100%" stop-color="#090912" />
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00ffcc" />
          <stop offset="100%" stop-color="#ff3c6e" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" rx="8" fill="url(#bg)" />
      <path d="M42 52h216v296H42z" fill="none" stroke="url(#accent)" stroke-width="6" opacity=".8" />
      <circle cx="150" cy="150" r="54" fill="none" stroke="#ffe600" stroke-width="8" opacity=".95" />
      <rect x="108" y="220" width="84" height="18" rx="9" fill="#00ffcc" opacity=".9" />
      <rect x="96" y="255" width="108" height="12" rx="6" fill="#2a2a44" />
      <path d="M70 330l46-32 34 24 80-60 40 28" fill="none" stroke="#ff3c6e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="224" cy="98" r="10" fill="#00ffcc" />
      <circle cx="76" cy="98" r="10" fill="#ff3c6e" />
    </svg>
  `);

// ── Seed game database ──────────────────────────────────────────────────────
const FEATURED_GAMES = [
  { id: "gta-sa", title: "Grand Theft Auto: San Andreas", platform: "PS2 / PC / Xbox", year: 2004, cover: "https://upload.wikimedia.org/wikipedia/en/c/c4/GTASABOX.jpg" },
  { id: "gta-vice-city", title: "Grand Theft Auto: Vice City", platform: "PS2 / PC", year: 2002, cover: "https://upload.wikimedia.org/wikipedia/en/c/ce/Vice-city-cover.jpg" },
  { id: "gta-v", title: "Grand Theft Auto V", platform: "PS3 / PS4 / Xbox 360 / Xbox One / PC", year: 2013, cover: "https://upload.wikimedia.org/wikipedia/en/a/a5/Grand_Theft_Auto_V.png" },
  { id: "sims-4", title: "The Sims 4", platform: "PC / Mac / Console", year: 2014, cover: "https://upload.wikimedia.org/wikipedia/en/7/7f/Sims4_Rebrand.png" },
  { id: "minecraft", title: "Minecraft", platform: "PC / Multi", year: 2011, cover: "https://upload.wikimedia.org/wikipedia/en/5/51/Minecraft_cover.png" },
  { id: "skyrim", title: "The Elder Scrolls V: Skyrim", platform: "PC / PS3 / Xbox 360", year: 2011, cover: "https://upload.wikimedia.org/wikipedia/en/1/15/The_Elder_Scrolls_V_Skyrim_cover.png" },
  { id: "doom-1993", title: "DOOM (1993)", platform: "PC / Multi", year: 1993, cover: "https://upload.wikimedia.org/wikipedia/en/5/57/Doom_cover_art.jpg" },
  { id: "contra", title: "Contra", platform: "NES / Arcade", year: 1988, cover: "https://upload.wikimedia.org/wikipedia/en/6/65/Contra_cover.jpg" },
  { id: "goldeneye-007", title: "GoldenEye 007", platform: "N64", year: 1997, cover: "https://upload.wikimedia.org/wikipedia/en/1/13/GoldenEye_007_N64_cover.jpg" },
  { id: "street-fighter-2", title: "Street Fighter II", platform: "SNES / Arcade", year: 1991, cover: "https://upload.wikimedia.org/wikipedia/en/1/1d/SF2_JPN_flyer.jpg" },
  { id: "mortal-kombat-2", title: "Mortal Kombat II", platform: "SNES / Genesis / Arcade", year: 1993, cover: "https://upload.wikimedia.org/wikipedia/en/d/df/Mortal_Kombat_II_boxart.png" },
  { id: "sonic-3", title: "Sonic the Hedgehog 3", platform: "Sega Genesis", year: 1994, cover: "https://upload.wikimedia.org/wikipedia/en/0/07/Sonic3-box-us-225.jpg" },
  { id: "tony-hawk-pro-skater-2", title: "Tony Hawk's Pro Skater 2", platform: "PS1 / N64 / PC", year: 2000, cover: "https://upload.wikimedia.org/wikipedia/en/4/41/Tony_Hawk%27s_Pro_Skater_2_cover.png" },
  { id: "pokemon-red-blue", title: "Pokémon Red and Blue", platform: "Game Boy", year: 1996, cover: "https://upload.wikimedia.org/wikipedia/en/a/af/Pok%C3%A9mon_Red_and_Blue_cover_art.webp" },
  { id: "age-of-empires-2", title: "Age of Empires II", platform: "PC", year: 1999, cover: "https://upload.wikimedia.org/wikipedia/en/5/56/Age_of_Empires_II_-_The_Age_of_Kings_Coverart.png" },
];

const SEARCH_BACKUP_GAMES = [
  { id: "toy-story-1", title: "Toy Story (video game)", platform: "SNES / Genesis / PC", year: 1995, cover: "https://upload.wikimedia.org/wikipedia/en/e/e5/Toy_Story_Video_Game_SNES.png" },
  { id: "toy-story-2", title: "Toy Story 2 (video game)", platform: "PS1 / N64 / GBC", year: 1999, cover: "https://upload.wikimedia.org/wikipedia/en/5/5b/ToyStory2_videogame_gbc_cover.jpg" },
  { id: "toy-story-3", title: "Toy Story 3 (video game)", platform: "PS3 / Xbox 360 / Wii", year: 2010, cover: "https://upload.wikimedia.org/wikipedia/en/6/6c/Toy_Story_3_Cover_Art.jpg" },
  { id: "toy-story-mania", title: "Toy Story Mania!", platform: "Wii / PS3 / Xbox 360", year: 2009, cover: "https://upload.wikimedia.org/wikipedia/en/9/9e/Toy_Story_Mania.jpg" },
  { id: "toy-story-racer", title: "Toy Story Racer", platform: "PS1", year: 2000, cover: "https://upload.wikimedia.org/wikipedia/en/e/e1/Toy_Story_Racer.jpg" },
  { id: "toy-story-2-buzz", title: "Toy Story 2: Buzz Lightyear to the Rescue", platform: "N64 / PS1 / PC", year: 1999, cover: "https://upload.wikimedia.org/wikipedia/en/2/21/Buzz_Lightyear_to_the_Rescue_art.png" },
  { id: "super-mario-world", title: "Super Mario World", platform: "SNES", year: 1990, cover: "https://upload.wikimedia.org/wikipedia/en/a/a0/Super_Mario_World_Coverart.png" },
  { id: "super-mario-64", title: "Super Mario 64", platform: "N64", year: 1996, cover: "https://upload.wikimedia.org/wikipedia/en/1/1b/Super_Mario_64.jpg" },
  { id: "pokemon-yellow", title: "Pokémon Yellow", platform: "Game Boy", year: 1998, cover: "https://upload.wikimedia.org/wikipedia/en/b/bd/Pok%C3%A9mon_Yellow_Version.png" },
  { id: "pokemon-silver", title: "Pokémon Silver", platform: "Game Boy Color", year: 1999, cover: "https://upload.wikimedia.org/wikipedia/en/3/3c/Pokemon_Silver.png" },
  { id: "final-fantasy-vii", title: "Final Fantasy VII", platform: "PS1 / PC", year: 1997, cover: "https://upload.wikimedia.org/wikipedia/en/5/5f/Final_Fantasy_VII_Box_Art.jpg" },
  { id: "half-life", title: "Half-Life", platform: "PC", year: 1998, cover: "https://upload.wikimedia.org/wikipedia/en/f/fa/Half-Life_Cover_Art.jpg" },
  { id: "zelda-a-link-to-the-past", title: "The Legend of Zelda: A Link to the Past", platform: "SNES", year: 1991, cover: "https://upload.wikimedia.org/wikipedia/en/3/3b/The_Legend_of_Zelda_A_Link_to_the_Past_SNES_Game_Cover.jpg" },
  { id: "metroid", title: "Metroid", platform: "NES", year: 1986, cover: "https://upload.wikimedia.org/wikipedia/en/3/37/Metroid_cover.jpg" },
  { id: "street-fighter-alpha-3", title: "Street Fighter Alpha 3", platform: "Arcade / PS1", year: 1998, cover: "https://upload.wikimedia.org/wikipedia/en/3/3c/Street_Fighter_Alpha_3_arcade_flyer.jpg" },
];

const PLATFORMS = ["All", "Game Boy", "NES", "SNES", "N64", "PS1", "PS2", "PS3", "PS4", "PC", "Mac", "Xbox", "Xbox 360", "Xbox One", "Sega Genesis", "Arcade", "Multi", "Console"];

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
  .game-card-top {
    position: absolute;
    inset: 8px 8px auto auto;
    z-index: 2;
  }
  .card-save-btn {
    font-family: var(--font-pixel);
    font-size: 8px;
    background: rgba(10, 10, 15, 0.85);
    color: var(--neon);
    border: 1px solid var(--neon);
    border-radius: 999px;
    padding: 6px 8px;
    cursor: pointer;
    text-transform: uppercase;
  }
  .card-save-btn.saved {
    color: #000;
    background: var(--neon2);
    border-color: var(--neon2);
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
  .cheat-head {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .cheat-code {
    font-family: var(--font-pixel);
    font-size: 9px;
    color: var(--neon3);
    letter-spacing: 1px;
    word-break: break-word;
    line-height: 1.5;
  }
  .cheat-console {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--neon);
    border: 1px solid var(--neon);
    border-radius: 999px;
    padding: 3px 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
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
    .cheat-head { flex-wrap: wrap; }
  }
`;

// ── Cover image component ────────────────────────────────────────────────────
function GameCover({ src, alt, className }) {
  const [err, setErr] = useState(false);
  return (
    <img
      src={err || !src ? DEFAULT_COVER : src}
      alt={alt}
      className={className}
      onError={() => setErr(true)}
    />
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function CheatVault() {
  const [tab, setTab] = useState("browse");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("All");
  const [favorites, setFavorites] = useState([]);
  const [games, setGames] = useState([...FEATURED_GAMES, ...SEARCH_BACKUP_GAMES]);
  const [selected, setSelected] = useState(null);
  const [cheats, setCheats] = useState(null);
  const [cheatLoading, setCheatLoading] = useState(false);
  const [cheatError, setCheatError] = useState(null);
  const [cache, setCache] = useState({});
  const [storageReady, setStorageReady] = useState(false);
  const [remoteResults, setRemoteResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Load persisted data
  useEffect(() => {
    (async () => {
      const [favs, ch] = await Promise.all([loadFavorites(), loadCheatCache()]);
      setFavorites(favs);
      setCache(ch);
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    setGames([...FEATURED_GAMES, ...SEARCH_BACKUP_GAMES]);
  }, []);

  useEffect(() => {
    if (tab !== "browse") return;

    const q = query.trim();
    if (!q) {
      setRemoteResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/search-games?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Search failed.");
        }
        setRemoteResults(Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if (error?.name !== "AbortError") {
          setSearchError("Search could not load game results.");
          setRemoteResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, tab]);

  // Filter games
  const filtered = games.filter(g => {
    const q = query.toLowerCase();
    const matchQ = !q || g.title.toLowerCase().includes(q) || g.platform.toLowerCase().includes(q);
    const matchP = platform === "All" || g.platform.includes(platform);
    return matchQ && matchP;
  });

  const isFav = (id) => favorites.some(f => f.id === id);
  const showingRemoteSearch = tab === "browse" && query.trim().length > 0;
  const browseItems = showingRemoteSearch && remoteResults.length > 0 ? remoteResults : filtered;

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
            <div className="section-label">
              // {showingRemoteSearch ? `${remoteResults.length} ONLINE RESULTS` : `${filtered.length} GAMES FOUND`}
            </div>
            {showingRemoteSearch && searchLoading ? (
              <div className="empty-state">
                <div className="empty-icon">⌛</div>
                <div className="empty-title">SEARCHING</div>
                <div style={{ fontSize: 12 }}>Looking up game titles...</div>
              </div>
            ) : showingRemoteSearch && searchError ? (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <div className="empty-title">SEARCH ERROR</div>
                <div style={{ fontSize: 12 }}>{searchError}</div>
              </div>
            ) : browseItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">NO RESULTS</div>
                <div style={{ fontSize: 12 }}>
                  {showingRemoteSearch ? "Try a broader game title" : "Try a different search"}
                </div>
              </div>
            ) : (
              <div className="grid">
                {browseItems.map(game => (
                  <div key={game.id} className="game-card" onClick={() => openGame(game)}>
                    <div className="game-card-top">
                      <button
                        className={`card-save-btn ${isFav(game.id) ? "saved" : ""}`}
                        onClick={(e) => toggleFav(game, e)}
                      >
                        {isFav(game.id) ? "Saved" : "Save"}
                      </button>
                    </div>
                    {isFav(game.id) && <div className="fav-badge">★</div>}
                    <GameCover src={game.cover} alt={game.title} className="game-cover" />
                    <div className="game-info">
                      <div className="game-title">{game.title}</div>
                      <div className="game-meta">
                        {game.platform ? `${game.platform} · ` : ""}
                        {game.year || game.description || "Game result"}
                      </div>
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
              <GameCover src={selected.cover || DEFAULT_COVER} alt={selected.title} className="modal-cover" />
              <div className="modal-title-group">
                <div className="modal-title">{selected.title}</div>
                <div className="modal-platform">{selected.platform || selected.description || "Platform info unavailable"}{selected.year ? ` · ${selected.year}` : ""}</div>
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
                  <div className="cheat-head">
                    <div className="cheat-code">{c.code}</div>
                    <div className="cheat-console">{c.console || selected.platform || "Console unknown"}</div>
                  </div>
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
