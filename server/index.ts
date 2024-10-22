import { Hono } from "hono";
import { powerStatuses } from "./db/schema";
import { cors } from "hono/cors";
import { db } from "./db";

const obfuscateCoordinate = (coord: number, factor = 0.001) => {
  return coord + (Math.random() - 0.667) * factor;
};

const app = new Hono();
app.use(
  "/api/*",
  cors({
    origin: [
      "http://localhost:5173",
      "https://pani-limie.netlify.app",
      "https://www.pani-limie.netlify.app",
      "https://pani-limie.marvinl.com",
      "https://pani-limye.marvinl.com",
      "https://www.pani-limye.marvinl.com",
      "https://www.pani-limie.marvinl.com",
    ],
  }),
);

app.get("/", (c) => c.text("Pani limyè!"));

app.get("/api/power-statuses", async (c) => {
  try {
    const statuses = await db.query.powerStatuses.findMany({
      where: (ps, { gte }) =>
        gte(ps.createdAt, new Date(Date.now() - 6 * 60 * 60 * 1000)), //limit to 6 hours ago
    });
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
    const { latitude, longitude, hasPower } = await c.req.json();
    const newStatus = await db
      .insert(powerStatuses)
      .values({
        id: crypto.randomUUID(),
        latitude,
        longitude,
        hasPower,
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

const port = 3000;
console.log(`Server is running on port ${port}`);

export default {
  fetch: app.fetch,
  port,
};
