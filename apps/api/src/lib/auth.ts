import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import * as schema from "@dashmin/db/server";
import { db } from "./db.js";
import { uuidv7 } from "uuidv7";

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  trustedOrigins: [process.env.FRONTEND_URL!],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
  advanced: {
    database: {
      generateId: () => uuidv7(),
    },
  },
});
