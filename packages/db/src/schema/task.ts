import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { user } from "./user";

export const task = pgTable(
  "task",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").default("todo").notNull(),
    priority: text("priority").default("medium").notNull(),
    dueDate: timestamp("due_date"),
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "set null",
    }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_assignee_id_idx").on(table.assigneeId),
    index("task_creator_id_idx").on(table.creatorId),
    index("task_status_idx").on(table.status),
  ],
);

export const taskRelations = relations(task, ({ one }) => ({
  assignee: one(user, {
    fields: [task.assigneeId],
    references: [user.id],
    relationName: "assignedTasks",
  }),
  creator: one(user, {
    fields: [task.creatorId],
    references: [user.id],
    relationName: "createdTasks",
  }),
}));
