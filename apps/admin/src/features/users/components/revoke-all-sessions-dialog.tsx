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
import { authClient } from "@dashmin/admin/lib/auth";
import { queryKeys } from "@dashmin/admin/lib/query-keys";

interface RevokeAllSessionsDialogProps {
  user: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevokeAllSessionsDialog({
  user,
  open,
  onOpenChange,
}: RevokeAllSessionsDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.revokeUserSessions({
        userId: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.sessions(user.id) });
      toast.success(`All sessions for ${user.name} have been revoked`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to revoke sessions");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke All Sessions</DialogTitle>
          <DialogDescription>
            Are you sure you want to revoke all sessions for {user.name}? They will be signed out
            from all devices.
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
            {mutation.isPending ? "Revoking..." : "Revoke All"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
