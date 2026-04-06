import { useState } from "react";
import { Bot, StickyNote, Files, Users, Trash2, Settings, Code2, PanelLeftClose, BarChart3, CalendarDays } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { OltridLogo } from "@/components/OltridLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
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
  const navigate = useNavigate();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      navigate(`/notes?date=${date.toISOString().split("T")[0]}`);
    }
  };

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
        {/* Mini Calendar */}
        {!collapsed ? (
          <div className="mb-2">
            <button
              onClick={() => setCalendarOpen(!calendarOpen)}
              className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-all"
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </button>
            {calendarOpen && (
              <div className="mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  className="p-2 pointer-events-auto text-[11px] [&_.rdp-day]:h-7 [&_.rdp-day]:w-7 [&_.rdp-head_cell]:w-7 [&_.rdp-cell]:p-0"
                />
              </div>
            )}
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="flex items-center justify-center w-full p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-all mb-1"
              >
                <CalendarDays className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Calendar</TooltipContent>
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
