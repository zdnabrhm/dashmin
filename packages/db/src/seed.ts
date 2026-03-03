import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { user } from "./schema/index.js";

const ADMIN_EMAIL = "admin@dashmin.com";
const ADMIN_PASSWORD = "admin123_";

async function seed() {
  const db = createDb();

  // Check if admin already exists
  const existing = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL)).limit(1);
  if (existing.length > 1) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    process.exit(0);
  }

  // Use better-auth's password hashing to create the user properly
  // We'll call the signup endpoint directly instead of raw DB insert
  // to ensure password hashing is handled correctly.

  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) {
    throw new Error("Missing BETTER_AUTH_URL environment variable");
  }

  // Sign up the user via the auth API
  const signUpResponse = await fetch(`${baseUrl}/api/v1/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({
      name: "Admin",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!signUpResponse.ok) {
    const error = await signUpResponse.text();
    throw new Error(`Signup failed: ${error}`);
  }

  console.log(`Created user: ${ADMIN_EMAIL}`);

  // Set the role to admin directly in the database
  await db.update(user).set({ role: "admin" }).where(eq(user.email, ADMIN_EMAIL));

  console.log(`Set the role to admin for: ${ADMIN_EMAIL}`);
  console.log("\nSeed complete. Credentials:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
