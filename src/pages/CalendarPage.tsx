import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Plus, Loader2, MoreHorizontal, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  return path;
}

async function getSignedImageUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data, error } = await supabase.storage.from("event-images").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
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

  // Compute date range based on view
  const range = useMemo(() => {
    if (view === "month") {
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59),
      };
    }
    if (view === "week") {
      const s = startOfWeek(currentDate);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    const s = new Date(currentDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(currentDate);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }, [view, currentDate, year, month]);

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const headerLabel = useMemo(() => {
    if (view === "month") return `${monthNames[month]} ${year}`;
    if (view === "week") {
      const s = range.start;
      const e = range.end;
      return `${monthNames[s.getMonth()].slice(0, 3)} ${s.getDate()} – ${monthNames[e.getMonth()].slice(0, 3)} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return currentDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [view, currentDate, month, year, range]);

  // Fetch events for the visible range
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["user-events", user?.id, range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_events")
        .select("*, course:courses(name, color)")
        .eq("user_id", user.id)
        .gte("start_time", range.start.toISOString())
        .lte("start_time", range.end.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
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

  const { data: assignments = [] } = useQuery({
    queryKey: ["calendar-assignments", user?.id, range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_assignments")
        .select("id, status, assignment:assignments(id, title, due_date, course:courses(name, color))")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).filter((ua: any) => {
        const due = ua.assignment?.due_date;
        return due && due >= range.start.toISOString() && due <= range.end.toISOString();
      });
    },
    enabled: !!user,
  });

  type Item = { dateKey: string; date: Date; title: string; color: string; type: string; time: string; eventId?: string; raw?: any };
  const items = useMemo<Item[]>(() => {
    const arr: Item[] = [];
    events.forEach((e: any) => {
      const d = new Date(e.start_time);
      arr.push({
        dateKey: d.toDateString(),
        date: d,
        title: e.title,
        color: e.color || (e.course as any)?.color || eventTypeColors[e.event_type] || "bg-primary",
        type: e.event_type || "personal",
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        eventId: e.id,
        raw: e,
      });
    });
    assignments.forEach((ua: any) => {
      const a = ua.assignment;
      if (!a?.due_date) return;
      const d = new Date(a.due_date);
      arr.push({
        dateKey: d.toDateString(),
        date: d,
        title: a.title,
        color: (a.course as any)?.color || "bg-blue-500",
        type: "assignment",
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    });
    return arr;
  }, [events, assignments]);

  const itemsByDateKey = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach((it) => {
      const a = map.get(it.dateKey) || [];
      a.push(it);
      map.set(it.dateKey, a);
    });
    return map;
  }, [items]);

  const todayItems = useMemo(() => itemsByDateKey.get(today.toDateString()) || [], [itemsByDateKey, today]);

  const upcomingAssignments = useMemo(() => {
    return assignments
      .filter((ua: any) => {
        const due = ua.assignment?.due_date;
        return due && new Date(due) > today;
      })
      .sort((a: any, b: any) => new Date(a.assignment.due_date).getTime() - new Date(b.assignment.due_date).getTime())
      .slice(0, 3);
  }, [assignments, today]);

  const handleCreate = async (data: any, imageFile: File | null) => {
    if (!user) return;
    let imageUrl: string | null = null;
    if (imageFile) imageUrl = await uploadEventImage(user.id, imageFile);
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

  const handleEdit = async (data: any, imageFile: File | null) => {
    if (!user || !selectedEvent) return;
    let imageUrl = data.imageUrl || null;
    if (imageFile) imageUrl = await uploadEventImage(user.id, imageFile);
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

  const openEdit = (event: any) => { setSelectedEvent(event); setEditOpen(true); };
  const openDelete = (event: any) => { setSelectedEvent(event); setDeleteOpen(true); };

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ----- Month grid -----
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthCells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) monthCells.push(null);
  for (let i = 1; i <= daysInMonth; i++) monthCells.push(new Date(year, month, i));
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  // ----- Week / Day shared (hourly grid) -----
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekDays = useMemo(() => {
    const s = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const renderEventChip = (item: Item, j: number) => (
    <div
      key={j}
      className={item.eventId ? "cursor-pointer" : ""}
      onClick={(e) => {
        if (item.eventId && item.raw) {
          e.stopPropagation();
          openEdit(item.raw);
        }
      }}
    >
      <span
        className={`${item.color.startsWith("bg-") ? item.color + " text-white" : ""} block rounded px-1 py-0.5 text-[11px] flex items-center gap-1`}
        style={!item.color.startsWith("bg-") ? { backgroundColor: item.color, color: "white" } : undefined}
      >
        {item.raw?.image_url && <ImageIcon className="h-2.5 w-2.5 shrink-0" />}
        <span className="truncate">{item.time} {item.title}</span>
      </span>
    </div>
  );

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

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl font-semibold text-foreground min-w-[220px] text-center">{headerLabel}</h2>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
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
            ) : view === "month" ? (
              <div className="grid grid-cols-7 gap-px">
                {dayLabels.map((d) => (
                  <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">{d}</div>
                ))}
                {monthCells.map((d, i) => {
                  const dayItems = d ? itemsByDateKey.get(d.toDateString()) || [] : [];
                  const isTodayCell = d && isSameDay(d, today);
                  return (
                    <div
                      key={i}
                      className={`min-h-[80px] p-1 border border-border rounded-sm ${
                        isTodayCell ? "bg-primary/10 border-primary" : d ? "hover:bg-muted/50" : ""
                      }`}
                    >
                      {d && (
                        <>
                          <span className={`text-xs font-medium ${isTodayCell ? "text-primary" : "text-foreground"}`}>{d.getDate()}</span>
                          <div className="mt-0.5 space-y-0.5">
                            {dayItems.slice(0, 3).map((item, j) => (
                              <div
                                key={j}
                                className={`text-[10px] rounded px-1 truncate ${item.eventId ? "cursor-pointer" : ""}`}
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
            ) : view === "week" ? (
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
                    <div />
                    {weekDays.map((d) => {
                      const isTodayCell = isSameDay(d, today);
                      return (
                        <div
                          key={d.toISOString()}
                          className={`p-2 text-center cursor-pointer ${isTodayCell ? "text-primary font-semibold" : "text-foreground"}`}
                          onClick={() => { setCurrentDate(d); setView("day"); }}
                        >
                          <div className="text-xs uppercase text-muted-foreground">{dayLabels[d.getDay()]}</div>
                          <div className="text-lg">{d.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[600px] overflow-y-auto">
                    {hours.map((h) => (
                      <>
                        <div key={`h-${h}`} className="text-xs text-muted-foreground p-1 border-r border-border text-right pr-2 h-14">
                          {h.toString().padStart(2, "0")}:00
                        </div>
                        {weekDays.map((d) => {
                          const dayItems = (itemsByDateKey.get(d.toDateString()) || []).filter((it) => it.date.getHours() === h);
                          return (
                            <div key={`${d.toISOString()}-${h}`} className="border-b border-r border-border h-14 p-0.5 space-y-0.5 hover:bg-muted/30">
                              {dayItems.map((it, j) => renderEventChip(it, j))}
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Day view
              <div className="grid grid-cols-[60px_1fr] max-h-[700px] overflow-y-auto">
                {hours.map((h) => {
                  const dayItems = (itemsByDateKey.get(currentDate.toDateString()) || []).filter((it) => it.date.getHours() === h);
                  return (
                    <>
                      <div key={`dh-${h}`} className="text-xs text-muted-foreground p-1 border-r border-border text-right pr-2 h-16">
                        {h.toString().padStart(2, "0")}:00
                      </div>
                      <div key={`dc-${h}`} className="border-b border-border h-16 p-1 space-y-0.5 hover:bg-muted/30">
                        {dayItems.map((it, j) => renderEventChip(it, j))}
                      </div>
                    </>
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
                  <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
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

      <EventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        mode="create"
      />

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
            imageUrl: selectedEvent.image_url_signed || selectedEvent.image_url || "",
          }}
        />
      )}

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
