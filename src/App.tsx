import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { BgThemeProvider } from "@/hooks/useBackgroundTheme";
import { GuestProvider } from "@/hooks/useGuestMode";
import { AnimatedBackground } from "@/components/layout/AnimatedBackground";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AiPage from "./pages/AiPage";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import ImagesPage from "./pages/ImagesPage";
import PdfsPage from "./pages/PdfsPage";
import FoldersPage from "./pages/FoldersPage";
import TrashPage from "./pages/TrashPage";
import SettingsPage from "./pages/SettingsPage";
import PublicFile from "./pages/PublicFile";
import EmbedFile from "./pages/EmbedFile";
import NotesPage from "./pages/NotesPage";
import WhiteboardPage from "./pages/WhiteboardPage";
import GroupsPage from "./pages/GroupsPage";
import JoinGroupPage from "./pages/JoinGroupPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BgThemeProvider>
        <AnimatedBackground />
      <AuthProvider>
      <GuestProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/file/:publicId" element={<PublicFile />} />
              <Route path="/embed/:publicId" element={<EmbedFile />} />
              {/* AI-first landing */}
              <Route path="/" element={<ProtectedRoute allowGuest><AiPage /></ProtectedRoute>} />
              <Route path="/files" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/images" element={<ProtectedRoute><ImagesPage /></ProtectedRoute>} />
              <Route path="/pdfs" element={<ProtectedRoute><PdfsPage /></ProtectedRoute>} />
              <Route path="/folders" element={<ProtectedRoute><FoldersPage /></ProtectedRoute>} />
              <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
              <Route path="/whiteboard" element={<ProtectedRoute><WhiteboardPage /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
              <Route path="/join/:inviteCode" element={<ProtectedRoute><JoinGroupPage /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute allowGuest><AiPage /></ProtectedRoute>} />
              <Route path="/trash" element={<ProtectedRoute><TrashPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </GuestProvider>
      </AuthProvider>
      </BgThemeProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
