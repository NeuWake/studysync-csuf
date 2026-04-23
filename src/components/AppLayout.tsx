import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { CanvasOnboardingDialog } from "@/components/CanvasOnboardingDialog";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div
        className="min-h-screen flex w-full"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--accent-bg-soft)) 50%, hsl(var(--accent-bg)) 100%)",
        }}
      >
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/80 backdrop-blur-sm supports-[backdrop-filter]:bg-card/60">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <CanvasOnboardingDialog />
    </SidebarProvider>
  );
}
