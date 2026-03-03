import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { createDb } from "./client.js";
import type { account, session, task, user, verification } from "./schema/index.js";

export type Db = ReturnType<typeof createDb>;

export type User = InferSelectModel<typeof user>;
export type CreateUser = InferInsertModel<typeof user>;

export type Account = InferSelectModel<typeof account>;
export type CreateAccount = InferInsertModel<typeof account>;

export type Session = InferSelectModel<typeof session>;
export type CreateSession = InferInsertModel<typeof session>;

export type Verification = InferSelectModel<typeof verification>;
export type CreateVerification = InferInsertModel<typeof verification>;

export type Task = InferSelectModel<typeof task>;
export type CreateTask = InferInsertModel<typeof task>;
