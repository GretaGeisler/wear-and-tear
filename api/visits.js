// /api/visits – shared storage for Wear and Tear.
// Vercel Function + Upstash Redis (no npm packages needed).
//
//   GET  /api/visits?since=<ms>            changed visitor docs since <ms>   -> { now, docs: [...] }
//   GET  /api/visits?shots=1&since=<ms>    changed graph pictures since <ms> -> { now, shots: {id: {srv, shot}} }
//   GET  /api/visits?stats=1&id=<id>       counters                          -> { visitors, online, rank, now }
//   PUT  /api/visits?id=<id>               save the doc of ONE visitor (body = JSON)
//   POST /api/visits?id=<id>&ping=1        heartbeat ("still online")
//
// Environment variables (set automatically when you connect Upstash Redis to the Vercel project):
//   KV_REST_API_URL + KV_REST_API_TOKEN   (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)

const BASE = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").replace(/\/$/, "");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

const ONLINE_MS = 30000; // somebody counts as online for 30 s after the last sign of life

// run several Redis commands in one request
async function redis(commands) {
  const r = await fetch(BASE + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  const out = await r.json();
  return out.map(function (o) {
    if (o.error) throw new Error(o.error);
    return o.result;
  });
}

// HGETALL answers [field, value, field, value, ...]
function toObj(flat) {
  const o = {};
  for (let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = flat[i + 1];
  return o;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch (e) {
      b = null;
    }
  }
  return b && typeof b === "object" ? b : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!BASE || !TOKEN) return res.status(503).json({ error: "Redis is not connected to this project" });

  const q = req.query || {};
  const id = String(q.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  const since = Number(q.since) || 0;
  const now = Date.now();

  try {
    // ---------- reading ----------
    if (req.method === "GET") {
      // counters: visitors, online, my number
      if (q.stats) {
        const [firstFlat, online] = await redis([
          ["HGETALL", "wt:first"],
          ["ZCOUNT", "wt:online", String(now - ONLINE_MS), "+inf"],
        ]);
        const first = toObj(firstFlat);
        const ids = Object.keys(first);
        let rank = 0;
        if (id && first[id] !== undefined) {
          const mine = Number(first[id]);
          rank =
            1 +
            ids.filter(function (k) {
              const f = Number(first[k]);
              return k !== id && (f < mine || (f === mine && k < id));
            }).length;
        }
        return res.status(200).json({ visitors: ids.length, online: Number(online) || 0, rank: rank, now: now });
      }

      // graph pictures (rarely change, fetched separately)
      if (q.shots) {
        const ssrv = toObj((await redis([["HGETALL", "wt:ssrv"]]))[0]);
        const ids = Object.keys(ssrv).filter(function (k) {
          return Number(ssrv[k]) > since;
        });
        if (!ids.length) return res.status(200).json({ now: now, shots: {} });
        const vals = (await redis([["HMGET", "wt:shots"].concat(ids)]))[0] || [];
        const shots = {};
        vals.forEach(function (v, i) {
          if (!v) return;
          try {
            shots[ids[i]] = { srv: Number(ssrv[ids[i]]), shot: JSON.parse(v) };
          } catch (e) {}
        });
        return res.status(200).json({ now: now, shots: shots });
      }

      // visitor docs that changed since <since>
      const srv = toObj((await redis([["HGETALL", "wt:srv"]]))[0]);
      const ids = Object.keys(srv).filter(function (k) {
        return Number(srv[k]) > since;
      });
      if (!ids.length) return res.status(200).json({ now: now, docs: [] });
      const vals = (await redis([["HMGET", "wt:visits"].concat(ids)]))[0] || [];
      const docs = [];
      vals.forEach(function (v, i) {
        if (!v) return;
        try {
          const d = JSON.parse(v);
          d.id = ids[i];
          d.srv = Number(srv[ids[i]]);
          docs.push(d);
        } catch (e) {}
      });
      return res.status(200).json({ now: now, docs: docs });
    }

    // ---------- save one visitor ----------
    if (req.method === "PUT") {
      if (!id) return res.status(400).json({ error: "id missing" });
      const body = readBody(req);
      if (!body || typeof body.clicks !== "object" || typeof body.hover !== "object" || typeof body.pos !== "object")
        return res.status(400).json({ error: "bad doc" });

      const doc = {
        first: Number(body.first) || now,
        t: now, // server time, so the clocks of different devices never matter
        clicks: body.clicks,
        hover: body.hover,
        pos: body.pos,
        snap: body.snap && typeof body.snap === "object" ? body.snap : {},
      };
      const json = JSON.stringify(doc);
      if (json.length > 400000) return res.status(413).json({ error: "doc too large" });

      const cmds = [
        ["HSET", "wt:visits", id, json],
        ["HSET", "wt:srv", id, String(now)],
        ["HSETNX", "wt:first", id, String(doc.first)],
        ["ZADD", "wt:online", String(now), id],
      ];
      if (body.shot && typeof body.shot === "object") {
        const sj = JSON.stringify(body.shot);
        if (sj.length <= 600000) cmds.push(["HSET", "wt:shots", id, sj], ["HSET", "wt:ssrv", id, String(now)]);
      }
      await redis(cmds);
      return res.status(200).json({ ok: true, now: now });
    }

    // ---------- heartbeat ----------
    if (req.method === "POST") {
      if (!id) return res.status(400).json({ error: "id missing" });
      await redis([
        ["ZADD", "wt:online", String(now), id],
        ["ZREMRANGEBYSCORE", "wt:online", "-inf", String(now - 3600000)],
      ]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT, POST");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};