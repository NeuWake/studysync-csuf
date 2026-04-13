import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { TrendingUp, Award, Flame, Target } from "lucide-react";

const completionData = [
  { month: "Jan", completed: 12, missed: 1 },
  { month: "Feb", completed: 15, missed: 2 },
  { month: "Mar", completed: 18, missed: 0 },
  { month: "Apr", completed: 8, missed: 1 },
];

const courseData = [
  { name: "CS 301", value: 85, color: "hsl(25, 95%, 53%)" },
  { name: "MATH 250", value: 72, color: "hsl(217, 91%, 60%)" },
  { name: "ENG 102", value: 93, color: "hsl(142, 71%, 45%)" },
  { name: "PHYS 201", value: 61, color: "hsl(43, 96%, 56%)" },
];

const streakData = [
  { day: "Mon", tasks: 4 },
  { day: "Tue", tasks: 3 },
  { day: "Wed", tasks: 5 },
  { day: "Thu", tasks: 2 },
  { day: "Fri", tasks: 6 },
  { day: "Sat", tasks: 1 },
  { day: "Sun", tasks: 3 },
];

const timeData = [
  { week: "W1", avgHours: 2.5 },
  { week: "W2", avgHours: 3.1 },
  { week: "W3", avgHours: 2.0 },
  { week: "W4", avgHours: 1.8 },
  { week: "W5", avgHours: 2.2 },
];

export default function StatsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Statistics</h1>
        <p className="text-muted-foreground mt-1">Track your productivity and progress</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Completion Rate", value: "87%", icon: Target, color: "text-primary" },
          { label: "Current Streak", value: "12 days", icon: Flame, color: "text-destructive" },
          { label: "Total Completed", value: "53", icon: TrendingUp, color: "text-success" },
          { label: "Help Points", value: "42", icon: Award, color: "text-secondary" },
        ].map((s) => (
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
        {/* Completion over time */}
        <Card>
          <CardHeader>
            <CardTitle>Assignments Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={completionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="completed" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Course completion pie */}
        <Card>
          <CardHeader>
            <CardTitle>Completion by Course</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={courseData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                  {courseData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly activity */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={streakData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="tasks" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Time to completion trends */}
        <Card>
          <CardHeader>
            <CardTitle>Avg Time to Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="avgHours" stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={{ fill: "hsl(25, 95%, 53%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
