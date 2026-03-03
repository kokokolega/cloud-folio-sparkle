import { Files, Image, FileText, StickyNote, Trash2, Settings, ChevronLeft, Sparkles, Pencil, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { OltridLogo } from "@/components/OltridLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainNav = [
  { title: "Oltrid AI", url: "/", icon: Sparkles },
  { title: "All Files", url: "/files", icon: Files },
  { title: "Images", url: "/images", icon: Image },
  { title: "PDFs", url: "/pdfs", icon: FileText },
  { title: "Notes", url: "/notes", icon: StickyNote },
  { title: "Whiteboard", url: "/whiteboard", icon: Pencil },
  { title: "Groups", url: "/groups", icon: Users },
];

const bottomNav = [
  { title: "Trash", url: "/trash", icon: Trash2 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { toggleSidebar, open } = useSidebar();

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar" collapsible="icon">
      <SidebarHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        {open && (
          <div className="flex items-center gap-2 pl-1">
            <OltridLogo className="h-7 w-7" />
            <span className="text-base font-semibold tracking-tight text-foreground">Oltrid</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${!open ? "rotate-180" : ""}`} />
        </Button>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-2">
        <SidebarGroup>
          {open && <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 px-3 mb-1">Browse</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const isActive = location.pathname === item.url || (item.url === "/" && location.pathname === "/ai");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <SidebarMenu>
          {bottomNav.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <NavLink
                    to={item.url}
                    end
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
