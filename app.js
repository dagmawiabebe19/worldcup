const JSONBIN_API_KEY = "$2a$10$t.w0IFUt81SSh6ILkJZ1Re4nbiMFQcSdp7ZGS5gEA7/HpuG.aljZm";
const JSONBIN_API = "https://api.jsonbin.io/v3/b";
const PER = 3;
const MAX_SLOTS = 16;
const LS_PREFIX = "wc26:";
const ADMIN_SECRET = "dagworldcup20206";
const ADMIN_LS_KEY = "isAdmin";

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

function defaultState() {
  return { phase: "slots", slots: [], players: [] };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return defaultState();
  return {
    phase: raw.phase === "teams" ? "teams" : "slots",
    slots: Array.isArray(raw.slots) ? raw.slots : [],
    players: Array.isArray(raw.players) ? raw.players : []
  };
}

function parseHash() {
  const raw = location.hash.slice(1).trim();
  if (!raw) return { binId: null, adminTrigger: false };

  let binId = null;
  let adminTrigger = false;

  for (const part of raw.split("&")) {
    if (part.startsWith("admin=")) {
      adminTrigger = decodeURIComponent(part.slice(6)) === ADMIN_SECRET;
    } else if (!part.includes("=")) {
      binId = part;
    }
  }

  if (!raw.includes("&") && raw.startsWith("admin=")) {
    adminTrigger = decodeURIComponent(raw.slice(6)) === ADMIN_SECRET;
  } else if (!raw.includes("&") && !raw.includes("=")) {
    binId = raw;
  }

  return { binId, adminTrigger };
}

function getHashBinId() {
  return parseHash().binId;
}

function setHashBinId(id) {
  const { adminTrigger } = parseHash();
  const suffix = adminTrigger ? `&admin=${ADMIN_SECRET}` : "";
  const next = `#${id}${suffix}`;
  if (location.hash !== next) history.replaceState(null, "", next);
  binId = id;
}

function checkAdminFromHash() {
  const hash = location.hash.slice(1);
  if (hash.includes(`admin=${ADMIN_SECRET}`)) {
    localStorage.setItem(ADMIN_LS_KEY, "true");
  }
}

function isAdmin() {
  return localStorage.getItem(ADMIN_LS_KEY) === "true";
}

function applyAdminUI() {
  const admin = isAdmin();
  document.body.classList.toggle("is-admin", admin);

  $("openHatBtn")?.classList.toggle("hidden", !admin);
  $("resetBtn")?.classList.toggle("hidden", !admin);
  document.querySelector(".admin-actions")?.classList.toggle("hidden", !admin);
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

function slotMap(slots) {
  const m = new Map();
  slots.forEach((s) => m.set(s.slot, s));
  return m;
}

function lsKey() {
  return LS_PREFIX + binId;
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(lsKey());
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
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
    body: JSON.stringify(defaultState())
  });
  return data.metadata.id;
}

async function loadState() {
  if (useLocalOnly) {
    return readLocalState();
  }

  const data = await jsonbinRequest(`/${binId}/latest`, {
    headers: jsonbinHeaders()
  });
  return normalizeState(data.record);
}

async function saveState(state) {
  const payload = normalizeState(state);
  if (useLocalOnly) {
    writeLocalState(payload);
    return;
  }

  await jsonbinRequest(`/${binId}`, {
    method: "PUT",
    headers: jsonbinHeaders(),
    body: JSON.stringify(payload)
  });
  notifyPeers();
}

function pickRandomSlot(slots) {
  const taken = new Set(slots.map((s) => s.slot));
  const pool = [];
  for (let n = 1; n <= MAX_SLOTS; n++) {
    if (!taken.has(n)) pool.push(n);
  }
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
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

function findSlotHolder(slots, name) {
  return slots.find((s) => keyFor(s.name) === keyFor(name));
}

function nextUndrawnSlot(slots, players) {
  const drawn = new Set(players.map((p) => keyFor(p.name)));
  for (let n = 1; n <= MAX_SLOTS; n++) {
    const holder = slots.find((s) => s.slot === n);
    if (holder && !drawn.has(keyFor(holder.name))) return n;
  }
  return null;
}

function renderSlotBoard(state) {
  const map = slotMap(state.slots);
  const rows = [];
  for (let n = 1; n <= MAX_SLOTS; n++) {
    const entry = map.get(n);
    const me = entry && MY_NAME && keyFor(entry.name) === keyFor(MY_NAME) ? " — you" : "";
    rows.push(`<div class="slot-entry">
      <span class="slot-num">Slot ${n}</span>
      <span class="slot-name${entry ? "" : " empty"}">${entry ? escapeHtml(entry.name) + me : "—"}</span>
    </div>`);
  }
  $("slotList").innerHTML = rows.join("");

  const filled = state.slots.length;
  $("statSlotsFilled").textContent = filled;
  $("statSlotsLeft").textContent = MAX_SLOTS - filled;
}

function renderSlotLadder(state, players) {
  const map = slotMap(state.slots);
  const current = nextUndrawnSlot(state.slots, players);
  const drawn = new Set(players.map((p) => keyFor(p.name)));

  $("slotLadder").innerHTML = Array.from({ length: MAX_SLOTS }, (_, i) => {
    const n = i + 1;
    const entry = map.get(n);
    const name = entry ? escapeHtml(entry.name) : "—";
    const classes = ["slot-row"];
    if (entry && MY_NAME && keyFor(entry.name) === keyFor(MY_NAME)) classes.push("is-me");
    if (n === current) classes.push("is-current");
    const done = entry && drawn.has(keyFor(entry.name));
    return `<div class="${classes.join(" ")}">
      <span class="slot-num">${n}</span>
      <span class="slot-name${entry ? "" : " empty"}">${name}${done ? " ✓" : ""}</span>
    </div>`;
  }).join("");
}

function renderTeamBoard(state) {
  const players = state.players.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const taken = takenSet(players);
  const remaining = TEAMS.filter((t) => !taken.has(t.code));

  $("statPlayers").textContent = players.length;
  $("statRemaining").textContent = remaining.length;
  $("statPer").textContent = PER;

  const list = $("playerList");
  if (!players.length) {
    list.innerHTML = '<div class="empty">No teams drawn yet. Slot 1 goes first!</div>';
  } else {
    list.innerHTML = players.map((p) => {
      const holder = findSlotHolder(state.slots, p.name);
      const slotLabel = holder ? `Slot ${holder.slot}` : "";
      const chips = (p.teams || []).map((c) => {
        const t = byCode[c];
        if (!t) return "";
        return `<span class="pill"><span class="fl">${flag(t.code)}</span>${t.name}</span>`;
      }).join("");
      const me = MY_NAME && keyFor(p.name) === keyFor(MY_NAME) ? " — you" : "";
      return `<div class="player">
        <div class="who">${escapeHtml(p.name)}<span>${slotLabel}${me}</span></div>
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

function showSlotReveal(slotNum, name) {
  $("revealGrid").innerHTML = `<div class="slot-reveal-card">
    <div class="meta">Your slot</div>
    <div class="big">${slotNum}</div>
    <div class="name">${escapeHtml(name)}</div>
  </div>`;
  $("reveal").style.display = "block";
}

function showReveal(teams, label) {
  $("revealLabel").textContent = label;
  $("revealGrid").innerHTML = teams.map((c, i) => {
    const t = byCode[c];
    return `<div class="team-card" style="animation-delay:${i * 0.14}s">
      <div class="fl-big">${flag(t.code)}</div>
      <div class="name">${t.name}</div>
      <div class="meta">FIFA #${t.rank}</div>
      <div class="grp">Group ${t.group}</div>
    </div>`;
  }).join("");
  $("reveal").style.display = "block";
}

function hideReveal() {
  $("reveal").style.display = "none";
  $("revealGrid").innerHTML = "";
  $("revealLabel").textContent = "";
}

function applyPhaseUI(state) {
  const isSlots = state.phase === "slots";
  const allSlotsFilled = state.slots.length >= MAX_SLOTS;

  $("phaseKicker").textContent = isSlots
    ? "World Cup 2026 · Slot Draw"
    : "World Cup 2026 · Team Draw";

  $("tagline").innerHTML = isSlots
    ? "Pick your draw order &middot; <b>16</b> slots"
    : "48 teams in the hat &middot; <b>3</b> each &middot; follow the slot order";

  $("drawTitle").textContent = isSlots ? "Draw your slot" : "Draw your teams";
  $("drawHint").textContent = isSlots
    ? "Enter your name and draw a random slot (1–16). One slot per person."
    : "Enter the name on your slot, then pull 3 teams when it's your turn.";

  $("statSlots").classList.toggle("hidden", !isSlots);
  $("statTeams").classList.toggle("hidden", isSlots);
  $("slotList").classList.toggle("hidden", !isSlots);
  $("playerList").classList.toggle("hidden", isSlots);
  $("remainingSection").classList.toggle("hidden", isSlots);
  $("slotOrderCard").classList.toggle("hidden", isSlots);
  $("readyBanner").classList.toggle("hidden", !(isSlots && allSlotsFilled));

  if (isSlots) {
    renderSlotBoard(state);
  } else {
    renderSlotLadder(state, state.players);
    renderTeamBoard(state);
  }

  applyAdminUI();
}

function updateDrawButton(state) {
  const btn = $("drawBtn");
  const name = $("nameInput").value.trim();

  if (state.phase === "slots") {
    btn.textContent = "Draw a slot";
    const mine = state.slots.find((s) => keyFor(s.name) === keyFor(name || MY_NAME || ""));
    if (mine || (MY_NAME && state.slots.some((s) => keyFor(s.name) === keyFor(MY_NAME)))) {
      btn.disabled = true;
      btn.textContent = "Slot claimed ✓";
    } else {
      btn.disabled = state.slots.length >= MAX_SLOTS;
      btn.textContent = state.slots.length >= MAX_SLOTS ? "All slots taken" : "Draw a slot";
    }
    return;
  }

  btn.textContent = "Pull from the hat";
  const holder = findSlotHolder(state.slots, name || MY_NAME || "");
  if (!holder) {
    btn.disabled = !name;
    return;
  }

  const mine = state.players.find((p) => keyFor(p.name) === keyFor(holder.name));
  if (mine) {
    btn.disabled = true;
    btn.textContent = "Already drawn ✓";
  } else {
    const current = nextUndrawnSlot(state.slots, state.players);
    const isTurn = current === holder.slot;
    btn.disabled = !isTurn;
    btn.textContent = isTurn ? "Pull from the hat" : `Wait — Slot ${current} is up`;
  }
}

async function doSlotDraw() {
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
  btn.innerHTML = '<span class="spin"></span>Drawing…';

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const state = await loadState();
      if (state.phase !== "slots") {
        toast("Slot draw is closed — team draw has started.");
        await refresh();
        return;
      }

      if (state.slots.some((s) => keyFor(s.name) === keyFor(name))) {
        const mine = state.slots.find((s) => keyFor(s.name) === keyFor(name));
        MY_NAME = mine.name;
        localStorage.setItem("wc26:name", mine.name);
        showSlotReveal(mine.slot, mine.name);
        toast("You already have a slot!");
        await refresh();
        return;
      }

      const slotNum = pickRandomSlot(state.slots);
      if (!slotNum) {
        toast("All slots are taken!");
        btn.disabled = false;
        btn.textContent = "All slots taken";
        return;
      }

      const record = { slot: slotNum, name, ts: Date.now() };
      const next = { ...state, slots: [...state.slots, record] };
      await saveState(next);

      const verify = await loadState();
      const saved = verify.slots.find((s) => keyFor(s.name) === keyFor(name));
      if (saved && saved.slot === slotNum) {
        MY_NAME = name;
        localStorage.setItem("wc26:name", name);
        showSlotReveal(slotNum, name);
        confettiBurst();
        await refresh();
        return;
      }
    }

    toast("Draw collision — try again.");
    btn.disabled = false;
    btn.textContent = "Draw a slot";
  } catch (e) {
    console.error(e);
    toast("Something went wrong — try again.");
    btn.disabled = false;
    btn.textContent = "Draw a slot";
  }
}

async function doTeamDraw() {
  const name = $("nameInput").value.trim();
  if (!name) {
    toast("Enter your name first.");
    return;
  }

  const btn = $("drawBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Reaching in…';

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const state = await loadState();
      const holder = findSlotHolder(state.slots, name);
      if (!holder) {
        toast("That name isn't on the slot list.");
        btn.disabled = false;
        btn.textContent = "Pull from the hat";
        return;
      }

      const current = nextUndrawnSlot(state.slots, state.players);
      if (current !== holder.slot) {
        toast(`Not your turn yet — Slot ${current} draws next.`);
        btn.disabled = false;
        btn.textContent = `Wait — Slot ${current} is up`;
        return;
      }

      const mine = state.players.find((p) => keyFor(p.name) === keyFor(holder.name));
      if (mine) {
        MY_NAME = mine.name;
        localStorage.setItem("wc26:name", mine.name);
        showReveal(mine.teams, `${mine.name}, you already drew these:`);
        toast("You've already drawn — no take-backs!");
        await refresh();
        return;
      }

      const picked = pickTeams(state.players);
      if (!picked.length) {
        toast("The hat is empty!");
        btn.disabled = false;
        btn.textContent = "Pull from the hat";
        return;
      }

      const record = { name: holder.name, teams: picked, ts: Date.now() };
      const next = { ...state, players: [...state.players, record] };
      await saveState(next);

      const verify = await loadState();
      const saved = verify.players.find((p) => keyFor(p.name) === keyFor(holder.name));
      if (saved && saved.teams.join() === picked.join()) {
        MY_NAME = holder.name;
        localStorage.setItem("wc26:name", holder.name);
        showReveal(picked, `${holder.name}, the hat gave you:`);
        confettiBurst();
        await refresh();
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

async function doDraw() {
  const state = await loadState();
  if (state.phase === "slots") await doSlotDraw();
  else await doTeamDraw();
}

async function openHat() {
  if (!isAdmin()) {
    toast("Admin only.");
    return;
  }

  const state = await loadState();
  if (state.slots.length < MAX_SLOTS) {
    toast("All 16 slots must be filled first.");
    return;
  }

  if (!confirm("Open the hat and start the team draw for everyone?")) return;

  try {
    await saveState({ ...state, phase: "teams" });
    hideReveal();
    toast("Team draw is live!");
    await refresh();
  } catch (e) {
    console.error(e);
    toast("Couldn't start team draw.");
  }
}

async function resetAll() {
  if (!isAdmin()) {
    toast("Admin only.");
    return;
  }
  if (!confirm("Wipe ALL slots and team draws for everyone? This can't be undone.")) return;

  try {
    await saveState(defaultState());
    MY_NAME = null;
    localStorage.removeItem("wc26:name");
    hideReveal();
    $("nameInput").value = "";
    await refresh();
    toast("Reset done. Fresh draw.");
  } catch (e) {
    console.error(e);
    toast("Reset failed — try again.");
  }
}

async function refresh() {
  try {
    const state = await loadState();
    applyPhaseUI(state);

    if (MY_NAME) $("nameInput").value = MY_NAME;

    if (state.phase === "slots") {
      const mine = state.slots.find((s) => keyFor(s.name) === keyFor(MY_NAME || ""));
      if (mine) showSlotReveal(mine.slot, mine.name);
    } else {
      const mine = state.players.find((p) => keyFor(p.name) === keyFor(MY_NAME || ""));
      if (mine) showReveal(mine.teams, `${mine.name}, you already drew these:`);
    }

    updateDrawButton(state);
  } catch (e) {
    console.error(e);
    toast("Couldn't refresh the board.");
  }
}

async function ensureBin() {
  const { binId: existing } = parseHash();

  if (useLocalOnly) {
    binId = existing || newLocalBinId();
    setHashBinId(binId);
    const local = readLocalState();
    if (!local.slots && !local.players) writeLocalState(defaultState());
    setupBroadcast();
    return;
  }

  if (existing) {
    binId = existing;
    setupBroadcast();
    try {
      await loadState();
      return;
    } catch (e) {
      console.warn("Shared bin not found, creating a new hat.", e);
    }
  }

  $("tagline").textContent = "Creating a new draw…";
  try {
    binId = await createRemoteBin();
    setHashBinId(binId);
    setupBroadcast();
  } catch (e) {
    console.warn("JSONBin unavailable, using local storage.", e);
    useLocalOnly = true;
    binId = existing || newLocalBinId();
    setHashBinId(binId);
    writeLocalState(defaultState());
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
  checkAdminFromHash();
  applyAdminUI();

  if (MY_NAME) $("nameInput").value = MY_NAME;

  try {
    await ensureBin();
    await refresh();
    setInterval(refresh, 6000);
  } catch (e) {
    console.error(e);
    $("tagline").textContent = "Couldn't connect — refresh to retry.";
    toast("Couldn't connect — check your connection and refresh.");
  }
}

$("drawBtn").addEventListener("click", doDraw);
$("refreshBtn").addEventListener("click", () => { refresh(); toast("Board refreshed."); });
$("resetBtn").addEventListener("click", resetAll);
$("openHatBtn").addEventListener("click", openHat);
$("nameInput").addEventListener("input", async () => {
  try {
    updateDrawButton(await loadState());
  } catch { /* ignore */ }
});
$("nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doDraw(); });

window.addEventListener("hashchange", async () => {
  checkAdminFromHash();
  applyAdminUI();
  const { binId: id } = parseHash();
  if (id && id !== binId) {
    binId = id;
    setupBroadcast();
  }
  await refresh();
});

boot();
