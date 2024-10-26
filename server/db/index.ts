import { drizzle } from "drizzle-orm/bun-sqlite";
// import { createClient } from "@libsql/client";
import * as schema from "./schema";
// Initialize the SQLite client (Turso)
// const client = createClient({
//   url: process.env.TURSO_DB_URL!,
//   authToken: process.env.TURSO_DB_AUTH_TOKEN!,
// });
import { Database } from "bun:sqlite";
const sqlite = new Database("sqlite.db");
// Initialize the Drizzle ORM
export const db = drizzle({ client: sqlite, schema });
