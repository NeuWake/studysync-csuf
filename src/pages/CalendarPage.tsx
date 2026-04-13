import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Plus, Loader2, MoreHorizontal, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import EventDialog from "@/components/calendar/EventDialog";

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

async function uploadEventImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("event-images").upload(path, file);
  if (error) throw error;
  // Store the storage path, not a public URL (bucket is now private)
  return path;
}

async function getSignedImageUrl(path: string): Promise<string | null> {
  if (!path) return null;
  // If it's already a full URL (legacy), return as-is
  if (path.startsWith("http")) return path;
  const { data, error } = await supabase.storage.from("event-images").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const navigate = (dir: number) => setCurrentDate(new Date(year, month + dir, 1));

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
      // Resolve signed URLs for event images
      const resolved = await Promise.all(
        (data || []).map(async (e: any) => {
          if (e.image_url) {
            const signedUrl = await getSignedImageUrl(e.image_url);
            return { ...e, image_url_signed: signedUrl };
          }
          return e;
        })
      );
      return resolved;
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
      return (data || []).filter((ua: any) => {
        const due = ua.assignment?.due_date;
        return due && due >= start && due <= end;
      });
    },
    enabled: !!user,
  });

  // Combine events and assignments into calendar items
  const calendarItems = useMemo(() => {
    const items: { date: number; title: string; color: string; type: string; time: string; eventId?: string; raw?: any }[] = [];

    events.forEach((e: any) => {
      const d = new Date(e.start_time);
      if (d.getMonth() === month && d.getFullYear() === year) {
        items.push({
          date: d.getDate(),
          title: e.title,
          color: e.color || (e.course as any)?.color || eventTypeColors[e.event_type] || "bg-primary",
          type: e.event_type || "personal",
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          eventId: e.id,
          raw: e,
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

  const itemsByDate = useMemo(() => {
    const map = new Map<number, typeof calendarItems>();
    calendarItems.forEach((item) => {
      const arr = map.get(item.date) || [];
      arr.push(item);
      map.set(item.date, arr);
    });
    return map;
  }, [calendarItems]);

  const todayItems = useMemo(() => {
    if (today.getMonth() !== month || today.getFullYear() !== year) return [];
    return itemsByDate.get(today.getDate()) || [];
  }, [itemsByDate, today, month, year]);

  const upcomingAssignments = useMemo(() => {
    return assignments
      .filter((ua: any) => {
        const due = ua.assignment?.due_date;
        return due && new Date(due) > today;
      })
      .sort((a: any, b: any) => new Date(a.assignment.due_date).getTime() - new Date(b.assignment.due_date).getTime())
      .slice(0, 3);
  }, [assignments, today]);

  // Create event
  const handleCreate = async (data: any, imageFile: File | null) => {
    if (!user) return;
    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await uploadEventImage(user.id, imageFile);
    }
    const { error } = await supabase.from("user_events").insert({
      user_id: user.id,
      title: data.title.trim(),
      start_time: new Date(data.startTime).toISOString(),
      end_time: data.endTime ? new Date(data.endTime).toISOString() : null,
      event_type: data.eventType as any,
      image_url: imageUrl,
    } as any);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["user-events"] });
    setCreateOpen(false);
    toast({ title: "Event created!" });
  };

  // Edit event
  const handleEdit = async (data: any, imageFile: File | null) => {
    if (!user || !selectedEvent) return;
    let imageUrl = data.imageUrl || null;
    if (imageFile) {
      imageUrl = await uploadEventImage(user.id, imageFile);
    }
    const { error } = await supabase
      .from("user_events")
      .update({
        title: data.title.trim(),
        start_time: new Date(data.startTime).toISOString(),
        end_time: data.endTime ? new Date(data.endTime).toISOString() : null,
        event_type: data.eventType as any,
        image_url: imageUrl,
      } as any)
      .eq("id", selectedEvent.id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["user-events"] });
    setEditOpen(false);
    setSelectedEvent(null);
    toast({ title: "Event updated!" });
  };

  // Delete event
  const handleDelete = async () => {
    if (!selectedEvent) return;
    const { error } = await supabase.from("user_events").delete().eq("id", selectedEvent.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["user-events"] });
    setDeleteOpen(false);
    setSelectedEvent(null);
    toast({ title: "Event deleted" });
  };

  const openEdit = (event: any) => {
    setSelectedEvent(event);
    setEditOpen(true);
  };

  const openDelete = (event: any) => {
    setSelectedEvent(event);
    setDeleteOpen(true);
  };

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

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
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add Event
        </Button>
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
                                className={`text-[10px] rounded px-1 truncate text-white ${item.eventId ? "cursor-pointer" : ""}`}
                                onClick={(e) => {
                                  if (item.eventId && item.raw) {
                                    e.stopPropagation();
                                    openEdit(item.raw);
                                  }
                                }}
                              >
                                <span
                                  className={`${item.color.startsWith("bg-") ? item.color + " text-white" : ""} block rounded px-0.5 flex items-center gap-0.5`}
                                  style={!item.color.startsWith("bg-") ? { backgroundColor: item.color, color: "white" } : undefined}
                                >
                                  {item.raw?.image_url && <ImageIcon className="h-2 w-2 shrink-0" />}
                                  <span className="truncate">{item.title}</span>
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
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 group">
                    <div
                      className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${item.color.startsWith("bg-") ? item.color : ""}`}
                      style={!item.color.startsWith("bg-") ? { backgroundColor: item.color } : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.time} · <span className="capitalize">{item.type.replace("_", " ")}</span></p>
                      {item.raw?.image_url_signed && (
                        <img src={item.raw.image_url_signed} alt="" className="mt-1 rounded h-12 w-20 object-cover" />
                      )}
                    </div>
                    {item.eventId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(item.raw)}>
                            <Pencil className="h-3 w-3 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDelete(item.raw)} className="text-destructive">
                            <Trash2 className="h-3 w-3 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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

      {/* Create Event Dialog */}
      <EventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        mode="create"
      />

      {/* Edit Event Dialog */}
      {selectedEvent && (
        <EventDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={handleEdit}
          onDelete={() => {
            setEditOpen(false);
            openDelete(selectedEvent);
          }}
          mode="edit"
          initialData={{
            title: selectedEvent.title,
            startTime: toLocalDatetime(selectedEvent.start_time),
            endTime: selectedEvent.end_time ? toLocalDatetime(selectedEvent.end_time) : "",
            eventType: selectedEvent.event_type || "personal",
            imageUrl: selectedEvent.image_url || "",
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedEvent?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
