import express from "express";

const app = express();
app.use(express.json());

const BASE = "https://teurgia.org";
const ALLOW_PREFIX = "/okkultizm/zapadnaya-magicheskaya-traditsiya/iudejskaya-kabbala";

const isAllowedUrl = (u) => {
  try {
    const x = new URL(u);
    return (x.hostname === "teurgia.org" || x.hostname === "www.teurgia.org") &&
           x.pathname.startsWith(ALLOW_PREFIX);
  } catch { return false; }
};

// CORS для OpenAI Actions
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, OpenAI-Beta");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// POST /query  { query: string, limit?: number }
app.post("/query", async (req, res) => {
  const q = String(req.body?.query || "").trim();
  const limit = Math.max(1, Math.min(50, Number(req.body?.limit ?? 10)));
  if (!q) return res.status(400).json({ error: "bad_request", detail: "field 'query' is required" });

  try {
    const r = await fetch(BASE + ALLOW_PREFIX, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru,en;q=0.9"
      }
    });
    if (!r.ok) return res.status(502).json({ error: "upstream_error", detail: `GET ${ALLOW_PREFIX} → ${r.status}` });
    const html = await r.text();

    // простой парсер ссылок
    const linkRe = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const results = []; const seen = new Set();
    while (true) {
      const m = linkRe.exec(html); if (!m) break;
      let href = m[1]; let text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (!href || !text) continue;
      if (href.startsWith("/")) href = BASE + href;
      if (!isAllowedUrl(href)) continue;
      if (!(text + " " + href).toLowerCase().includes(q.toLowerCase())) continue;
      if (!seen.has(href)) { seen.add(href); results.push({ title: text, url: href }); if (results.length >= limit) break; }
    }

    if (results.length === 0) results.push({ title: "Иудейская Каббала — раздел", url: BASE + ALLOW_PREFIX });
    res.json({ result: results });
  } catch (e) {
    res.status(502).json({ error: "upstream_error", detail: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Running on ${port}`));

