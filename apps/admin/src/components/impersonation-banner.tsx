import { Button } from "@dashmin/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../lib/auth";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

interface ImpersonationBannerProps {
  userName: string;
}

export function ImpersonationBanner({ userName }: ImpersonationBannerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.stopImpersonating();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Stopped impersonating");
      router.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to stop impersonating");
    },
  });

  return (
    <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2">
      <p className="text-sm text-amber-800">
        You are impersonating <strong>{userName}</strong>
      </p>
      <Button
        variant="outline"
        size="sm"
        className="border-amber-300 text-amber-800 hover:bg-amber-100"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Stopping..." : "Stop Impersonating"}
      </Button>
    </div>
  );
}
