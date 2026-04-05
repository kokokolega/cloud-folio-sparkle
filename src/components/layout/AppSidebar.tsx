import { Bot, StickyNote, Files, Users, Trash2, Settings, Code2, PanelLeftClose, BarChart3, HelpCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { OltridLogo } from "@/components/OltridLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mainNav = [
  { title: "Oltrid AI", url: "/", icon: Bot },
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
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
  const { user } = useAuth();
  const collapsed = state === "collapsed";

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const initials = (profile?.display_name?.[0] || user?.email?.[0] || "U").toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("p-4 pb-3", collapsed && "flex items-center justify-center p-2")}>
        {collapsed ? (
          <button onClick={toggleSidebar} className="cursor-pointer hover:opacity-80 transition-opacity">
            <OltridLogo className="h-7 w-7 shrink-0" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 pl-0.5">
            <OltridLogo className="h-7 w-7 shrink-0" />
            <span className="text-[15px] font-bold tracking-tight text-foreground truncate">Oltrid</span>
            <button onClick={toggleSidebar} className="ml-auto text-muted-foreground hover:text-foreground transition-colors hidden md:flex">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex-1 px-3 pt-1">
          <SidebarMenu className="space-y-0.5">
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
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
                            isActive
                              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                              : "text-foreground/65 hover:bg-secondary hover:text-foreground"
                          )}
                          activeClassName=""
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

      <SidebarFooter className="px-3 pb-3 space-y-0.5">
        {!collapsed && user && (
          <NavLink to="/settings" end className="flex items-center gap-2.5 px-3 py-2 mb-2 rounded-xl hover:bg-secondary/50 transition-colors" activeClassName="">
            <Avatar className="h-7 w-7 shrink-0">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </NavLink>
        )}
        {collapsed && user && (
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink to="/settings" end className="flex justify-center py-2 mb-2" activeClassName="">
                <Avatar className="h-7 w-7">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{displayName}</TooltipContent>
          </Tooltip>
        )}
        {!collapsed && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold px-3 pt-2 pb-1">
            Settings & Help
          </p>
        )}
        <SidebarMenu className="space-y-0.5">
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
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                            : "text-foreground/65 hover:bg-secondary hover:text-foreground"
                        )}
                        activeClassName=""
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
