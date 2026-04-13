import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const eventTypeColors: Record<string, string> = {
  lecture: "bg-primary",
  lab: "bg-secondary",
  office_hours: "bg-amber-500",
  personal: "bg-emerald-500",
  study: "bg-violet-500",
  exam: "bg-destructive",
  assignment: "bg-blue-500",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", startTime: "", endTime: "", eventType: "personal" as string });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const navigate = (dir: number) => {
    setCurrentDate(new Date(year, month + dir, 1));
  };

  // Fetch user events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["user-events", user?.id, year, month],
    queryFn: async () => {
      if (!user) return [];
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from("user_events")
        .select("*, course:courses(name, color)")
        .eq("user_id", user.id)
        .gte("start_time", start)
        .lte("start_time", end)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch assignments with due dates this month
  const { data: assignments = [] } = useQuery({
    queryKey: ["calendar-assignments", user?.id, year, month],
    queryFn: async () => {
      if (!user) return [];
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from("user_assignments")
        .select("id, status, assignment:assignments(id, title, due_date, course:courses(name, color))")
        .eq("user_id", user.id);
      if (error) throw error;
      // Filter to this month client-side
      return (data || []).filter((ua: any) => {
        const due = ua.assignment?.due_date;
        return due && due >= start && due <= end;
      });
    },
    enabled: !!user,
  });

  // Combine events and assignments into calendar items
  const calendarItems = useMemo(() => {
    const items: { date: number; title: string; color: string; type: string; time: string }[] = [];

    events.forEach((e: any) => {
      const d = new Date(e.start_time);
      if (d.getMonth() === month && d.getFullYear() === year) {
        items.push({
          date: d.getDate(),
          title: e.title,
          color: e.color || (e.course as any)?.color || eventTypeColors[e.event_type] || "bg-primary",
          type: e.event_type || "personal",
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    });

    assignments.forEach((ua: any) => {
      const a = ua.assignment;
      if (!a?.due_date) return;
      const d = new Date(a.due_date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        items.push({
          date: d.getDate(),
          title: a.title,
          color: (a.course as any)?.color || "bg-blue-500",
          type: "assignment",
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    });

    return items;
  }, [events, assignments, month, year]);

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map = new Map<number, typeof calendarItems>();
    calendarItems.forEach((item) => {
      const arr = map.get(item.date) || [];
      arr.push(item);
      map.set(item.date, arr);
    });
    return map;
  }, [calendarItems]);

  // Today's items
  const todayItems = useMemo(() => {
    if (today.getMonth() !== month || today.getFullYear() !== year) return [];
    return itemsByDate.get(today.getDate()) || [];
  }, [itemsByDate, today, month, year]);

  // Upcoming assignments for study suggestions
  const upcomingAssignments = useMemo(() => {
    return assignments
      .filter((ua: any) => {
        const due = ua.assignment?.due_date;
        return due && new Date(due) > today;
      })
      .sort((a: any, b: any) => new Date(a.assignment.due_date).getTime() - new Date(b.assignment.due_date).getTime())
      .slice(0, 3);
  }, [assignments, today]);

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newEvent.title.trim() || !newEvent.startTime) throw new Error("Missing fields");
      const { error } = await supabase.from("user_events").insert({
        user_id: user.id,
        title: newEvent.title.trim(),
        start_time: new Date(newEvent.startTime).toISOString(),
        end_time: newEvent.endTime ? new Date(newEvent.endTime).toISOString() : null,
        event_type: newEvent.eventType as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-events"] });
      setDialogOpen(false);
      setNewEvent({ title: "", startTime: "", endTime: "", eventType: "personal" });
      toast({ title: "Event created!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-1">Unified view of all your deadlines, classes, and events</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="e.g. CS 301 Lecture" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input type="datetime-local" value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End (optional)</Label>
                  <Input type="datetime-local" value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newEvent.eventType} onValueChange={(v) => setNewEvent({ ...newEvent, eventType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lecture">Lecture</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                    <SelectItem value="office_hours">Office Hours</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="study">Study</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createEventMutation.mutate()}
                disabled={createEventMutation.isPending || !newEvent.title.trim() || !newEvent.startTime}
              >
                {createEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Event
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl font-semibold text-foreground min-w-[180px] text-center">{monthNames[month]} {year}</h2>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
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
            {eventsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-7 gap-px">
                {dayLabels.map((d) => (
                  <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                  const dayItems = day ? itemsByDate.get(day) || [] : [];
                  return (
                    <div
                      key={i}
                      className={`min-h-[80px] p-1 border border-border rounded-sm ${
                        day && isToday(day) ? "bg-primary/10 border-primary" : day ? "hover:bg-muted/50" : ""
                      }`}
                    >
                      {day && (
                        <>
                          <span className={`text-xs font-medium ${isToday(day) ? "text-primary" : "text-foreground"}`}>{day}</span>
                          <div className="mt-0.5 space-y-0.5">
                            {dayItems.slice(0, 3).map((item, j) => (
                              <div
                                key={j}
                                className="text-[10px] rounded px-1 truncate text-white"
                                style={{ backgroundColor: item.color.startsWith("bg-") ? undefined : item.color }}
                                // For Tailwind bg classes we use a div approach
                              >
                                <span
                                  className={`${item.color.startsWith("bg-") ? item.color + " text-white" : ""} block rounded px-0.5`}
                                  style={!item.color.startsWith("bg-") ? { backgroundColor: item.color, color: "white" } : undefined}
                                >
                                  {item.title}
                                </span>
                              </div>
                            ))}
                            {dayItems.length > 3 && (
                              <p className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3} more</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
              ) : (
                todayItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div
                      className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${item.color.startsWith("bg-") ? item.color : ""}`}
                      style={!item.color.startsWith("bg-") ? { backgroundColor: item.color } : undefined}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.time} · <span className="capitalize">{item.type.replace("_", " ")}</span></p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Upcoming Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming deadlines this month.</p>
                ) : (
                  upcomingAssignments.map((ua: any, i: number) => {
                    const a = ua.assignment;
                    const daysLeft = Math.ceil((new Date(a.due_date).getTime() - today.getTime()) / 86400000);
                    return (
                      <div key={i} className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-xs font-medium text-primary">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.course?.name} · Due in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
