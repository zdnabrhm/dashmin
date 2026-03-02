import { queryKeys } from "@dashmin/admin/lib/query-keys";
import { api } from "@dashmin/admin/lib/api";
import { Badge } from "@dashmin/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@dashmin/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

const statusDisplay: Record<
  string,
  { label: string; variant: "outline" | "default" | "secondary" }
> = {
  todo: { label: "Todo", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default" },
  done: { label: "Done", variant: "secondary" },
};

const priorityDisplay: Record<
  string,
  { label: string; variant: "ghost" | "outline" | "default" | "destructive" }
> = {
  low: { label: "Low", variant: "ghost" },
  medium: { label: "Medium", variant: "outline" },
  high: { label: "High", variant: "default" },
  urgent: { label: "Urgent", variant: "destructive" },
};

export const Route = createFileRoute("/_authenticated/")({
  staticData: { title: "Dashboard" },
  component: Dashboard,
});

function Dashboard() {
  const { session, authClient } = Route.useRouteContext();

  // User stats
  const { data: allUsers } = useQuery({
    queryKey: queryKeys.users.stats.total,
    queryFn: () => authClient.admin.listUsers({ query: { limit: 1 } }),
  });

  const { data: bannedUsers } = useQuery({
    queryKey: queryKeys.users.stats.banned,
    queryFn: () =>
      authClient.admin.listUsers({
        query: {
          limit: 1,
          filterField: "banned",
          filterValue: true,
          filterOperator: "eq",
        },
      }),
  });

  const totalCount = allUsers?.data?.total ?? 0;
  const bannedCount = bannedUsers?.data?.total ?? 0;
  const activeCount = totalCount - bannedCount;

  // Open tasks stat
  const { data: openTasksData } = useQuery({
    queryKey: queryKeys.tasks.stats.total,
    queryFn: async () => {
      // Fetch todo tasks count
      const todoRes = await api.api.v1.tasks.$get({
        query: { limit: "1", status: "todo" },
      });
      const todoData = todoRes.ok ? await todoRes.json() : { total: 0 };

      // Fetch in_progress tasks count
      const inProgressRes = await api.api.v1.tasks.$get({
        query: { limit: "1", status: "in_progress" },
      });
      const inProgressData = inProgressRes.ok ? await inProgressRes.json() : { total: 0 };

      return (todoData.total ?? 0) + (inProgressData.total ?? 0);
    },
  });

  const openTasksCount = openTasksData ?? 0;

  // My Tasks widget
  const { data: myTasksData } = useQuery({
    queryKey: queryKeys.tasks.list({
      assigneeId: session.user.id,
      widget: "my-tasks",
    }),
    queryFn: async () => {
      const todoRes = await api.api.v1.tasks.$get({
        query: {
          limit: "5",
          assigneeId: session.user.id,
          status: "todo",
          sortBy: "priority",
          sortDirection: "desc",
        },
      });
      if (!todoRes.ok) return { tasks: [] };

      const todoData = await todoRes.json();

      const todoRes2 = await api.api.v1.tasks.$get({
        query: {
          limit: "5",
          assigneeId: session.user.id,
          status: "in_progress",
          sortBy: "priority",
          sortDirection: "desc",
        },
      });
      if (!todoRes2.ok) return { tasks: todoData.tasks };

      const inProgressData = await todoRes2.json();

      // Merge, sort by priority (urgent > high > medium > low), then by due date
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const merged = [...todoData.tasks, ...inProgressData.tasks]
        .sort((a, b) => {
          const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
          const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
          if (pa !== pb) return pa - pb;
          // Then by due date (soonest first, null last)
          if (a.dueDate && b.dueDate)
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return 0;
        })
        .slice(0, 5);

      return { tasks: merged };
    },
  });

  const myTasks = myTasksData?.tasks ?? [];

  return (
    <div className="p-4 space-y-6">
      <h1>Welcome back, {session.user.name}</h1>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              Total Banned Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{bannedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              Total Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              Open Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{openTasksCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* My Tasks widget */}
      <Card>
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open tasks assigned to you.</p>
          ) : (
            <div className="space-y-2">
              {myTasks.map(
                (t: {
                  id: string;
                  title: string;
                  priority: string;
                  status: string;
                  dueDate: string | null;
                }) => {
                  const p = priorityDisplay[t.priority];
                  const s = statusDisplay[t.status];
                  return (
                    <Link
                      key={t.id}
                      to="/tasks/$taskId"
                      params={{ taskId: t.id }}
                      className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{t.title}</span>
                        <Badge variant={p?.variant ?? "outline"}>{p?.label ?? t.priority}</Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {t.dueDate
                            ? new Date(t.dueDate).toLocaleDateString("ja-JP")
                            : "No due date"}
                        </span>
                        <Badge variant={s?.variant ?? "outline"}>{s?.label ?? t.status}</Badge>
                      </div>
                    </Link>
                  );
                },
              )}
            </div>
          )}
          {myTasks.length > 0 && (
            <Link
              to="/tasks"
              search={{ assigneeId: session.user.id }}
              className="mt-3 block text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View All →
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
