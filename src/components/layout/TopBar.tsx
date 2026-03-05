import { LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/useTheme";

export function TopBar() {
  const { user, signOut } = useAuth();
  const { isGuest } = useGuestMode();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? (isGuest ? "G" : "U");

  return (
    <header className="flex items-center gap-3 px-5 md:px-6 h-14 border-b border-border/40 bg-background/90 backdrop-blur-md sticky top-0 z-20">
      <SidebarTrigger className="md:hidden" />

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 ml-auto">
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

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
