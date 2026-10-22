import { EAST, WEST, authUser, getEntry, isAdmin, json, newId, store } from "../lib/common.mjs";

/* The Agora: an open discussion board. Anyone can read, signed-in players can post and react. */
const TAGS = new Set(["NBA", ...EAST, ...WEST]);
const MAX_LEN = 500;
const COOLDOWN_MS = 20000;
const PAGE = 150;
const BASE = 9e15; // newest posts sort first: keys use (BASE minus time)

const keyFor = (at, id) => `agora/${String(BASE - at).padStart(16, "0")}-${id}`;

function view(p, meId) {
  const counts = { bucket: 0, brick: 0 };
  for (const r of Object.values(p.reacts || {})) if (counts[r] !== undefined) counts[r]++;
  return { id: p.id, uid: p.uid, name: p.name, tag: p.tag, text: p.text, at: p.at, counts, mine: (p.reacts || {})[meId] || null };
}

async function findKey(s, id) {
  const { blobs } = await s.list({ prefix: "agora/" });
  const b = blobs.find((x) => x.key.endsWith("-" + id));
  return b ? b.key : null;
}

export default async (req) => {
  const s = store();
  const user = await authUser(req);

  if (req.method === "GET") {
    const { blobs } = await s.list({ prefix: "agora/" });
    const keys = blobs.map((b) => b.key).sort().slice(0, PAGE);
    const posts = (await Promise.all(keys.map((k) => s.get(k, { type: "json" })))).filter(Boolean);
    return json({ posts: posts.map((p) => view(p, user?.id)), canPost: !!user, isAdmin: isAdmin(user) });
  }
  if (req.method !== "POST") return json({ error: "Use GET or POST" }, 405);
  if (!user) return json({ error: "Sign in to join the Agora" }, 401);
  const b = await req.json().catch(() => ({}));

  if (!b.op || b.op === "post") {
    const text = String(b.text || "").replace(/\s+\n/g, "\n").trim().slice(0, MAX_LEN);
    if (!text) return json({ error: "Write something first" }, 400);
    const tag = TAGS.has(b.tag) ? b.tag : "NBA";
    const rlKey = "agora-rl/" + user.id;
    const last = Number((await s.get(rlKey)) || 0);
    if (Date.now() - last < COOLDOWN_MS) return json({ error: "Slow down a little. Try again in a few seconds." }, 429);
    const entry = await getEntry(user.id);
    const name = (entry && entry.name) || user.email.split("@")[0];
    const at = Date.now();
    const p = { id: newId(), uid: user.id, name: String(name).slice(0, 24), tag, text, at, reacts: {} };
    await Promise.all([s.setJSON(keyFor(at, p.id), p), s.set(rlKey, String(at))]);
    return json({ ok: true, post: view(p, user.id) });
  }

  const key = await findKey(s, String(b.id || ""));
  if (!key) return json({ error: "Post not found" }, 404);
  const p = await s.get(key, { type: "json" });
  if (!p) return json({ error: "Post not found" }, 404);

  if (b.op === "react") {
    p.reacts = p.reacts || {};
    if (b.r !== "bucket" && b.r !== "brick") return json({ error: "Bad reaction" }, 400);
    if (p.reacts[user.id] === b.r) delete p.reacts[user.id];
    else p.reacts[user.id] = b.r;
    await s.setJSON(key, p);
    return json({ ok: true, post: view(p, user.id) });
  }
  if (b.op === "delete") {
    if (p.uid !== user.id && !isAdmin(user)) return json({ error: "Only the author or the commissioner can remove this" }, 403);
    await s.delete(key);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/agora" };
