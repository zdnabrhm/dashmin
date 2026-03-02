import { createFileRoute, Outlet, redirect, useMatches } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@dashmin/ui/components/sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import { CommandIcon } from "@hugeicons/core-free-icons";
import { NavMain } from "../components/nav-main";
import { NavUser } from "../components/nav-user";
import { Header } from "../components/header";
import { ImpersonationBanner } from "../components/impersonation-banner";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const { data: session } = await context.authClient.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }

    const isImpersonating = !!session.session.impersonatedBy;

    // Allow through if admin OR if this is an impersonation session
    if (session.user.role !== "admin" && !isImpersonating) {
      await context.authClient.signOut();
      throw redirect({ to: "/login" });
    }

    // Pass session to child routes via context
    return { session, isImpersonating };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { session, isImpersonating } = Route.useRouteContext();
  const matches = useMatches();
  const title = (matches.at(-1)?.staticData as { title?: string })?.title ?? "Dashboard";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="data-[slot=sidebar-menu-button]:p-1.5!"
                render={<a href="/" />}
              >
                <HugeiconsIcon icon={CommandIcon} strokeWidth={2} className="size-5!" />
                <span className="text-base font-semibold">Dashmin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={session.user} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {isImpersonating && <ImpersonationBanner userName={session.user.name} />}
        <Header title={title} />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
