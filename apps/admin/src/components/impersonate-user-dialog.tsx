import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
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

interface ImpersonateUserDialogProps {
  user: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImpersonateUserDialog({ user, open, onOpenChange }: ImpersonateUserDialogProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.impersonateUser({
        userId: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success(`Now impersonating ${user.name}`);
      onOpenChange(false);
      router.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to impersonate user");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Impersonate User</DialogTitle>
          <DialogDescription>
            You are about to impersonate {user.name}. Your current admin session will be temporarily
            replaced with a session for this user. You can stop impersonating at any time using the
            banner at the top of the page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Impersonating..." : "Impersonate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
