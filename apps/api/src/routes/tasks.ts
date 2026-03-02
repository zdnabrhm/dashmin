import { Hono } from "hono";
import { z } from "zod";
import { eq, desc, asc, like, and, sql, type SQL } from "drizzle-orm";
import { task, user } from "@dashmin/db";
import { db } from "../lib/db";
import { requireAdmin } from "../middleware/require-admin";
import { auth } from "../lib/auth";

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
  status: z.string().optional(),
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
      conditions.push(eq(task.status, status));
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
  .post("/", async (c) => {
    const body = await c.req.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.message }, 400);
    }

    const currentUser = c.get("user");

    const [newTask] = await db
      .insert(task)
      .values({
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        priority: parsed.data.priority,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        assigneeId: parsed.data.assigneeId,
        creatorId: currentUser.id,
      })
      .returning();

    return c.json({ task: newTask }, 201);
  })

  // Update task
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.message }, 400);
    }

    // Build the update object, only including provided fields
    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
    if (parsed.data.dueDate !== undefined) {
      updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }
    if (parsed.data.assigneeId !== undefined) updates.assigneeId = parsed.data.assigneeId;

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
