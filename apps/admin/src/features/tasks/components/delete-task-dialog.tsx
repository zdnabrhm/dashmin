import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@dashmin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dashmin/ui/components/dialog";

import { api } from "@dashmin/admin/lib/api";
import { queryKeys } from "@dashmin/admin/lib/query-keys";

interface DeleteTaskDialogProps {
  task: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTaskDialog({ task: currentTask, open, onOpenChange }: DeleteTaskDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.v1.tasks[":id"].$delete({
        param: { id: currentTask.id },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error: string }).error ?? "Failed to delete task");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success(`"${currentTask.title}" has been deleted`);
      onOpenChange(false);
      navigate({ to: "/tasks" });
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete task");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Task</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the task "{currentTask.title}
            ".
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Deleting..." : "Delete Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
