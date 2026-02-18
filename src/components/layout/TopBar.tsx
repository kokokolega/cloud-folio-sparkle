import { Search, Upload, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/useTheme";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onUploadClick: () => void;
}

export function TopBar({ searchQuery, onSearchChange, onUploadClick }: TopBarProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <header className="flex items-center gap-3 px-4 md:px-6 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-20">
      <SidebarTrigger className="md:hidden" />

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-secondary/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl h-10 w-10">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Upload */}
        <Button
          onClick={onUploadClick}
          className="rounded-xl h-10 px-5 bg-primary hover:bg-primary/90 glow-primary transition-all duration-300 font-medium"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>

        {/* Avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuItem className="text-xs text-muted-foreground cursor-default">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
