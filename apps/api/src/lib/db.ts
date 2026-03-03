import { createDb } from "@dashmin/db/server";

export const db = createDb(process.env.DATABASE_URL);
