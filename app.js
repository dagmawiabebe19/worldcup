const JSONBIN_API_KEY = "$2a$10$t.w0IFUt81SSh6ILkJZ1Re4nbiMFQcSdp7ZGS5gEA7/HpuG.aljZm";
const JSONBIN_API = "https://api.jsonbin.io/v3/b";
const PER = 3;
const LS_PREFIX = "wc26:";

const TEAMS = [
  ["France", "fr", "I", 1], ["Spain", "es", "H", 2], ["Argentina", "ar", "J", 3], ["England", "gb-eng", "L", 4],
  ["Portugal", "pt", "K", 5], ["Brazil", "br", "C", 6], ["Netherlands", "nl", "F", 7], ["Morocco", "ma", "C", 8],
  ["Belgium", "be", "G", 9], ["Germany", "de", "E", 10], ["Croatia", "hr", "L", 11], ["Colombia", "co", "K", 13],
  ["Senegal", "sn", "I", 14], ["Mexico", "mx", "A", 15], ["United States", "us", "D", 16], ["Uruguay", "uy", "H", 17],
  ["Japan", "jp", "F", 18], ["Switzerland", "ch", "B", 19], ["Iran", "ir", "G", 21], ["Austria", "at", "J", 23],
  ["Ecuador", "ec", "E", 24], ["Australia", "au", "D", 26], ["South Korea", "kr", "A", 25], ["Egypt", "eg", "G", 29],
  ["Canada", "ca", "B", 30], ["Ivory Coast", "ci", "E", 33], ["Qatar", "qa", "B", 35], ["Algeria", "dz", "J", 36],
  ["Sweden", "se", "F", 39], ["Tunisia", "tn", "F", 40], ["Czechia", "cz", "A", 41], ["Türkiye", "tr", "D", 42],
  ["Norway", "no", "I", 44], ["Scotland", "gb-sct", "C", 47], ["DR Congo", "cd", "K", 51], ["Bosnia & Herz.", "ba", "B", 52],
  ["Panama", "pa", "L", 53], ["Saudi Arabia", "sa", "H", 57], ["South Africa", "za", "A", 60], ["Iraq", "iq", "I", 61],
  ["Uzbekistan", "uz", "K", 62], ["Paraguay", "py", "D", 64], ["Ghana", "gh", "L", 65], ["Jordan", "jo", "J", 68],
  ["Cape Verde", "cv", "H", 70], ["Curaçao", "cw", "E", 81], ["Haiti", "ht", "C", 83], ["New Zealand", "nz", "G", 95]
].map((t) => ({ name: t[0], code: t[1], group: t[2], rank: t[3] }));

const byCode = Object.fromEntries(TEAMS.map((t) => [t.code, t]));
const SPECIAL = { "gb-eng": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "gb-sct": "🏴󠁧󠁢󠁳󠁣󠁴󠁿" };

const flag = (c) => {
  if (SPECIAL[c]) return SPECIAL[c];
  return c.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
};

const $ = (id) => document.getElementById(id);

let binId = null;
let useLocalOnly = !JSONBIN_API_KEY;
let MY_NAME = localStorage.getItem("wc26:name") || null;
let broadcast = null;

function keyFor(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function takenSet(players) {
  const s = new Set();
  players.forEach((p) => (p.teams || []).forEach((c) => s.add(c)));
  return s;
}

function lsKey() {
  return LS_PREFIX + binId;
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(lsKey());
    if (!raw) return { players: [] };
    return JSON.parse(raw);
  } catch {
    return { players: [] };
  }
}

function writeLocalState(state) {
  localStorage.setItem(lsKey(), JSON.stringify(state));
  notifyPeers();
}

function jsonbinHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "X-Master-Key": JSONBIN_API_KEY,
    ...extra
  };
}

async function jsonbinRequest(path, options = {}) {
  const res = await fetch(`${JSONBIN_API}${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body;
}

function getHashBinId() {
  return location.hash.replace(/^#/, "").trim();
}

function setHashBinId(id) {
  if (getHashBinId() !== id) {
    history.replaceState(null, "", `#${id}`);
  }
  binId = id;
}

function newLocalBinId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function setupBroadcast() {
  if (!binId || typeof BroadcastChannel === "undefined") return;
  if (broadcast) broadcast.close();
  broadcast = new BroadcastChannel(`wc26-draw-${binId}`);
  broadcast.onmessage = () => refresh();
}

function notifyPeers() {
  broadcast?.postMessage("sync");
}

async function createRemoteBin() {
  const data = await jsonbinRequest("", {
    method: "POST",
    headers: jsonbinHeaders({
      "X-Bin-Private": "false",
      "X-Bin-Name": "WC26 Bandwagon Draw"
    }),
    body: JSON.stringify({ players: [] })
  });
  return data.metadata.id;
}

async function loadPlayers() {
  if (useLocalOnly) {
    return (readLocalState().players || []).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  }

  const data = await jsonbinRequest(`/${binId}/latest`, {
    headers: jsonbinHeaders()
  });
  const players = data.record?.players || [];
  return players.sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

async function savePlayers(players) {
  if (useLocalOnly) {
    writeLocalState({ players });
    return;
  }

  await jsonbinRequest(`/${binId}`, {
    method: "PUT",
    headers: jsonbinHeaders(),
    body: JSON.stringify({ players })
  });
  notifyPeers();
}

function renderBoard(players) {
  const taken = takenSet(players);
  const remaining = TEAMS.filter((t) => !taken.has(t.code));

  $("statPlayers").textContent = players.length;
  $("statRemaining").textContent = remaining.length;
  $("statPer").textContent = PER;

  const list = $("playerList");
  if (!players.length) {
    list.innerHTML = '<div class="empty">No one has drawn yet. Be the first to open the hat. 🎩</div>';
  } else {
    list.innerHTML = players.map((p) => {
      const chips = (p.teams || []).map((c) => {
        const t = byCode[c];
        if (!t) return "";
        return `<span class="pill"><span class="fl">${flag(t.code)}</span>${t.name}</span>`;
      }).join("");
      const me = MY_NAME && keyFor(p.name) === keyFor(MY_NAME) ? " — you" : "";
      return `<div class="player">
        <div class="who">${escapeHtml(p.name)}<span>${(p.teams || []).length} teams${me}</span></div>
        <div class="teams">${chips}</div>
      </div>`;
    }).join("");
  }

  $("remainingSummary").textContent = `Still in the hat (${remaining.length})`;
  $("remainingList").innerHTML = remaining.length
    ? remaining.sort((a, b) => a.rank - b.rank).map((t) =>
      `<span class="pill"><span class="fl">${flag(t.code)}</span>${t.name}</span>`).join("")
    : '<div class="empty">Empty — every team has been drawn. 🟢</div>';
}

function showReveal(teams, label) {
  const r = $("reveal");
  const g = $("revealGrid");
  $("revealLabel").textContent = label;
  g.innerHTML = teams.map((c, i) => {
    const t = byCode[c];
    return `<div class="team-card" style="animation-delay:${i * 0.14}s">
      <div class="fl-big">${flag(t.code)}</div>
      <div class="name">${t.name}</div>
      <div class="meta">FIFA #${t.rank}</div>
      <div class="grp">Group ${t.group}</div>
    </div>`;
  }).join("");
  r.style.display = "block";
}

function pickTeams(players) {
  const taken = takenSet(players);
  const pool = TEAMS.filter((t) => !taken.has(t.code)).map((t) => t.code);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(PER, pool.length));
}

async function doDraw() {
  const name = $("nameInput").value.trim();
  if (!name) {
    toast("Enter your name first.");
    return;
  }
  if (name.length < 2) {
    toast("Use at least 2 characters.");
    return;
  }

  const btn = $("drawBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Reaching in…';

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const players = await loadPlayers();
      const mine = players.find((p) => keyFor(p.name) === keyFor(name));
      if (mine) {
        MY_NAME = mine.name;
        localStorage.setItem("wc26:name", mine.name);
        showReveal(mine.teams, `${mine.name}, you already drew these:`);
        renderBoard(players);
        btn.textContent = "Already drawn ✓";
        toast("You've already drawn — no take-backs!");
        return;
      }

      const picked = pickTeams(players);
      if (!picked.length) {
        toast("The hat is empty!");
        btn.disabled = false;
        btn.textContent = "Pull from the hat";
        return;
      }

      const record = { name, teams: picked, ts: Date.now() };
      const next = [...players, record];
      await savePlayers(next);

      const verify = await loadPlayers();
      const saved = verify.find((p) => keyFor(p.name) === keyFor(name));
      if (saved && saved.teams.join() === picked.join()) {
        MY_NAME = name;
        localStorage.setItem("wc26:name", name);
        showReveal(picked, `${name}, the hat gave you:`);
        confettiBurst();
        renderBoard(verify);
        btn.textContent = "Already drawn ✓";
        return;
      }
    }

    toast("Draw collision — try again.");
    btn.disabled = false;
    btn.textContent = "Pull from the hat";
  } catch (e) {
    console.error(e);
    toast("Something went wrong — try again.");
    btn.disabled = false;
    btn.textContent = "Pull from the hat";
  }
}

async function resetAll() {
  if (!confirm("Wipe ALL draws for everyone? This can't be undone.")) return;

  try {
    await savePlayers([]);
    MY_NAME = null;
    localStorage.removeItem("wc26:name");
    $("reveal").style.display = "none";
    $("nameInput").value = "";
    $("drawBtn").disabled = false;
    $("drawBtn").textContent = "Pull from the hat";
    await refresh();
    toast("Reset done. Fresh hat.");
  } catch (e) {
    console.error(e);
    toast("Reset failed — try again.");
  }
}

async function refresh() {
  try {
    const players = await loadPlayers();
    if (MY_NAME) {
      const me = players.find((p) => keyFor(p.name) === keyFor(MY_NAME));
      if (me) {
        $("nameInput").value = me.name;
        $("drawBtn").disabled = true;
        $("drawBtn").textContent = "Already drawn ✓";
      }
    }
    renderBoard(players);
  } catch (e) {
    console.error(e);
    toast("Couldn't refresh the board.");
  }
}

async function ensureBin() {
  const existing = getHashBinId();

  if (useLocalOnly) {
    binId = existing || newLocalBinId();
    setHashBinId(binId);
    if (!readLocalState().players) writeLocalState({ players: [] });
    setupBroadcast();
    return;
  }

  if (existing) {
    binId = existing;
    setupBroadcast();
    try {
      await loadPlayers();
      return;
    } catch (e) {
      console.warn("Shared bin not found, creating a new hat.", e);
    }
  }

  $("tagline").textContent = "Creating a new hat…";
  try {
    binId = await createRemoteBin();
    setHashBinId(binId);
    setupBroadcast();
  } catch (e) {
    console.warn("JSONBin unavailable, using local storage.", e);
    useLocalOnly = true;
    binId = existing || newLocalBinId();
    setHashBinId(binId);
    if (!readLocalState().players) writeLocalState({ players: [] });
    setupBroadcast();
  }
}

function confettiBurst() {
  const cv = $("confetti");
  const ctx = cv.getContext("2d");
  cv.width = innerWidth;
  cv.height = innerHeight;
  const cols = ["#ffd23f", "#2fbf71", "#ffffff", "#e0a800"];
  const parts = [];
  for (let i = 0; i < 130; i++) {
    parts.push({
      x: innerWidth / 2,
      y: innerHeight * 0.32,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      g: 0.34,
      s: Math.random() * 7 + 4,
      c: cols[i % cols.length],
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      life: 0
    });
  }
  let frames = 0;
  (function anim() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach((p) => {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    });
    frames++;
    if (frames < 150) requestAnimationFrame(anim);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

async function boot() {
  $("drawBtn").disabled = false;
  $("drawBtn").textContent = "Pull from the hat";
  if (MY_NAME) $("nameInput").value = MY_NAME;

  try {
    await ensureBin();
    $("tagline").innerHTML = "48 teams in the hat &middot; <b>3</b> each &middot; <b>16</b> bandwagoners";
    await refresh();
    setInterval(refresh, 6000);
  } catch (e) {
    console.error(e);
    $("tagline").textContent = "Couldn't connect to the hat — refresh to retry.";
    toast("Couldn't connect — check your connection and refresh.");
  }
}

$("drawBtn").addEventListener("click", doDraw);
$("refreshBtn").addEventListener("click", () => { refresh(); toast("Board refreshed."); });
$("resetBtn").addEventListener("click", resetAll);
$("nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doDraw(); });
window.addEventListener("hashchange", async () => {
  binId = getHashBinId();
  setupBroadcast();
  await refresh();
});

boot();
