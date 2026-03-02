import { Search, Upload, LogOut, Moon, Sun, Files, Image, FileText, FolderOpen, StickyNote, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV_ICONS = [
  { icon: Files, url: "/files", label: "All Files" },
  { icon: Image, url: "/images", label: "Images" },
  { icon: FileText, url: "/pdfs", label: "PDFs" },
  { icon: FolderOpen, url: "/folders", label: "Folders" },
  { icon: StickyNote, url: "/notes", label: "Notes" },
  { icon: Pencil, url: "/whiteboard", label: "Whiteboard" },
  { icon: Users, url: "/groups", label: "Groups" },
];

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onUploadClick: () => void;
}

export function TopBar({ searchQuery, onSearchChange, onUploadClick }: TopBarProps) {
  const { user, signOut } = useAuth();
  const { isGuest } = useGuestMode();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? (isGuest ? "G" : "U");

  return (
    <header className="flex items-center gap-3 px-5 md:px-6 h-14 border-b border-border/40 bg-background/90 backdrop-blur-md sticky top-0 z-20">
      <SidebarTrigger className="md:hidden" />

      <div className="flex-1 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 rounded-lg bg-muted/60 border-0 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Nav icons next to search */}
      <div className="hidden md:flex items-center gap-0.5">
        {NAV_ICONS.map((item) => {
          const active = location.pathname === item.url;
          return (
            <Tooltip key={item.url}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(item.url)}
                  className={cn(
                    "h-8 w-8 rounded-lg",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px]">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {!isGuest && (
          <Button
            onClick={onUploadClick}
            size="sm"
            className="rounded-lg h-9 px-4 text-[13px] font-medium"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload
          </Button>
        )}

        {isGuest ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/auth")}
            className="rounded-lg h-9 px-4 text-[13px]"
          >
            Sign up
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 ml-1">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-lg">
              <DropdownMenuItem className="text-xs text-muted-foreground cursor-default">
                {user?.email}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
