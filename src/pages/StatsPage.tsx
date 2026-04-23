import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Award, Flame, Target, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, addDays } from "date-fns";
import { useMemo } from "react";

export default function StatsPage() {
  const { user } = useAuth();

  const { data: userAssignments, isLoading: loadingUA } = useQuery({
    queryKey: ["stats-user-assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_assignments")
        .select("*, assignments(title, due_date, course_id, courses(name, code, color))")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["stats-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("help_points, study_streaks")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    if (!userAssignments) return null;

    const total = userAssignments.length;
    const completed = userAssignments.filter((a) => a.status === "completed").length;
    const missed = userAssignments.filter((a) => a.status === "missed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Monthly completion data (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(new Date(), i);
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const inRange = userAssignments.filter((a) => {
        const d = a.completed_at ? new Date(a.completed_at) : a.assignments?.due_date ? new Date(a.assignments.due_date) : null;
        return d && d >= start && d <= end;
      });
      monthlyData.push({
        month: format(month, "MMM"),
        completed: inRange.filter((a) => a.status === "completed").length,
        missed: inRange.filter((a) => a.status === "missed").length,
      });
    }

    // Course completion breakdown
    const courseMap = new Map<string, { name: string; completed: number; total: number; color: string }>();
    userAssignments.forEach((ua) => {
      const course = (ua.assignments as any)?.courses;
      const courseId = (ua.assignments as any)?.course_id || "uncategorized";
      const existing = courseMap.get(courseId) || {
        name: course?.code || course?.name || "Other",
        completed: 0,
        total: 0,
        color: course?.color || "#F97316",
      };
      existing.total++;
      if (ua.status === "completed") existing.completed++;
      courseMap.set(courseId, existing);
    });
    const courseData = Array.from(courseMap.values()).map((c) => ({
      name: c.name,
      value: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
      color: c.color,
    }));

    // Weekly activity (current week)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weeklyData = days.map((day, i) => {
      const dayDate = addDays(weekStart, i);
      const tasks = userAssignments.filter((a) => {
        if (a.status !== "completed" || !a.completed_at) return false;
        const d = new Date(a.completed_at);
        return d.toDateString() === dayDate.toDateString();
      }).length;
      return { day, tasks };
    });

    return { completionRate, completed, missed, total, monthlyData, courseData, weeklyData };
  }, [userAssignments]);

  if (loadingUA) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const summaryCards = [
    { label: "Completion Rate", value: `${stats?.completionRate ?? 0}%`, icon: Target, color: "text-primary" },
    { label: "Current Streak", value: `${profile?.study_streaks ?? 0} days`, icon: Flame, color: "text-destructive" },
    { label: "Total Completed", value: `${stats?.completed ?? 0}`, icon: TrendingUp, color: "text-success" },
    { label: "Help Points", value: `${profile?.help_points ?? 0}`, icon: Award, color: "text-secondary" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Statistics</h1>
        <p className="text-muted-foreground mt-1">Track your productivity and progress</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Assignments Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats?.monthlyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--card-foreground))' }} />
                <Bar dataKey="completed" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Completion by Course</CardTitle></CardHeader>
          <CardContent>
            {stats?.courseData?.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={stats.courseData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                    {stats.courseData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--card-foreground))' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-16">No course data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Weekly Activity</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats?.weeklyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--card-foreground))' }} />
                <Bar dataKey="tasks" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
