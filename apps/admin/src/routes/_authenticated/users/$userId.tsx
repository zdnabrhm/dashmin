import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { toast } from "sonner";
import type { Session } from "@dashmin/db";

import { Avatar, AvatarFallback } from "@dashmin/ui/components/avatar";
import { Badge } from "@dashmin/ui/components/badge";
import { Button } from "@dashmin/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@dashmin/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dashmin/ui/components/dropdown-menu";
import { Separator } from "@dashmin/ui/components/separator";
import { Skeleton } from "@dashmin/ui/components/skeleton";

import { queryKeys } from "@dashmin/admin/lib/query-keys";
import { DataTable } from "@dashmin/admin/components/data-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, MoreVerticalCircle01Icon } from "@hugeicons/core-free-icons";
import { EditUserDialog } from "@dashmin/admin/features/users/components/edit-user-dialog";
import { SetPasswordDialog } from "@dashmin/admin/features/users/components/set-password-dialog";
import { BanUserDialog } from "@dashmin/admin/features/users/components/ban-user-dialog";
import { UnbanUserDialog } from "@dashmin/admin/features/users/components/unban-user-dialog";
import { DeleteUserDialog } from "@dashmin/admin/features/users/components/delete-user-dialog";
import { sessionColumns } from "@dashmin/admin/features/users/components/session-columns";
import { RevokeAllSessionsDialog } from "@dashmin/admin/features/users/components/revoke-all-sessions-dialog";
import { ImpersonateUserDialog } from "@dashmin/admin/components/impersonate-user-dialog";

export const Route = createFileRoute("/_authenticated/users/$userId")({
  staticData: { title: "User Detail" },
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();
  const { authClient, queryClient, isImpersonating } = Route.useRouteContext();

  // User query
  const { data: user, isLoading } = useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () =>
      authClient.admin.listUsers({
        query: {
          limit: 1,
          filterField: "id",
          filterValue: userId,
          filterOperator: "eq" as const,
        },
      }),
    select: (res) => res.data?.users[0],
  });

  // Sessions query
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: queryKeys.users.sessions(userId),
    queryFn: () => authClient.admin.listUserSessions({ userId }),
    enabled: !!user,
  });
  const sessions = (sessionsData?.data?.sessions ?? []) as Session[];

  // Revoke single session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      const { error } = await authClient.admin.revokeUserSession({ sessionToken });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.sessions(userId) });
      toast.success("Session revoked");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to revoke session");
    },
  });

  // Sessions table
  const sessionsTable = useReactTable({
    data: sessions,
    columns: sessionColumns,
    getCoreRowModel: getCoreRowModel(),
    initialState: { pagination: { pageSize: 5, pageIndex: 0 } },
    meta: {
      onRevokeSession: (token: string) => revokeSessionMutation.mutate(token),
      isRevoking: revokeSessionMutation.isPending,
    },
  });

  // Dialog open states
  const [editOpen, setEditOpen] = useState(false);
  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-4 w-24" />
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 space-y-4">
        <Link
          to="/users"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex gap-1 items-center transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" /> Back to Users
        </Link>
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  const isBanned = !!user.banned;
  const initials = (user.name ?? "?")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-4 space-y-6">
      {/* Back link */}
      <Link
        to="/users"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex gap-1 items-center transition-colors"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" /> Back to Users
      </Link>

      {/* User profile card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {/* Avatar with initials */}
            <Avatar className="size-14 text-lg">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Name, email, badges */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                <Badge variant={isBanned ? "destructive" : "outline"}>
                  {isBanned ? "Banned" : "Active"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          {/* Actions dropdown */}
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                <HugeiconsIcon icon={MoreVerticalCircle01Icon} strokeWidth={2} className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit User</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSetPasswordOpen(true)}>
                    Set Password
                  </DropdownMenuItem>
                  {!isImpersonating && (
                    <DropdownMenuItem onClick={() => setImpersonateOpen(true)}>
                      Impersonate
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {isBanned ? (
                  <DropdownMenuItem onClick={() => setUnbanOpen(true)}>Unban User</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setBanOpen(true)}>Ban User</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Ban details alert */}
          {isBanned && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1">
              <p className="text-sm font-medium text-destructive">Ban Details</p>
              <p className="text-sm text-muted-foreground">
                {user.banReason ?? "No reason provided"}
              </p>
              <p className="text-xs text-muted-foreground">
                {user.banExpires
                  ? `Expires ${new Date(user.banExpires).toLocaleString()}`
                  : "Permanent ban"}
              </p>
            </div>
          )}

          <Separator />

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </p>
              <p>{new Date(user.createdAt).toLocaleDateString("ja-JP")}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Updated
              </p>
              <p>{new Date(user.updatedAt).toLocaleDateString("ja-JP")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions section */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardAction>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setRevokeAllOpen(true)}
              disabled={sessions.length === 0}
            >
              Revoke All
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            table={sessionsTable}
            columnCount={sessionColumns.length}
            isLoading={sessionsLoading}
          />
        </CardContent>
      </Card>

      {/* Action dialogs */}
      <EditUserDialog user={user} open={editOpen} onOpenChange={setEditOpen} />
      <SetPasswordDialog userId={userId} open={setPasswordOpen} onOpenChange={setSetPasswordOpen} />
      <BanUserDialog user={user} open={banOpen} onOpenChange={setBanOpen} />
      <UnbanUserDialog user={user} open={unbanOpen} onOpenChange={setUnbanOpen} />
      <DeleteUserDialog user={user} open={deleteOpen} onOpenChange={setDeleteOpen} />
      <RevokeAllSessionsDialog user={user} open={revokeAllOpen} onOpenChange={setRevokeAllOpen} />
      <ImpersonateUserDialog user={user} open={impersonateOpen} onOpenChange={setImpersonateOpen} />
    </div>
  );
}
