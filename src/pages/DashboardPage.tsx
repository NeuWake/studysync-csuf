import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, ClipboardList, CheckCircle, AlertTriangle, TrendingUp, Clock } from "lucide-react";

const mockDeadlines = [
  { id: 1, title: "CS 301 — Final Project", course: "CS 301", due: "Apr 15", daysLeft: 2, color: "bg-primary" },
  { id: 2, title: "MATH 250 — Problem Set 8", course: "MATH 250", due: "Apr 16", daysLeft: 3, color: "bg-secondary" },
  { id: 3, title: "ENG 102 — Essay Draft", course: "ENG 102", due: "Apr 17", daysLeft: 4, color: "bg-success" },
  { id: 4, title: "PHYS 201 — Lab Report", course: "PHYS 201", due: "Apr 19", daysLeft: 6, color: "bg-warning" },
];

const stats = [
  { label: "Completed", value: 24, icon: CheckCircle, color: "text-success" },
  { label: "In Progress", value: 5, icon: TrendingUp, color: "text-secondary" },
  { label: "Pending", value: 8, icon: Clock, color: "text-warning" },
  { label: "Missed", value: 1, icon: AlertTriangle, color: "text-destructive" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your study overview.</p>
      </div>

      {/* Stats row */}
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
        {/* 7-day deadline preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockDeadlines.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${d.color}`} />
                  <div>
                    <p className="font-medium text-sm text-foreground">{d.title}</p>
                    <p className="text-xs text-muted-foreground">Due {d.due}</p>
                  </div>
                </div>
                <Badge variant={d.daysLeft <= 2 ? "destructive" : "secondary"}>
                  {d.daysLeft}d left
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Course progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-secondary" />
              Course Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "CS 301", progress: 75 },
              { name: "MATH 250", progress: 60 },
              { name: "ENG 102", progress: 90 },
              { name: "PHYS 201", progress: 45 },
            ].map((course) => (
              <div key={course.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{course.name}</span>
                  <span className="text-muted-foreground">{course.progress}%</span>
                </div>
                <Progress value={course.progress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick To-Do */}
      <Card>
        <CardHeader>
          <CardTitle>Quick To-Do</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { text: "Review lecture notes for CS 301", done: false },
              { text: "Submit MATH 250 Problem Set", done: false },
              { text: "Read Chapter 12 for ENG 102", done: true },
              { text: "Prepare lab equipment list", done: false },
            ].map((item, i) => (
              <label key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <input type="checkbox" defaultChecked={item.done} className="h-4 w-4 rounded border-border accent-primary" />
                <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.text}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
