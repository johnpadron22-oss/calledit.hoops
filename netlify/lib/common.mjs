import { getStore } from "@netlify/blobs";
import seed from "./seed.json";

const DOCS = ["settings", "questions", "props", "results", "grades"];

export const EAST = ["ATL","BOS","BKN","CHA","CHI","CLE","DET","IND","MIA","MIL","NYK","ORL","PHI","TOR","WAS"];
export const WEST = ["DAL","DEN","GSW","HOU","LAC","LAL","MEM","MIN","NOP","OKC","PHX","POR","SAC","SAS","UTA"];

export const store = () => getStore({ name: "called-it", consistency: "strong" });

export async function getDoc(name) {
  const v = await store().get("league/" + name, { type: "json" });
  return v ?? structuredClone(seed[name]);
}
export async function setDoc(name, value) {
  await store().setJSON("league/" + name, value);
}
export async function getLeague() {
  const out = {};
  await Promise.all(DOCS.map(async (d) => { out[d] = await getDoc(d); }));
  out.questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  out.props.sort((a, b) => (a.order || 0) - (b.order || 0));
  return out;
}

export async function getEntry(id) {
  return (await store().get("entries/" + id, { type: "json" })) || null;
}
export async function setEntry(id, entry) {
  await store().setJSON("entries/" + id, entry);
}
export async function getEntries() {
  const s = store();
  const { blobs } = await s.list({ prefix: "entries/" });
  const out = {};
  await Promise.all(blobs.map(async (b) => {
    const v = await s.get(b.key, { type: "json" });
    if (v) out[b.key.slice("entries/".length)] = v;
  }));
  return out;
}

/* Checks the Netlify Identity token by asking Identity who it belongs to. */
export async function authUser(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  try {
    const r = await fetch(new URL("/.netlify/identity/user", req.url), { headers: { authorization: h } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: String(u.email || "").toLowerCase() } : null;
  } catch {
    return null;
  }
}

export function isAdmin(user) {
  const list = String(process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return !!user && list.includes(user.email);
}

export const isLocked = (iso, now = Date.now()) => !!iso && now >= Date.parse(iso);

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
