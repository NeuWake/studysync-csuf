import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  MessageSquare,
  StickyNote,
  BarChart3,
  User,
  Sun,
  Moon,
  LogOut,
  Volume2,
  VolumeOff,
  Sparkles,
  Calculator,
  NotebookPen,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useChatNotifications } from "@/contexts/ChatNotificationContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Assignments", url: "/assignments", icon: ClipboardList },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "AI Chat", url: "/ai-chat", icon: Sparkles },
  { title: "Whiteboard", url: "/whiteboard", icon: StickyNote },
  { title: "Notes", url: "/notes", icon: NotebookPen },
  { title: "Statistics", url: "/stats", icon: BarChart3 },
  { title: "Grade Calculator", url: "/grade-calculator", icon: Calculator },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { hasUnread, unreadRooms, chimeMuted, toggleChimeMute } = useChatNotifications();
  const unreadCount = unreadRooms.size;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">S</span>
            </div>
            <span className="text-lg font-bold text-foreground">StudySync</span>
          </div>
        ) : (
          <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center mx-auto">
            <span className="text-sm font-bold text-primary-foreground">S</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/50 relative"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <div className="relative mr-2">
                        <item.icon className="h-4 w-4" />
                        {item.url === "/chat" && hasUnread && collapsed && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
                        )}
                      </div>
                      {!collapsed && <span>{item.title}</span>}
                      {item.url === "/chat" && hasUnread && !collapsed && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none animate-pulse">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className="flex flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={toggleChimeMute}
                className="w-full justify-start"
              >
                {chimeMuted ? <VolumeOff className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {!collapsed && <span className="ml-2">{chimeMuted ? "Unmute Chime" : "Mute Chime"}</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {chimeMuted ? "Unmute notification chime" : "Mute notification chime"}
            </TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={toggleTheme}
            className="w-full justify-start"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {!collapsed && <span className="ml-2">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>}
          </Button>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={signOut}
            className="w-full justify-start text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
