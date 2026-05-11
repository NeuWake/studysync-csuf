import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ChatNotificationProvider } from "@/contexts/ChatNotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GOOGLE_DRIVE_CONNECT_PARAM, getGoogleDriveAuthUrl } from "@/lib/googleDriveOAuth";
import { AppLayout } from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import CalendarPage from "@/pages/CalendarPage";
import AssignmentsPage from "@/pages/AssignmentsPage";
import ChatPage from "@/pages/ChatPage";
import WhiteboardPage from "@/pages/WhiteboardPage";
import DrivePage from "@/pages/DrivePage";
import StatsPage from "@/pages/StatsPage";
import ProfilePage from "@/pages/ProfilePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, pendingEmail } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (pendingEmail || !user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function GoogleDriveOAuthBootstrap() {
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get(GOOGLE_DRIVE_CONNECT_PARAM) !== "1") return;
    params.delete(GOOGLE_DRIVE_CONNECT_PARAM);
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", cleanUrl);

    void (async () => {
      try {
        window.location.assign(await getGoogleDriveAuthUrl(window.location.href));
      } catch (e) {
        toast({ title: "Couldn't start Google sign-in", description: (e as Error).message, variant: "destructive" });
      }
    })();
  }, [toast]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <ChatNotificationProvider>
          <TooltipProvider>
          <GoogleDriveOAuthBootstrap />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
              <Route path="/confirm-email" element={<Navigate to="/auth" replace />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/assignments" element={<AssignmentsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/whiteboard" element={<WhiteboardPage />} />
                <Route path="/drive" element={<DrivePage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TooltipProvider>
        </ChatNotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
