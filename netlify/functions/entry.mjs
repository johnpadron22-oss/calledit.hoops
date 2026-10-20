import { EAST, WEST, authUser, getEntry, getLeague, isLocked, json, setEntry } from "../lib/common.mjs";

const BOLD_EDIT_MS = 15 * 60 * 1000;
const str = (v, max) => String(v ?? "").trim().slice(0, max);

function cleanRank(arr, conf) {
  if (!Array.isArray(arr)) return [];
  const allowed = new Set(conf);
  const out = [];
  for (const t of arr) if (allowed.has(t) && !out.includes(t) && out.length < 15) out.push(t);
  return out;
}

/* Saves one person's picks. Anything already locked keeps its saved value, whatever the browser sends. */
export default async (req) => {
  if (req.method !== "PUT") return json({ error: "Use PUT" }, 405);
  const user = await authUser(req);
  if (!user) return json({ error: "Sign in to save picks" }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const [league, prev0] = await Promise.all([getLeague(), getEntry(user.id)]);
  const prev = prev0 || { name: "", picks: {}, bold: [], reacts: {}, votes: {} };
  const now = Date.now();
  const st = league.settings;
  const next = { name: str(body.name, 24) || prev.name || "", picks: {}, bold: [], reacts: {}, votes: {}, updatedAt: new Date(now).toISOString() };

  const standLocked = isLocked(st.lockAt, now);
  for (const [k, conf] of [["east", EAST], ["west", WEST]]) {
    next.picks[k] = standLocked ? (prev.picks?.[k] || []) : cleanRank(body.picks?.[k], conf);
  }
  for (const q of league.questions) {
    const locked = isLocked(q.lockAt, now) || q.resolved;
    const v = locked ? prev.picks?.[q.id] : body.picks?.[q.id];
    if (v === undefined || v === null || v === "") continue;
    if (q.kind === "number") { const n = Number(v); if (Number.isFinite(n)) next.picks[q.id] = n; }
    else next.picks[q.id] = str(v, 60);
  }

  const limit = Number(st.boldLimit) || 0;
  const incoming = Array.isArray(body.bold) ? body.bold : [];
  const inIds = new Set(incoming.map((b) => b && b.id));
  for (const b of prev.bold || []) {
    const removable = now - Date.parse(b.at) < BOLD_EDIT_MS && !league.grades[user.id + ":" + b.id];
    if (inIds.has(b.id) || !removable) next.bold.push(b);
  }
  for (const b of incoming) {
    if (!b || next.bold.some((x) => x.id === b.id) || next.bold.length >= limit) continue;
    const text = str(b.text, 140);
    if (text) next.bold.push({ id: str(b.id, 16) || Math.random().toString(36).slice(2, 10), text, at: new Date(now).toISOString() });
  }

  const reacts = body.reacts && typeof body.reacts === "object" ? body.reacts : {};
  for (const [k, v] of Object.entries(reacts).slice(0, 300)) if (v === "real" || v === "cap") next.reacts[str(k, 80)] = v;

  for (const p of league.props) {
    const locked = isLocked(p.lockAt, now) || !!p.result;
    const v = locked ? prev.votes?.[p.id] : body.votes?.[p.id];
    if (v === "real" || v === "cap") next.votes[p.id] = v;
  }

  await setEntry(user.id, next);
  return json({ entry: next });
};

export const config = { path: "/api/entry" };
