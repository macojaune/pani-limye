import { type Config, defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  verbose: true,
  dbCredentials: {
    url: process.env.TURSO_DB_URL,
  },
} as Config);
