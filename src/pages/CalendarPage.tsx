import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const mockEvents = [
  { id: 1, title: "CS 301 Lecture", time: "9:00 AM", type: "lecture", color: "bg-primary" },
  { id: 2, title: "MATH 250 Quiz Due", time: "11:59 PM", type: "assignment", color: "bg-secondary" },
  { id: 3, title: "Study Group", time: "3:00 PM", type: "personal", color: "bg-success" },
  { id: 4, title: "Office Hours", time: "4:00 PM", type: "office_hours", color: "bg-warning" },
];

export default function CalendarPage() {
  const [currentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-1">Unified view of all your deadlines, classes, and events</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Event
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl font-semibold text-foreground">{months[month]} {year}</h2>
          <Button variant="outline" size="icon"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-px">
              {days.map((d) => (
                <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">{d}</div>
              ))}
              {calendarDays.map((day, i) => (
                <div
                  key={i}
                  className={`min-h-[80px] p-1 border border-border rounded-sm ${
                    day === today ? "bg-primary/10 border-primary" : day ? "hover:bg-muted/50" : ""
                  }`}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-medium ${day === today ? "text-primary" : "text-foreground"}`}>{day}</span>
                      {day === today && (
                        <div className="mt-1 space-y-0.5">
                          <div className="text-[10px] bg-primary/20 text-primary rounded px-1 truncate">CS 301</div>
                          <div className="text-[10px] bg-secondary/20 text-secondary rounded px-1 truncate">Quiz</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className={`h-2 w-2 rounded-full mt-1.5 ${e.color}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Study Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs font-medium text-primary">Optimal study window</p>
                  <p className="text-xs text-muted-foreground">2:00 PM – 4:00 PM for CS 301 Final</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <p className="text-xs font-medium text-secondary">Review recommended</p>
                  <p className="text-xs text-muted-foreground">MATH 250 quiz in 3 days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
