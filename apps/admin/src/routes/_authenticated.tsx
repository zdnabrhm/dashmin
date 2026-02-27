import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

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
import { DashboardSquare01Icon, UserGroupIcon, CommandIcon } from "@hugeicons/core-free-icons";
import { NavMain } from "../components/nav-main";
import { NavUser } from "../components/nav-user";
import { Header } from "../components/header";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const { data: session } = await context.authClient.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }

    if (session.user.role !== "admin") {
      // Authenticated but not admin, sign them out and redirect
      await context.authClient.signOut();
      throw redirect({ to: "/login" });
    }

    // Pass session to child routes via context
    return { session };
  },
  component: AuthenticatedLayout,
});

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
    },
    {
      title: "Users",
      url: "/users",
      icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
    },
  ],
};

function AuthenticatedLayout({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { session } = Route.useRouteContext();

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
          <NavMain items={data.navMain} />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={session.user} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Header />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
