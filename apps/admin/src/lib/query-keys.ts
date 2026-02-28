export const queryKeys = {
  users: {
    all: ["admin", "users"] as const,
    list: (params: Record<string, unknown>) => ["admin", "users", "list", params] as const,
    detail: (userId: string) => ["admin", "users", "detail", userId] as const,
    sessions: (userId: string) => ["admin", "users", "sessions", userId] as const,
    stats: {
      total: ["admin", "users", "total"] as const,
      banned: ["admin", "users", "banned"] as const,
    },
  },
};
