import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginForm } from "@dashmin/admin/features/auth/components/login-form";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    const { data: session } = await context.authClient.getSession();
    if (session && session.user.role === "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          Dashmin
        </a>
        <LoginForm />
      </div>
    </div>
  );
}
