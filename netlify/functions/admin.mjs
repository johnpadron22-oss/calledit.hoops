import { authUser, getDoc, getLeague, isAdmin, json, newId, setDoc } from "../lib/common.mjs";

const Q_FIELDS = ["title", "group", "kind", "points", "lockAt", "answers", "resolved", "options", "pool", "hint", "conf", "order"];
const P_FIELDS = ["text", "source", "lockAt", "result", "order"];
const pick = (obj, fields) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => fields.includes(k)));

/* Commissioner tools. Only emails listed in the ADMIN_EMAILS environment variable get in. */
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  const user = await authUser(req);
  if (!user) return json({ error: "Sign in first" }, 401);
  if (!isAdmin(user)) return json({ error: "Commissioner only" }, 403);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  switch (b.op) {
    case "settings": {
      const s = b.settings || {};
      await setDoc("settings", {
        season: String(s.season || "NBA Season").slice(0, 60),
        lockAt: s.lockAt || (await getDoc("settings")).lockAt,
        boldLimit: Math.max(0, Number(s.boldLimit) || 0),
        boldPoints: Math.max(0, Number(s.boldPoints) || 0),
        propPoints: Math.max(0, Number(s.propPoints) || 0),
      });
      break;
    }
    case "upsertQuestion": case "patchQuestion": case "deleteQuestion": {
      const qs = await getDoc("questions");
      if (b.op === "upsertQuestion") qs.push({ id: newId(), answers: [], resolved: false, ...pick(b.q, Q_FIELDS) });
      else {
        const i = qs.findIndex((q) => q.id === b.id);
        if (i < 0) return json({ error: "Question not found" }, 404);
        if (b.op === "patchQuestion") qs[i] = { ...qs[i], ...pick(b.patch, Q_FIELDS) };
        else qs.splice(i, 1);
      }
      await setDoc("questions", qs);
      break;
    }
    case "upsertProp": case "patchProp": case "deleteProp": {
      const ps = await getDoc("props");
      if (b.op === "upsertProp") ps.push({ id: newId(), result: "", ...pick(b.p, P_FIELDS) });
      else {
        const i = ps.findIndex((p) => p.id === b.id);
        if (i < 0) return json({ error: "League call not found" }, 404);
        if (b.op === "patchProp") ps[i] = { ...ps[i], ...pick(b.patch, P_FIELDS) };
        else ps.splice(i, 1);
      }
      await setDoc("props", ps);
      break;
    }
    case "results": {
      const r = b.results || {};
      await setDoc("results", { east: Array.isArray(r.east) ? r.east.slice(0, 15) : [], west: Array.isArray(r.west) ? r.west.slice(0, 15) : [], final: !!r.final });
      break;
    }
    case "grades": {
      const g = {};
      for (const [k, v] of Object.entries(b.grades || {})) if (v === "hit" || v === "miss") g[k] = v;
      await setDoc("grades", g);
      break;
    }
    default:
      return json({ error: "Unknown action" }, 400);
  }
  return json({ ok: true, league: await getLeague() });
};

export const config = { path: "/api/admin" };
