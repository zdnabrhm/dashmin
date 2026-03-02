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

const createTaskSchema = z.object({
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

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
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
    mutationFn: async (values: z.infer<typeof createTaskSchema>) => {
      const res = await api.api.v1.tasks.$post({
        json: {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
          assigneeId: values.assigneeId || undefined,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error: string }).error ?? "Failed to create task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success("Task created successfully");
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to create task");
    },
  });

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      status: "todo" as "todo" | "in_progress" | "done",
      priority: "medium" as "low" | "medium" | "high" | "urgent",
      dueDate: "",
      assigneeId: "",
    },
    validators: { onSubmit: createTaskSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Create a new task.</DialogDescription>
        </DialogHeader>

        <form
          id="create-task-form"
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
                      placeholder="Task title"
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
                    placeholder="Optional description"
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
                    onValueChange={(value) =>
                      field.handleChange(value as "todo" | "in_progress" | "done")
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
                    onValueChange={(value) =>
                      field.handleChange(value as "low" | "medium" | "high" | "urgent")
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
              <Button type="submit" form="create-task-form" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Task"}
              </Button>
            )}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
