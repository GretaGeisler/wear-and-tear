
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return res.status(500).send("Missing Supabase configuration");
  }

  // Alle Besucherspuren abrufen
  if (req.method === "GET") {
    try {
      const all = [];
      let offset = 0;
      const limit = 1000;

      while (true) {
        const response = await fetch(
          `${url}/rest/v1/visitor_traces?select=visitor_id,first,t,clicks,hover,pos&order=first.asc`,
          {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              Range: `${offset}-${offset + limit - 1}`,
            },
          }
        );

        if (!response.ok) throw new Error(await response.text());

        const rows = await response.json();
        all.push(...rows);

        if (rows.length < limit) break;
        offset += limit;
      }

      return res.status(200).json(
        all.map((row) => ({
          id: row.visitor_id,
          first: Date.parse(row.first),
          t: Date.parse(row.t),
          clicks: row.clicks || {},
          hover: row.hover || {},
          pos: row.pos || {},
        }))
      );
} catch (error) {
  console.error(error);
  return res.status(500).send(String(error.message || error));
}
  }

  // Besucherspur speichern
  if (req.method === "PUT") {
    try {
      const id = req.query.id;

      if (
        typeof id !== "string" ||
        !/^[a-z0-9]{4,40}$/.test(id)
      ) {
        return res.status(400).send("Invalid visitor ID");
      }

      const body = req.body;

      if (
        !body ||
        typeof body !== "object" ||
        !body.clicks ||
        !body.hover ||
        !body.pos ||
        typeof body.clicks !== "object" ||
        typeof body.hover !== "object" ||
        typeof body.pos !== "object"
      ) {
        return res.status(400).send("Invalid data");
      }

      if (JSON.stringify(body).length > 300 * 1024) {
        return res.status(413).send("Data too large");
      }

      function cleanMap(input) {
        const output = {};
        for (const [k, v] of Object.entries(input).slice(0, 20000)) {
          if (
            k.length < 200 &&
            typeof v === "number" &&
            Number.isFinite(v)
          ) {
            output[k] = v;
          }
        }
        return output;
      }

      const pos = {};
      for (const [k, v] of Object.entries(body.pos).slice(0, 2000)) {
        if (
          k.length < 200 &&
          Array.isArray(v) &&
          v.length === 4 &&
          v.every((n) => typeof n === "number" && Number.isFinite(n))
        ) {
          pos[k] = v;
        }
      }

      const first = Number(body.first);
      const t = Number(body.t) || Date.now();

      const row = {
        visitor_id: id,
        first: new Date(
          Number.isFinite(first) && first > 0 ? first : t
        ).toISOString(),
        t: new Date(t).toISOString(),
        clicks: cleanMap(body.clicks),
        hover: cleanMap(body.hover),
        pos,
      };

      const response = await fetch(
        `${url}/rest/v1/visitor_traces?on_conflict=visitor_id`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(row),
        }
      );

      if (!response.ok) throw new Error(await response.text());

      return res.status(204).end();
    } catch (error) {
      console.error(error);
      return res.status(500).send("Database error");
    }
  }

  return res.status(405).send("Method not allowed");
}
