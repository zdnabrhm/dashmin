import { createDb } from "@dashmin/db";

export const db = createDb(process.env.DATABASE_URL);
