import { authUser, getEntries, getLeague, isAdmin, isLocked, json } from "../lib/common.mjs";

/* Everyone's picks stay hidden until each question locks, so nobody can copy. */
function publicView(entries, league, meId) {
  const now = Date.now();
  const standLocked = isLocked(league.settings.lockAt, now);
  const qOpen = new Set(league.questions.filter((q) => !isLocked(q.lockAt, now) && !q.resolved).map((q) => q.id));
  const qIds = new Set(league.questions.map((q) => q.id));
  const pOpen = new Set(league.props.filter((p) => !isLocked(p.lockAt, now) && !p.result).map((p) => p.id));
  const propCounts = {};
  for (const p of league.props) propCounts[p.id] = { real: 0, cap: 0 };
  const out = {};
  const viewerSealed = !!(meId && entries[meId] && entries[meId].sealedAt);
  for (const [id, e] of Object.entries(entries)) {
    const mine = id === meId || (viewerSealed && !!e.sealedAt);
    const picks = {};
    for (const [k, v] of Object.entries(e.picks || {})) {
      if (k === "east" || k === "west") picks[k] = standLocked || mine ? v : (Array.isArray(v) ? v.map(() => "?") : []);
      else if (qIds.has(k)) picks[k] = qOpen.has(k) && !mine ? true : v;
    }
    const votes = {};
    for (const [k, v] of Object.entries(e.votes || {})) {
      if (propCounts[k] && (v === "real" || v === "cap")) propCounts[k][v]++;
      if (!pOpen.has(k) || id === meId) votes[k] = v;
    }
    out[id] = { name: e.name || "", sealed: !!e.sealedAt, picks, bold: e.bold || [], reacts: e.reacts || {}, votes };
  }
  return { entries: out, propCounts };
}

export default async (req) => {
  const [user, league, entries] = await Promise.all([authUser(req), getLeague(), getEntries()]);
  const { entries: pub, propCounts } = publicView(entries, league, user?.id);
  const me = user ? { id: user.id, email: user.email, isAdmin: isAdmin(user), entry: entries[user.id] || null } : null;
  return json({ league, entries: pub, propCounts, me, now: Date.now() });
};

export const config = { path: "/api/state" };
