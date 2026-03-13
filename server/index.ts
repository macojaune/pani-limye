import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { Hono } from "hono";
import { powerStatuses, waterStatuses } from "./db/schema";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./db";
import { desc, getTableColumns, gte, sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const indexHtmlPath = path.join(distDir, "index.html");

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const obfuscateCoordinate = (coord: number, factor = 0.001) => {
  return coord + (Math.random() - 0.667) * factor;
};

const app = new Hono();
app.use(logger());

app.use(
  "/api/*",
  cors({
    origin: [
      "http://localhost:5173",
      "https://pani-limie.netlify.app",
      "https://www.pani-limie.netlify.app",
      "https://pani-limye.marvinl.com",
      "https://www.pani-limye.marvinl.com",
      "https://pani-limie.marvinl.com",
      "https://www.pani-limie.marvinl.com",
      "https://pani-dlo.marvinl.com",
      "https://www.pani-dlo.marvinl.com",
    ],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/power-statuses", async (c) => {
  try {
    const statuses = await db
      .select({
        ...getTableColumns(powerStatuses),
        lastStatus: sql`MAX(${powerStatuses.createdAt})`,
      })
      .from(powerStatuses)
      .where(
        gte(powerStatuses.createdAt, new Date(Date.now() - 8 * 60 * 60 * 1000)),
      ) //limit to 6 hours ago
      .orderBy(desc(powerStatuses.createdAt))
      .groupBy(powerStatuses.latitude, powerStatuses.longitude);

    const obscuredStatuses = statuses.map((status) => ({
      ...status,
      latitude: obfuscateCoordinate(status.latitude),
      longitude: obfuscateCoordinate(status.longitude),
    }));

    return c.json(obscuredStatuses);
  } catch (error) {
    console.error("Error fetching power statuses:", error);
    return c.json({ error: "Failed to fetch power statuses" }, 500);
  }
});

app.post("/api/power-status", async (c) => {
  try {
    const { latitude, longitude, isOn } = await c.req.json();
    const newStatus = await db
      .insert(powerStatuses)
      .values({
        id: crypto.randomUUID(),
        latitude,
        longitude,
        isOn,
        createdAt: new Date(),
      })
      .returning()
      .get();
    return c.json(newStatus, 201);
  } catch (error) {
    console.error("Error creating power status:", error);
    return c.json({ error: "Failed to create power status" }, 500);
  }
});

app.get("/api/water-statuses", async (c) => {
  try {
    const statuses = await db
      .select({
        ...getTableColumns(waterStatuses),
        lastStatus: sql`MAX(${waterStatuses.createdAt})`,
      })
      .from(waterStatuses)
      .where(
        gte(waterStatuses.createdAt, new Date(Date.now() - 8 * 60 * 60 * 1000)),
      ) //limit to 6 hours ago
      .orderBy(desc(waterStatuses.createdAt))
      .groupBy(waterStatuses.latitude, waterStatuses.longitude);

    const obscuredStatuses = statuses.map((status) => ({
      ...status,
      latitude: obfuscateCoordinate(status.latitude),
      longitude: obfuscateCoordinate(status.longitude),
    }));
    return c.json(obscuredStatuses);
  } catch (error) {
    console.error("Error fetching water statuses:", error);
    return c.json({ error: "Failed to fetch water statuses" }, 500);
  }
});

app.post("/api/water-status", async (c) => {
  try {
    const { latitude, longitude, isOn } = await c.req.json();
    const newStatus = await db
      .insert(waterStatuses)
      .values({
        id: crypto.randomUUID(),
        latitude,
        longitude,
        isOn,
        createdAt: new Date(),
      })
      .returning()
      .get();
    return c.json(newStatus, 201);
  } catch (error) {
    console.error("Error creating water status:", error);
    return c.json({ error: "Failed to create water status" }, 500);
  }
});

app.get("*", async (c) => {
  const url = new URL(c.req.url);
  let requestPath = decodeURIComponent(url.pathname);

  if (requestPath === "/") {
    requestPath = "/index.html";
  }

  const normalizedPath = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(distDir, normalizedPath);

  if (existsSync(filePath)) {
    const file = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    return new Response(file, {
      headers: {
        "content-type": MIME_TYPES[extension] ?? "application/octet-stream",
      },
    });
  }

  if (existsSync(indexHtmlPath)) {
    const html = await readFile(indexHtmlPath);
    return new Response(html, {
      headers: {
        "content-type": MIME_TYPES[".html"],
      },
    });
  }

  return c.text("Frontend build not found", 500);
});

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
      continue;
    }

    if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : (Readable.toWeb(req) as ReadableStream),
    duplex: "half",
  });

  const response = await app.fetch(request);
  res.statusCode = response.status;

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  Readable.fromWeb(response.body as ReadableStream).pipe(res);
});

server.listen(port, () => {
  console.log(`Pani Limye server is running on port ${port}`);
});

export default {
  fetch: app.fetch,
  port,
};
