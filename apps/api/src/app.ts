import { Hono } from "hono";
import { auth } from "./lib/auth";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { cors } from "hono/cors";

export const app = new Hono().basePath("/api/v1");

// Middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: [process.env.FRONTEND_URL!],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app
  .on(["POST", "GET"], "/auth/*", async (c) => {
    return auth.handler(c.req.raw);
  })
  .get("/", (c) => {
    return c.json({ message: `Hello ${process.env.HELLO ?? "WORLD"}!` });
  })
  .get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

export type AppType = typeof app;
