import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
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
import { queryKeys } from "@dashmin/admin/lib/query-keys";
import { api } from "@dashmin/admin/lib/api";
import { taskColumns } from "@dashmin/admin/features/tasks/components/task-columns";
import { CreateTaskDialog } from "@dashmin/admin/features/tasks/components/create-task-dialog";
import type { TaskRow } from "@dashmin/admin/features/tasks/types";

const statusItems = [
  { label: "All Statuses", value: "all" },
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
];

const priorityItems = [
  { label: "All Priorities", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

export const Route = createFileRoute("/_authenticated/tasks/")({
  staticData: { title: "Tasks" },
  component: TasksPage,
});

function TasksPage() {
  const navigate = useNavigate();

  // State
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Data fetching via Hono RPC
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tasks.list({
      pagination,
      sorting: sorting[0],
      search: debouncedSearch,
      status: statusFilter,
      priority: priorityFilter,
    }),
    queryFn: async () => {
      const res = await api.api.v1.tasks.$get({
        query: {
          limit: String(pagination.pageSize),
          offset: String(pagination.pageIndex * pagination.pageSize),
          sortBy: (sorting[0]?.id ?? "createdAt") as
            | "title"
            | "status"
            | "priority"
            | "dueDate"
            | "createdAt",
          sortDirection: sorting[0]?.desc ? "desc" : "asc",
          ...(debouncedSearch && { search: debouncedSearch }),
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(priorityFilter !== "all" && { priority: priorityFilter }),
        },
      });

      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const tasks = (data?.tasks ?? []) as TaskRow[];
  const totalCount = data?.total ?? 0;

  // Table instance
  const table = useReactTable({
    data: tasks,
    columns: taskColumns,
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

  // Create task dialog
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="max-w-xs"
          />

          <Select
            name="status"
            items={statusItems}
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val ?? "all");
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
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

          <Select
            name="priority"
            items={priorityItems}
            value={priorityFilter}
            onValueChange={(val) => {
              setPriorityFilter(val ?? "all");
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Priority</SelectLabel>
                {priorityItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
      </div>

      <DataTable
        table={table}
        columnCount={taskColumns.length}
        isLoading={isLoading}
        onRowClick={(task) => navigate({ to: "/tasks/$taskId", params: { taskId: task.id } })}
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

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
