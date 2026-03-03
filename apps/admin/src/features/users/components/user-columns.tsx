import { type ColumnDef } from "@tanstack/react-table";
import { type User } from "@dashmin/db/shared";
import { Badge } from "@dashmin/ui/components/badge";

export const userColumns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: true,
  },
  {
    accessorKey: "email",
    header: "Email",
    enableSorting: true,
  },
  {
    accessorKey: "role",
    header: "Role",
    enableSorting: true,
    cell: ({ row }) => (
      <Badge variant={row.original.role === "admin" ? "default" : "secondary"}>
        {row.original.role}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    accessorFn: (row) => row.banned,
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant={row.original.banned ? "destructive" : "outline"}>
        {row.original.banned ? "Banned" : "Active"}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    enableSorting: true,
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("ja-JP"),
  },
];
