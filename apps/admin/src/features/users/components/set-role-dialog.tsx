import { useState } from "react";
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
import { Field, FieldLabel } from "@dashmin/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dashmin/ui/components/select";
import { authClient } from "@dashmin/admin/lib/auth";
import { queryKeys } from "@dashmin/admin/lib/query-keys";

const roleItems = [
  { label: "User", value: "user" },
  { label: "Admin", value: "admin" },
];

interface SetRoleDialogProps {
  user: { id: string; name: string; role?: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetRoleDialog({ user, open, onOpenChange }: SetRoleDialogProps) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<"admin" | "user">(user.role === "admin" ? "admin" : "user");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.setRole({
        userId: user.id,
        role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success(`Role updated to "${role}"`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update role");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Role</DialogTitle>
          <DialogDescription>Change the role for {user.name}.</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel>Role</FieldLabel>
          <Select
            value={role}
            items={roleItems}
            onValueChange={(val) => {
              if (val) setRole(val);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || role === user.role}
          >
            {mutation.isPending ? "Saving..." : "Save Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
