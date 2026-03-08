import { Sparkles, StickyNote, Files, Users, Trash2, Settings, Code2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { OltridLogo } from "@/components/OltridLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const mainNav = [
  { title: "Oltrid AI", url: "/", icon: Sparkles },
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

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden">
      {/* Header */}
      <div className="p-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 pl-1">
          <OltridLogo className="h-6 w-6 shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">Oltrid</span>
        </div>
      </div>

      {/* Main nav */}
      <ScrollArea className="flex-1 px-2 pt-1">
        <nav className="space-y-0.5">
          {mainNav.map((item) => {
            const isActive = location.pathname === item.url || (item.url === "/" && location.pathname === "/ai");
            return (
              <NavLink
                key={item.title}
                to={item.url}
                end
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom nav */}
      <div className="px-2 pb-3 shrink-0 space-y-0.5">
        {bottomNav.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.title}
              to={item.url}
              end
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{item.title}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
