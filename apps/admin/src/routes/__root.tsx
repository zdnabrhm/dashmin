import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@dashmin/ui/components/sonner";
import type { authClient } from "../lib/auth";
import { TooltipProvider } from "@dashmin/ui/components/tooltip";

interface RouterContext {
  queryClient: QueryClient;
  authClient: typeof authClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster position="top-center" />
        <ReactQueryDevtools />
        <TanStackRouterDevtools position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
