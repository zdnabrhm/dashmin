import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@dashmin/ui/components/sidebar";
import { DashboardSquare01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useMatchRoute } from "@tanstack/react-router";

const menuItems = [
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
];

export function NavMain() {
  const matchRoute = useMatchRoute();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <Link to={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={!!matchRoute({ to: item.url, fuzzy: true })}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
