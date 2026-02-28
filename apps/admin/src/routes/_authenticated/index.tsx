import { queryKeys } from "@dashmin/admin/lib/query-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@dashmin/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  staticData: { title: "Dashboard" },
  component: Dashboard,
});

function Dashboard() {
  const { session, authClient } = Route.useRouteContext();

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

  return (
    <div className="p-4 space-y-6">
      <h1>Welcome back, {session.user.name}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
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
      </div>
    </div>
  );
}
