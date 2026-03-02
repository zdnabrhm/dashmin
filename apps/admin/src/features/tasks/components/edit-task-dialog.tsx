import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@dashmin/ui/components/field";
import { Input } from "@dashmin/ui/components/input";
import { Textarea } from "@dashmin/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dashmin/ui/components/select";
import { api } from "@dashmin/admin/lib/api";
import { queryKeys } from "@dashmin/admin/lib/query-keys";
import { authClient } from "@dashmin/admin/lib/auth";

const editTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000),
  status: z.enum(["todo", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string(),
  assigneeId: z.string(),
});

const statusItems = [
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
];

const priorityItems = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

interface EditTaskDialogProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
    assigneeId: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({ task: currentTask, open, onOpenChange }: EditTaskDialogProps) {
  const queryClient = useQueryClient();

  // Fetch admin users for the assignee select
  const { data: adminUsers } = useQuery({
    queryKey: ["admin", "users", "admins"],
    queryFn: () =>
      authClient.admin.listUsers({
        query: {
          limit: 100,
          filterField: "role",
          filterValue: "admin",
          filterOperator: "eq" as const,
        },
      }),
    select: (res) => res.data?.users ?? [],
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof editTaskSchema>) => {
      const res = await api.api.v1.tasks[":id"].$patch({
        param: { id: currentTask.id },
        json: {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
          assigneeId: values.assigneeId || null,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error: string }).error ?? "Failed to update task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success("Task updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update task");
    },
  });

  // Format due date for the date input (YYYY-MM-DD)
  const dueDateValue = currentTask.dueDate
    ? new Date(currentTask.dueDate).toISOString().split("T")[0]
    : "";

  const form = useForm({
    defaultValues: {
      title: currentTask.title,
      description: currentTask.description ?? "",
      status: currentTask.status as "todo" | "in_progress" | "done",
      priority: currentTask.priority as "low" | "medium" | "high" | "urgent",
      dueDate: dueDateValue,
      assigneeId: currentTask.assigneeId ?? "",
    },
    validators: { onSubmit: editTaskSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update task details.</DialogDescription>
        </DialogHeader>

        <form
          id="edit-task-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {/* Title */}
            <form.Field
              name="title"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Description */}
            <form.Field
              name="description"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={3}
                  />
                </Field>
              )}
            />

            {/* Status */}
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

            {/* Priority */}
            <form.Field
              name="priority"
              children={(field) => (
                <Field>
                  <FieldLabel>Priority</FieldLabel>
                  <Select
                    name={field.name}
                    items={priorityItems}
                    value={field.state.value}
                    onValueChange={(val) =>
                      field.handleChange(val as "low" | "medium" | "high" | "urgent")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Due Date */}
            <form.Field
              name="dueDate"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Due Date</FieldLabel>
                  <Input
                    id={field.name}
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />

            {/* Assignee */}
            <form.Field
              name="assigneeId"
              children={(field) => (
                <Field>
                  <FieldLabel>Assignee</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {(adminUsers ?? []).map((u: { id: string; name: string }) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
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
              <Button type="submit" form="edit-task-form" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            )}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
