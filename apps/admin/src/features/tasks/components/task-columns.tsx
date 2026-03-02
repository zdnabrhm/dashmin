import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@dashmin/ui/components/badge";
import type { TaskRow } from "../types";

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

export const taskColumns: ColumnDef<TaskRow>[] = [
  {
    accessorKey: "title",
    header: "Title",
    enableSorting: true,
    cell: ({ row }) => <span className="truncate max-w-50 block">{row.original.title}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: true,
    cell: ({ row }) => {
      const s = statusDisplay[row.original.status];
      return <Badge variant={s?.variant ?? "outline"}>{s?.label ?? row.original.status}</Badge>;
    },
  },
  {
    accessorKey: "priority",
    header: "Priority",
    enableSorting: true,
    cell: ({ row }) => {
      const p = priorityDisplay[row.original.priority];
      return <Badge variant={p?.variant ?? "outline"}>{p?.label ?? row.original.priority}</Badge>;
    },
  },
  {
    accessorKey: "assignee",
    header: "Assignee",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.assignee ? (
        <span>{row.original.assignee.name}</span>
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      ),
  },
  {
    accessorKey: "dueDate",
    header: "Due Date",
    enableSorting: true,
    cell: ({ row }) => {
      if (!row.original.dueDate) {
        return <span className="text-muted-foreground">No due date</span>;
      }
      const date = new Date(row.original.dueDate);
      const isOverdue = date < new Date() && row.original.status !== "done";
      return (
        <span className={isOverdue ? "text-destructive" : ""}>
          {date.toLocaleDateString("ja-JP")}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    enableSorting: true,
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("ja-JP"),
  },
];
