// /api/visits – shared storage for Wear and Tear.
// Vercel Function + Supabase (Postgres via the REST API, no npm packages needed).
//
//   GET  /api/visits?since=<ms>            changed visitor docs since <ms>   -> { now, docs: [...] }
//   GET  /api/visits?shots=1&since=<ms>    changed graph pictures since <ms> -> { now, shots: {id: {srv, shot}} }
//   GET  /api/visits?stats=1&id=<id>       counters                          -> { visitors, online, rank, now }
//   PUT  /api/visits?id=<id>               save the doc of ONE visitor (body = JSON)
//   POST /api/visits?id=<id>&ping=1        heartbeat ("still online")
//
// Needs the table from supabase-setup.sql and these environment variables
// (the Vercel x Supabase integration sets them): SUPABASE_URL and SUPABASE_SECRET_KEY.

function env(names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  return "";
}
const BASE = env(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]).replace(/\/$/, "");
const KEY = env(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

const TABLE = "wt_visits";
const ONLINE_MS = 30000; // somebody counts as online for 30 s after the last sign of life

// call the Supabase REST API. New secret keys (sb_secret_...) go ONLY into the apikey header;
// the old service_role keys are JWTs and also want the Authorization header.
async function db(method, path, body, prefer) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  if (KEY.indexOf("eyJ") === 0) headers.Authorization = "Bearer " + KEY;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(BASE + "/rest/v1/" + path, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("supabase " + r.status + (text ? ": " + text.slice(0, 240) : ""));
  return text ? JSON.parse(text) : null;
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
  if (!BASE || !KEY)
    return res.status(503).json({
      error: "Supabase is not connected to this project (or the project was not redeployed after connecting it)",
      variables_found: Object.keys(process.env).filter(function (k) {
        return /SUPABASE/.test(k); // names only, never the values
      }),
    });

  const q = req.query || {};
  const id = String(q.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  const since = Number(q.since) || 0;
  const now = Date.now();

  try {
    // ---------- reading ----------
    if (req.method === "GET") {
      // counters: visitors, online, my number
      if (q.stats) {
        const results = await Promise.all([
          db("GET", TABLE + "?select=id,first"),
          db("GET", TABLE + "?select=id&seen=gt." + (now - ONLINE_MS)),
        ]);
        const all = results[0] || [];
        let rank = 0;
        const me = all.find(function (r) {
          return r.id === id;
        });
        if (me) {
          rank =
            1 +
            all.filter(function (r) {
              return r.id !== id && (r.first < me.first || (r.first === me.first && r.id < id));
            }).length;
        }
        return res.status(200).json({ visitors: all.length, online: (results[1] || []).length, rank: rank, now: now });
      }

      // graph pictures (rarely change, fetched separately)
      if (q.shots) {
        const rows = await db("GET", TABLE + "?select=id,ssrv,shot&shot=not.is.null&ssrv=gt." + since);
        const shots = {};
        (rows || []).forEach(function (r) {
          shots[r.id] = { srv: r.ssrv, shot: r.shot };
        });
        return res.status(200).json({ now: now, shots: shots });
      }

      // visitor docs that changed since <since>
      const rows = await db("GET", TABLE + "?select=id,srv,doc&order=srv.asc&srv=gt." + since);
      const docs = (rows || []).map(function (r) {
        return Object.assign({}, r.doc, { id: r.id, srv: r.srv });
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
      if (JSON.stringify(doc).length > 400000) return res.status(413).json({ error: "doc too large" });

      // only the columns we send are changed (the graph pictures stay as they are if none are sent)
      const row = { id: id, first: doc.first, srv: now, seen: now, doc: doc };
      if (body.shot && typeof body.shot === "object" && JSON.stringify(body.shot).length <= 600000) {
        row.shot = body.shot;
        row.ssrv = now;
      }
      await db("POST", TABLE + "?on_conflict=id", row, "resolution=merge-duplicates,return=minimal");
      return res.status(200).json({ ok: true, now: now });
    }

    // ---------- heartbeat ----------
    if (req.method === "POST") {
      if (!id) return res.status(400).json({ error: "id missing" });
      await db("PATCH", TABLE + "?id=eq." + id, { seen: now }, "return=minimal");
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT, POST");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};