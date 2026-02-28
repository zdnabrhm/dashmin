import { flexRender, type Table as TableInstance } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dashmin/ui/components/table";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@dashmin/ui/components/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";

interface DataTableProps<TData> {
  table: TableInstance<TData>;
  // Number of columns – used for skeleton loading and empty state colSpan
  columnCount: number;
  // Show skeleton rows instead of data
  isLoading?: boolean;
  // Called when a row is clicked
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData>({
  table,
  columnCount,
  isLoading,
  onRowClick,
}: DataTableProps<TData>) {
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {/* Sort indicator */}
                  {header.column.getIsSorted() === "asc" ? (
                    <HugeiconsIcon icon={ArrowUp01Icon} className="inline-block ml-2 size-4" />
                  ) : header.column.getIsSorted() === "desc" ? (
                    <HugeiconsIcon icon={ArrowDown01Icon} className="inline-block ml-2 size-4" />
                  ) : header.column.getCanSort() ? (
                    <HugeiconsIcon
                      icon={ArrowUp01Icon}
                      className="inline-block ml-2 size-4 opacity-30"
                    />
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            // Skeleton loading rows
            Array.from({ length: table.getState().pagination.pageSize }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="size-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-8">
                No results found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={onRowClick ? "cursor-pointer" : ""}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
