import { Hono } from "hono";
import { z } from "zod";
import { eq, desc, asc, like, and, sql, inArray, type SQL } from "drizzle-orm";
import { task, user } from "@dashmin/db";
import { db } from "../lib/db";
import { requireAdmin } from "../middleware/require-admin";
import { auth } from "../lib/auth";
import { zValidator } from "@hono/zod-validator";

// Zod schemas
const statusEnum = z.enum(["todo", "in_progress", "done"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  status: statusEnum.optional().default("todo"),
  priority: priorityEnum.optional().default("medium"),
  dueDate: z.iso.datetime().optional(),
  assigneeId: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: z.iso.datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

const listTasksSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sortBy: z
    .enum(["title", "status", "priority", "dueDate", "createdAt"])
    .optional()
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
  search: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
});

// Column map for sorting
const sortColumnMap = {
  title: task.title,
  status: task.status,
  priority: task.priority,
  dueDate: task.dueDate,
  createdAt: task.createdAt,
} as const;

// Env type (matches requireAdmin middleware)
type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};

// Route group
export const tasksRoute = new Hono<Env>()
  // Apply requireAdmin to all routes in this group
  .use("/*", requireAdmin)

  // List tasks
  .get("/", async (c) => {
    const query = listTasksSchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: query.error.message }, 400);
    }

    const { limit, offset, sortBy, sortDirection, search, status, priority, assigneeId } =
      query.data;

    // Build WHERE conditions
    const conditions: SQL[] = [];
    if (search) {
      conditions.push(like(task.title, `%${search}%`));
    }
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      if (statuses.length === 1) {
        conditions.push(eq(task.status, statuses[0]));
      } else {
        conditions.push(inArray(task.status, statuses));
      }
    }
    if (priority) {
      conditions.push(eq(task.priority, priority));
    }
    if (assigneeId) {
      conditions.push(eq(task.assigneeId, assigneeId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Sort
    const sortColumn = sortColumnMap[sortBy];
    const orderBy = sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Query tasks with assignee + creator names via left joins
    const tasks = await db
      .select({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assigneeId: task.assigneeId,
        creatorId: task.creatorId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        assigneeName: user.name,
      })
      .from(task)
      .leftJoin(user, eq(task.assigneeId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(task)
      .where(where);

    return c.json({
      tasks: tasks.map((t) => ({
        ...t,
        assignee: t.assigneeName ? { name: t.assigneeName } : null,
      })),
      total: Number(countResult.count),
    });
  })

  // Task stats
  .get(
    "/stats",
    zValidator(
      "query",
      z.object({
        assigneeId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { assigneeId } = c.req.valid("query");

      const conditions: SQL[] = [];
      if (assigneeId) {
        conditions.push(eq(task.assigneeId, assigneeId));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          status: task.status,
          count: sql<number>`count(*)`,
        })
        .from(task)
        .where(where)
        .groupBy(task.status);

      const counts: Record<string, number> = { todo: 0, in_progress: 0, done: 0 };
      let total = 0;
      for (const row of rows) {
        counts[row.status] = Number(row.count);
        total += Number(row.count);
      }

      return c.json({ counts, total });
    },
  )

  // Get single task
  .get("/:id", async (c) => {
    const id = c.req.param("id");

    // Alias the user table for assignee and creator joins
    const assigneeUser = db.select({ id: user.id, name: user.name }).from(user).as("assignee_user");

    const creatorUser = db.select({ id: user.id, name: user.name }).from(user).as("creator_user");

    const [result] = await db
      .select({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assigneeId: task.assigneeId,
        creatorId: task.creatorId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        assigneeName: assigneeUser.name,
        creatorName: creatorUser.name,
      })
      .from(task)
      .leftJoin(assigneeUser, eq(task.assigneeId, assigneeUser.id))
      .leftJoin(creatorUser, eq(task.creatorId, creatorUser.id))
      .where(eq(task.id, id));

    if (!result) {
      return c.json({ error: "Task not found" }, 404);
    }

    return c.json({
      task: {
        ...result,
        assignee: result.assigneeName ? { id: result.assigneeId, name: result.assigneeName } : null,
        creator: { id: result.creatorId, name: result.creatorName },
      },
    });
  })

  // Create task
  .post("/", zValidator("json", createTaskSchema), async (c) => {
    const body = c.req.valid("json");
    const currentUser = c.get("user");

    const [newTask] = await db
      .insert(task)
      .values({
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assigneeId: body.assigneeId,
        creatorId: currentUser.id,
      })
      .returning();

    return c.json({ task: newTask }, 201);
  })

  // Update task
  .patch("/:id", zValidator("json", updateTaskSchema), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");

    // Build the update object, only including provided fields
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.dueDate !== undefined) {
      updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const [updatedTask] = await db.update(task).set(updates).where(eq(task.id, id)).returning();

    if (!updatedTask) {
      return c.json({ error: "Task not found" }, 404);
    }

    return c.json({ task: updatedTask });
  })

  // Delete task
  .delete("/:id", async (c) => {
    const id = c.req.param("id");

    const [deleted] = await db.delete(task).where(eq(task.id, id)).returning({ id: task.id });

    if (!deleted) {
      return c.json({ error: "Task not found" }, 404);
    }

    return c.body(null, 204);
  });
