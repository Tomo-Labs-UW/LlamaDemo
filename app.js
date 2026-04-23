/**
 * FILE FOR SERVER MANAGEMENT
 */

/** import packages */
import express from "express";
import cors from "cors";

const app = express();
app.set("etag", false);

/** main path handling */
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
  })
);

/** handle static file requests (html, css) */
app.use(express.json({ limit: "10mb" }));

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/** Import api routers */
import apiRouter from "./api/api.js";

/** Handle /api route */
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

/**
 * APP ROUTERS
 */

app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiRouter);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Express API running on http://localhost:${PORT}`);
  console.log(`POST http://localhost:${PORT}/api/simplify`);
});