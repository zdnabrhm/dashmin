import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
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
import { authClient } from "@dashmin/admin/lib/auth";

const setPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

interface SetPasswordDialogProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetPasswordDialog({ userId, open, onOpenChange }: SetPasswordDialogProps) {
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof setPasswordSchema>) => {
      const { error } = await authClient.admin.setUserPassword({
        userId,
        newPassword: values.newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated successfully");
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update password");
    },
  });

  const form = useForm({
    defaultValues: { newPassword: "" },
    validators: { onSubmit: setPasswordSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Password</DialogTitle>
          <DialogDescription>Set a new password for this user.</DialogDescription>
        </DialogHeader>

        <form
          id="set-password-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="newPassword"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
                    <Input
                      id={field.name}
                      type="password"
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
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <Button type="submit" form="set-password-form" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Saving..." : "Set Password"}
              </Button>
            )}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
