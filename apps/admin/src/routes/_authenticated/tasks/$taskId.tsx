import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

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
import { api } from "@dashmin/admin/lib/api";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, MoreVerticalCircle01Icon } from "@hugeicons/core-free-icons";
import { EditTaskDialog } from "@dashmin/admin/features/tasks/components/edit-task-dialog";
import { ChangeStatusDialog } from "@dashmin/admin/features/tasks/components/change-status-dialog";
import { DeleteTaskDialog } from "@dashmin/admin/features/tasks/components/delete-task-dialog";

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

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  staticData: { title: "Task Detail" },
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();

  // Fetch single task
  const { data: taskData, isLoading } = useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: async () => {
      const res = await api.api.v1.tasks[":id"].$get({
        param: { id: taskId },
      });
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json();
    },
    select: (res) => res.task,
  });

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-4 w-24" />
        <Card>
          <CardHeader>
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!taskData) {
    return (
      <div className="p-4 space-y-4">
        <Link
          to="/tasks"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex gap-1 items-center transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" /> Back to Tasks
        </Link>
        <p className="text-muted-foreground">Task not found.</p>
      </div>
    );
  }

  const s = statusDisplay[taskData.status];
  const p = priorityDisplay[taskData.priority];

  return (
    <div className="p-4 space-y-6">
      {/* Back link */}
      <Link
        to="/tasks"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex gap-1 items-center transition-colors"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" /> Back to Tasks
      </Link>

      {/* Task card */}
      <Card>
        <CardHeader>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{taskData.title}</CardTitle>
              <Badge variant={s?.variant ?? "outline"}>{s?.label ?? taskData.status}</Badge>
              <Badge variant={p?.variant ?? "outline"}>{p?.label ?? taskData.priority}</Badge>
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
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit Task</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusOpen(true)}>
                    Change Status
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Description
            </p>
            <p className={taskData.description ? "text-sm" : "text-sm text-muted-foreground"}>
              {taskData.description || "No description"}
            </p>
          </div>

          <Separator />

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Assignee
              </p>
              <p>
                {taskData.assignee ? (
                  taskData.assignee.name
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Creator
              </p>
              <p>{taskData.creator?.name ?? "Unknown"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Due Date
              </p>
              <p>
                {taskData.dueDate ? (
                  (() => {
                    const date = new Date(taskData.dueDate);
                    const isOverdue = date < new Date() && taskData.status !== "done";
                    return (
                      <span className={isOverdue ? "text-destructive" : ""}>
                        {date.toLocaleDateString("ja-JP")}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-muted-foreground">No due date</span>
                )}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </p>
              <p>{new Date(taskData.createdAt).toLocaleDateString("ja-JP")}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Updated
              </p>
              <p>{new Date(taskData.updatedAt).toLocaleDateString("ja-JP")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditTaskDialog task={taskData} open={editOpen} onOpenChange={setEditOpen} />
      <ChangeStatusDialog task={taskData} open={statusOpen} onOpenChange={setStatusOpen} />
      <DeleteTaskDialog task={taskData} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
