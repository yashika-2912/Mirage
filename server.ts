import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const db = new Database("mirage.db");

  // Initialize Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      file_hash TEXT,
      audience TEXT,
      risk_score_before REAL,
      risk_score_after REAL,
      items_redacted INTEGER,
      items_detected INTEGER
    )
  `);

  app.use(express.json());

  // API Routes
  app.get("/api/ledger", (req, res) => {
    const entries = db.prepare("SELECT * FROM ledger ORDER BY timestamp DESC LIMIT 50").all();
    res.json(entries);
  });

  app.post("/api/ledger", (req, res) => {
    const { id, timestamp, file_hash, audience, risk_score_before, risk_score_after, items_redacted, items_detected } = req.body;
    const insert = db.prepare(`
      INSERT INTO ledger (id, timestamp, file_hash, audience, risk_score_before, risk_score_after, items_redacted, items_detected)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(id, timestamp, file_hash, audience, risk_score_before, risk_score_after, items_redacted, items_detected);
    res.status(201).json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
