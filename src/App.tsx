import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import TrashPage from "./pages/TrashPage";
import SettingsPage from "./pages/SettingsPage";
import PublicFile from "./pages/PublicFile";
import EmbedFile from "./pages/EmbedFile";
import NotesPage from "./pages/NotesPage";
import GroupsPage from "./pages/GroupsPage";
import JoinGroupPage from "./pages/JoinGroupPage";
import CodrixPage from "./pages/CodrixPage";
import NotFound from "./pages/NotFound";
import DashboardPage from "./pages/DashboardPage";
import FoldersPage from "./pages/FoldersPage";
import NoteFoldersPage from "./pages/NoteFoldersPage";
import PdfEditorPage from "./pages/PdfEditorPage";
import SmartCapturePage from "./pages/SmartCapturePage";
import SecondBrainPage from "./pages/SecondBrainPage";
import AlarmAppPage from "./pages/AlarmAppPage";
import { Scratchpad } from "@/components/scratchpad/Scratchpad";
import { HandoffManager } from "@/components/HandoffManager";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
    <ThemeProvider>
      <BgThemeProvider>
      <BrowserRouter>
        <AnimatedBackground />
        <AuthProvider>
          <GuestProvider>
            <TooltipProvider>
          <Toaster />
          <Sonner />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/file/:publicId" element={<PublicFile />} />
              <Route path="/embed/:publicId" element={<EmbedFile />} />
              {/* AI-first landing */}
              <Route path="/" element={<ProtectedRoute allowGuest><AiPage /></ProtectedRoute>} />
              <Route path="/files" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/folders" element={<ProtectedRoute><FoldersPage /></ProtectedRoute>} />
              <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
              <Route path="/note-folders" element={<ProtectedRoute><NoteFoldersPage /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
              <Route path="/join/:inviteCode" element={<ProtectedRoute><JoinGroupPage /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute allowGuest><AiPage /></ProtectedRoute>} />
              <Route path="/codrix" element={<ProtectedRoute allowGuest><CodrixPage /></ProtectedRoute>} />
              <Route path="/pdf-editor" element={<ProtectedRoute><PdfEditorPage /></ProtectedRoute>} />
              <Route path="/desktop" element={<ProtectedRoute><SecondBrainPage /></ProtectedRoute>} />
              <Route path="/capture" element={<ProtectedRoute><SmartCapturePage /></ProtectedRoute>} />
              <Route path="/alarm" element={<ProtectedRoute><AlarmAppPage /></ProtectedRoute>} />
              <Route path="/trash" element={<ProtectedRoute><TrashPage /></ProtectedRoute>} />

              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <HandoffManager />
            <Scratchpad />
        </TooltipProvider>
      </GuestProvider>

      </AuthProvider>
      </BrowserRouter>
      </BgThemeProvider>
    </ThemeProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
