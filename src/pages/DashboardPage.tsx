import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, ClipboardList, CheckCircle, AlertTriangle, TrendingUp, Clock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: userAssignments = [], isLoading } = useQuery({
    queryKey: ["dashboard-assignments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_assignments")
        .select(`
          id, status, progress, completed_at,
          assignment:assignments(id, title, due_date, assignment_type,
            course:courses(name, color)
          )
        `)
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["user-courses-progress", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_courses")
        .select("course:courses(id, name, color)")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Compute stats
  const completed = userAssignments.filter((a: any) => a.status === "completed").length;
  const inProgress = userAssignments.filter((a: any) => a.status === "in-progress").length;
  const pending = userAssignments.filter((a: any) => a.status === "pending").length;
  const missed = userAssignments.filter((a: any) => a.status === "missed").length;

  // Upcoming deadlines (next 7 days)
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = userAssignments
    .filter((a: any) => {
      const due = a.assignment?.due_date ? new Date(a.assignment.due_date) : null;
      return due && due >= now && due <= sevenDays && a.status !== "completed";
    })
    .sort((a: any, b: any) => new Date(a.assignment.due_date).getTime() - new Date(b.assignment.due_date).getTime())
    .slice(0, 6);

  // Course progress
  const courseProgress = courses.map((uc: any) => {
    const courseAssignments = userAssignments.filter((a: any) => a.assignment?.course?.name === uc.course?.name);
    const total = courseAssignments.length;
    const done = courseAssignments.filter((a: any) => a.status === "completed").length;
    return {
      name: uc.course?.name || "Unknown",
      color: uc.course?.color || "#F97316",
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  const stats = [
    { label: "Completed", value: completed, icon: CheckCircle, color: "text-success" },
    { label: "In Progress", value: inProgress, icon: TrendingUp, color: "text-secondary" },
    { label: "Pending", value: pending, icon: Clock, color: "text-warning" },
    { label: "Missed", value: missed, icon: AlertTriangle, color: "text-destructive" },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! Here's your study overview.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming deadlines. Sync Canvas from the Assignments page to get started!
              </p>
            ) : (
              upcoming.map((a: any) => {
                const due = new Date(a.assignment.due_date);
                const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: a.assignment.course?.color || "#F97316" }} />
                      <div>
                        <p className="font-medium text-sm text-foreground">{a.assignment.title}</p>
                        <p className="text-xs text-muted-foreground">{a.assignment.course?.name} · Due {due.toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge variant={daysLeft <= 2 ? "destructive" : "secondary"}>
                      {daysLeft}d left
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-secondary" />
              Course Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {courseProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No courses yet.</p>
            ) : (
              courseProgress.map((course) => (
                <div key={course.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-foreground">{course.name}</span>
                    <span className="text-muted-foreground">{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
