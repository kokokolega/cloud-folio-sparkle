import { useState, useEffect, useCallback } from "react";
import { Bot, StickyNote, Files, Users, Trash2, Settings, Code2, PanelLeftClose, BarChart3, CalendarDays, Plus, Check, X } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { OltridLogo } from "@/components/OltridLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
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

const CALENDAR_COLORS = [
  "hsl(210, 80%, 55%)",
  "hsl(280, 70%, 55%)",
  "hsl(340, 75%, 55%)",
  "hsl(160, 65%, 45%)",
  "hsl(30, 85%, 55%)",
  "hsl(200, 90%, 50%)",
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, toggleSidebar } = useSidebar();
  const { user } = useAuth();
  const collapsed = state === "collapsed";
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarColorIndex, setCalendarColorIndex] = useState(0);
  const [taskInput, setTaskInput] = useState("");
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [tasks, setTasks] = useState<{ id: string; title: string; date: string; completed: boolean }[]>([]);

  // Cycle calendar color every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setCalendarColorIndex((prev) => (prev + 1) % CALENDAR_COLORS.length);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load tasks for selected date
  const loadTasks = useCallback(async (date: Date) => {
    if (!user) return;
    const dateStr = date.toISOString().split("T")[0];
    const { data } = await supabase
      .from("tasks" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("date", dateStr)
      .order("created_at", { ascending: true });
    if (data) setTasks(data as any);
  }, [user]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setShowTaskInput(false);
    if (date) {
      loadTasks(date);
    }
  };

  const addTask = async () => {
    if (!taskInput.trim() || !selectedDate || !user) return;
    const dateStr = selectedDate.toISOString().split("T")[0];
    await supabase.from("tasks" as any).insert({
      user_id: user.id,
      title: taskInput.trim(),
      date: dateStr,
    } as any);
    setTaskInput("");
    setShowTaskInput(false);
    loadTasks(selectedDate);
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await supabase.from("tasks" as any).update({ completed: !completed } as any).eq("id", id);
    if (selectedDate) loadTasks(selectedDate);
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks" as any).delete().eq("id", id);
    if (selectedDate) loadTasks(selectedDate);
  };

  const calendarAccent = CALENDAR_COLORS[calendarColorIndex];

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
        {!collapsed ? (
          <div className="mb-2">
            <button
              onClick={() => setCalendarOpen(!calendarOpen)}
              className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-all"
              style={{ color: calendarAccent }}
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </button>
            {calendarOpen && (
              <div
                className="mt-1 rounded-xl border shadow-lg overflow-hidden bg-card transition-colors duration-700"
                style={{ borderColor: calendarAccent + "40" }}
              >
                <style>{`
                  .oltrid-calendar .rdp-day_selected { background: ${calendarAccent} !important; color: white !important; }
                  .oltrid-calendar .rdp-day_today { border: 1.5px solid ${calendarAccent}; }
                  .oltrid-calendar .rdp-nav_button:hover { color: ${calendarAccent}; }
                `}</style>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  className="oltrid-calendar p-2 pointer-events-auto text-[11px] [&_.rdp-day]:h-7 [&_.rdp-day]:w-7 [&_.rdp-head_cell]:w-7 [&_.rdp-cell]:p-0"
                />

                {selectedDate && (
                  <div className="px-2 pb-2 space-y-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Tasks · {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <button
                        onClick={() => setShowTaskInput(true)}
                        className="h-5 w-5 rounded-md flex items-center justify-center hover:bg-secondary transition-colors"
                        style={{ color: calendarAccent }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {showTaskInput && (
                      <div className="flex items-center gap-1">
                        <Input
                          value={taskInput}
                          onChange={(e) => setTaskInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addTask()}
                          placeholder="Add task..."
                          className="h-6 text-[11px] px-2 border-border/50"
                          autoFocus
                        />
                        <button onClick={addTask} className="text-green-500 hover:text-green-400 shrink-0">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setShowTaskInput(false); setTaskInput(""); }} className="text-muted-foreground hover:text-foreground shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {tasks.length > 0 ? (
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {tasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-1.5 group px-1">
                            <button
                              onClick={() => toggleTask(task.id, task.completed)}
                              className={cn(
                                "h-3 w-3 rounded-sm border shrink-0 flex items-center justify-center transition-colors",
                                task.completed ? "border-green-500 bg-green-500" : "border-muted-foreground/40"
                              )}
                            >
                              {task.completed && <Check className="h-2 w-2 text-white" />}
                            </button>
                            <span className={cn(
                              "text-[10px] truncate flex-1",
                              task.completed && "line-through text-muted-foreground/50"
                            )}>
                              {task.title}
                            </span>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : !showTaskInput ? (
                      <p className="text-[10px] text-muted-foreground/50 text-center py-1">No tasks</p>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="flex items-center justify-center w-full p-2 rounded-xl hover:bg-secondary transition-all mb-1"
                style={{ color: calendarAccent }}
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
