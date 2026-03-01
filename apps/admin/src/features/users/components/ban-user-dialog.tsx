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
import { Input } from "@dashmin/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dashmin/ui/components/select";
import { authClient } from "@dashmin/admin/lib/auth";
import { queryKeys } from "@dashmin/admin/lib/query-keys";

// Duration options in seconds
const DURATION_OPTIONS = [
  { label: "Permanent", value: "permanent" },
  { label: "1 day", value: String(60 * 60 * 24) },
  { label: "7 days", value: String(60 * 60 * 24 * 7) },
  { label: "30 days", value: String(60 * 60 * 24 * 30) },
  { label: "Custom (days)", value: "custom" },
] as const;

interface BanUserDialogProps {
  user: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BanUserDialog({ user, open, onOpenChange }: BanUserDialogProps) {
  const queryClient = useQueryClient();
  const [banReason, setBanReason] = useState("");
  const [duration, setDuration] = useState("permanent");
  const [customDays, setCustomDays] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      // Calculate banExpiresIn (seconds), undefined = permanent
      let banExpiresIn: number | undefined;
      if (duration === "custom") {
        const days = Number.parseInt(customDays, 10);
        if (Number.isNaN(days) || days <= 0) throw new Error("Enter a valid number of days");
        banExpiresIn = days * 60 * 60 * 24;
      } else if (duration !== "permanent") {
        banExpiresIn = Number.parseInt(duration, 10);
      }

      const { error } = await authClient.admin.banUser({
        userId: user.id,
        banReason: banReason || undefined,
        banExpiresIn,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success(`${user.name} has been banned`);
      onOpenChange(false);
      // Reset form state
      setBanReason("");
      setDuration("permanent");
      setCustomDays("");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to ban user");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban User</DialogTitle>
          <DialogDescription>
            Ban {user.name} from signing in. All their active sessions will be revoked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel>Reason (optional)</FieldLabel>
            <Input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g., Spamming"
              autoComplete="off"
            />
          </Field>

          <Field>
            <FieldLabel>Duration</FieldLabel>
            <Select
              value={duration}
              items={DURATION_OPTIONS}
              onValueChange={(value) => setDuration(value ?? "permanent")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {duration === "custom" && (
            <Field>
              <FieldLabel>Number of days</FieldLabel>
              <Input
                type="number"
                min="1"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="e.g., 14"
              />
            </Field>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Banning..." : "Ban User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
