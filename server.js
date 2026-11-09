// Wear and Tear – tiny server (Node 16+, no dependencies).
// Serves this folder AND stores the burn-in of every visitor forever in visits.json.
//
//   node server.js            -> http://localhost:3000
//   PORT=8080 node server.js
//
// API used by burn.js:
//   GET /api/visits        -> [{id, first, t, clicks, hover, pos}, ...]
//   PUT /api/visits/:id    -> stores one visitor's traces (each visitor only writes their own doc)
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const DB = path.join(ROOT, "visits.json");
const MAX_BODY = 300 * 1024; // per visitor
const MAX_VISITORS = 100000;

let visits = {};
try {
  visits = JSON.parse(fs.readFileSync(DB, "utf8"));
} catch (e) {}

let timer = null;
function persist() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    fs.writeFile(DB + ".tmp", JSON.stringify(visits), (err) => {
      if (!err) fs.rename(DB + ".tmp", DB, () => {});
    });
  }, 1000);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const PRIVATE = new Set(["server.js", "visits.json", "visits.json.tmp"]);

function isObj(o) {
  return o && typeof o === "object" && !Array.isArray(o);
}
function numMap(o) {
  const out = {};
  for (const k of Object.keys(o).slice(0, 20000)) {
    const v = o[k];
    if (typeof v === "number" && isFinite(v) && k.length < 200) out[k] = v;
  }
  return out;
}

function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  // ---- API ----
  if (p === "/api/visits" && req.method === "GET") {
    const list = Object.keys(visits).map((id) => Object.assign({ id }, visits[id]));
    return send(res, 200, JSON.stringify(list), "application/json");
  }
  const m = p.match(/^\/api\/visits\/([a-z0-9]{4,40})$/);
  if (m && req.method === "PUT") {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        send(res, 413, "too large");
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      if (res.writableEnded) return;
      try {
        const b = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!isObj(b) || !isObj(b.clicks) || !isObj(b.hover) || !isObj(b.pos))
          return send(res, 400, "bad doc");
        const id = m[1];
        if (!visits[id] && Object.keys(visits).length >= MAX_VISITORS)
          return send(res, 507, "full");
        const prev = visits[id];
        const pos = {};
        for (const k of Object.keys(b.pos).slice(0, 2000)) {
          const v = b.pos[k];
          if (Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number"))
            pos[k] = v;
        }
        visits[id] = {
          first: prev ? prev.first : Number(b.first) || Date.now(), // never changes
          t: Date.now(),
          clicks: numMap(b.clicks),
          hover: numMap(b.hover),
          pos,
        };
        persist();
        res.writeHead(204);
        res.end();
      } catch (e) {
        send(res, 400, "bad json");
      }
    });
    return;
  }
  if (p.startsWith("/api/")) return send(res, 404, "not found");

  // ---- static files ----
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method");
  let rel;
  try {
    rel = decodeURIComponent(p);
  } catch (e) {
    return send(res, 400, "bad path");
  }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  const name = path.basename(file);
  if (
    !file.startsWith(ROOT + path.sep) ||
    PRIVATE.has(name) ||
    name.startsWith(".")
  )
    return send(res, 404, "not found");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "not found");
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": /\.(html|js|css)$/.test(file) ? "no-cache" : "public, max-age=300",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

server.listen(PORT, () => console.log("Wear and Tear running on http://localhost:" + PORT));
