import { Bot, StickyNote, Files, Users, Trash2, Settings, Code2, PanelLeftClose } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { OltridLogo } from "@/components/OltridLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mainNav = [
  { title: "Oltrid AI", url: "/", icon: Bot },
  { title: "Notes", url: "/notes", icon: StickyNote },
  { title: "All Files", url: "/files", icon: Files },
  { title: "Groups", url: "/groups", icon: Users },
  { title: "Codrix", url: "/codrix", icon: Code2 },
];

const bottomNav = [
  { title: "Trash", url: "/trash", icon: Trash2 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("p-3 pb-2", collapsed && "flex items-center justify-center p-2")}>
        <button onClick={toggleSidebar} className="flex items-center gap-2 pl-1 cursor-pointer hover:opacity-80 transition-opacity hidden md:flex">
          <OltridLogo className={cn("shrink-0", collapsed ? "h-7 w-7" : "h-6 w-6")} />
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-foreground truncate">Oltrid</span>
          )}
        </button>
        {/* Mobile: non-clickable header */}
        <div className="flex items-center gap-2 pl-1 md:hidden">
          <OltridLogo className="h-6 w-6 shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">Oltrid</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex-1 px-2 pt-1">
          <SidebarMenu>
            {mainNav.map((item) => {
              const isActive = location.pathname === item.url || (item.url === "/" && location.pathname === "/ai");
              return (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <NavLink
                          to={item.url}
                          end
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                        >
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right" className="text-xs">
                        {item.title}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-2 space-y-0.5">
        <SidebarMenu>
          {bottomNav.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="text-xs">
                      {item.title}
                    </TooltipContent>
                  )}
                </Tooltip>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
