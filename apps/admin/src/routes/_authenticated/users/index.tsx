import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@dashmin/admin/lib/query-keys";
import { getCoreRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import type { User } from "@dashmin/db/shared";
import { Input } from "@dashmin/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@dashmin/ui/components/select";
import { Button } from "@dashmin/ui/components/button";
import { DataTable } from "@dashmin/admin/components/data-table";
import { userColumns } from "@dashmin/admin/features/users/components/user-columns";
import { CreateUserDialog } from "@dashmin/admin/features/users/components/create-user-dialog";

const roleItems = [
  { label: "All Roles", value: "all" },
  { label: "Admin", value: "admin" },
  { label: "User", value: "user" },
];

const statusItems = [
  { label: "All Statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Banned", value: "banned" },
];

export const Route = createFileRoute("/_authenticated/users/")({
  staticData: { title: "Users" },
  component: UsersPage,
});

function UsersPage() {
  const { authClient } = Route.useRouteContext();
  const navigate = useNavigate();

  // State
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 });
  const [activeFilter, setActiveFilter] = useState<
    { field: "role"; value: string } | { field: "banned"; value: boolean } | null
  >(null);

  // Data fetching
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.list({
      pagination,
      sorting: sorting[0],
      search: debouncedSearch,
      filter: activeFilter,
    }),
    queryFn: () =>
      authClient.admin.listUsers({
        query: {
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
          sortBy: sorting[0]?.id ?? "createdAt",
          sortDirection: sorting[0]?.desc ? "desc" : "asc",
          // Search (independent of filter)
          ...(debouncedSearch && {
            searchValue: debouncedSearch,
            searchField: "email" as const,
            searchOperator: "contains" as const,
          }),
          // Filter (only one at a time – Better Auth API limitation)
          ...(activeFilter?.field === "role" && {
            filterField: "role",
            filterValue: activeFilter.value,
            filterOperator: "eq" as const,
          }),
          ...(activeFilter?.field === "banned" && {
            filterField: "banned",
            filterValue: activeFilter.value,
            filterOperator: "eq" as const,
          }),
        },
      }),
    placeholderData: keepPreviousData,
  });

  const users = (data?.data?.users ?? []) as User[];
  const totalCount = data?.data?.total ?? 0;

  // Table instance
  const table = useReactTable({
    data: users,
    columns: userColumns,
    rowCount: totalCount,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  const pageCount = table.getPageCount();

  // Filter handlers
  const handleRoleFilter = (value: string | null) => {
    if (!value || value === "all") {
      // Clear filter only if role was the active one
      if (activeFilter?.field === "role") setActiveFilter(null);
    } else {
      setActiveFilter({ field: "role", value });
    }
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleStatusFilter = (value: string | null) => {
    if (!value || value === "all") {
      if (activeFilter?.field === "banned") setActiveFilter(null);
    } else {
      setActiveFilter({ field: "banned", value: value === "banned" });
    }
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Create user dialog state
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="max-w-xs"
          />

          <Select
            name="role"
            items={roleItems}
            value={activeFilter?.field === "role" ? activeFilter.value : "all"}
            onValueChange={handleRoleFilter}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Roles</SelectLabel>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            name="status"
            items={statusItems}
            value={
              activeFilter?.field === "banned" ? (activeFilter.value ? "banned" : "active") : "all"
            }
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Status</SelectLabel>
                {statusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setCreateUserDialogOpen(true)}>Create User</Button>
      </div>

      <DataTable
        table={table}
        columnCount={userColumns.length}
        isLoading={isLoading}
        onRowClick={(user) => navigate({ to: "/users/$userId", params: { userId: user.id } })}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount > 0
            ? `Showing ${pagination.pageIndex * pagination.pageSize + 1}-${Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)} of ${totalCount}`
            : "No results"}
        </p>

        <div className="flex items-center gap-2">
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(val) => setPagination({ pageIndex: 0, pageSize: Number(val) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span>
            Page {pagination.pageIndex + 1} of {pageCount || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      <CreateUserDialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen} />
    </div>
  );
}
