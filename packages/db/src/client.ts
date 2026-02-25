import { drizzle } from "drizzle-orm/node-postgres";

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("Missing DATABASE_URL");
  return drizzle(databaseUrl);
}

export const db = createDb();
