import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Field, FieldGroup, FieldLabel } from "@dashmin/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dashmin/ui/components/select";

import { api } from "@dashmin/admin/lib/api";
import { queryKeys } from "@dashmin/admin/lib/query-keys";

const statusItems = [
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
];

interface ChangeStatusDialogProps {
  task: { id: string; title: string; status: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeStatusDialog({
  task: currentTask,
  open,
  onOpenChange,
}: ChangeStatusDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (status: "todo" | "in_progress" | "done") => {
      const res = await api.api.v1.tasks[":id"].$patch({
        param: { id: currentTask.id },
        json: { status },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error: string }).error ?? "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success("Status updated");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update status");
    },
  });

  const form = useForm({
    defaultValues: {
      status: currentTask.status as "todo" | "in_progress" | "done",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value.status);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Status</DialogTitle>
          <DialogDescription>Update the status of "{currentTask.title}".</DialogDescription>
        </DialogHeader>

        <form
          id="change-status-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="status"
              children={(field) => (
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    name={field.name}
                    items={statusItems}
                    value={field.state.value}
                    onValueChange={(val) =>
                      field.handleChange(val as "todo" | "in_progress" | "done")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <Button type="submit" form="change-status-form" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Status"}
              </Button>
            )}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
