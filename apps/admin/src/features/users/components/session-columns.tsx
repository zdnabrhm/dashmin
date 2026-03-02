import { type ColumnDef } from "@tanstack/react-table";
import { type Session } from "@dashmin/db";
import { Button } from "@dashmin/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dashmin/ui/components/tooltip";

export interface SessionTableMeta {
  onRevokeSession: (token: string) => void;
  isRevoking: boolean;
}

export const sessionColumns: ColumnDef<Session>[] = [
  {
    accessorKey: "token",
    header: "Token",
    cell: ({ row }) => <code className="text-xs">{row.original.token.slice(0, 12)}...</code>,
  },
  {
    accessorKey: "ipAddress",
    header: "IP Address",
    cell: ({ row }) => row.original.ipAddress || "\u2014",
  },
  {
    accessorKey: "userAgent",
    header: "User Agent",
    cell: ({ row }) => {
      const userAgent = row.original.userAgent;
      if (!userAgent) return "\u2014";
      return (
        <Tooltip>
          <TooltipTrigger className="max-w-48 truncate block">{userAgent}</TooltipTrigger>
          <TooltipContent>
            <p>{userAgent}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("ja-JP"),
  },
  {
    accessorKey: "expiresAt",
    header: "Expires At",
    cell: ({ row }) => new Date(row.original.expiresAt).toLocaleDateString("ja-JP"),
  },
  {
    accessorKey: "impersonatedBy",
    header: "Impersonated By",
    cell: ({ row }) => row.original.impersonatedBy || "\u2014",
  },
  {
    id: "actions",
    header: "",
    cell: ({ row, table }) => {
      const meta = table.options.meta as SessionTableMeta;
      return (
        <Button
          variant="destructive"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            meta.onRevokeSession(row.original.token);
          }}
          disabled={meta.isRevoking}
        >
          Revoke
        </Button>
      );
    },
  },
];
