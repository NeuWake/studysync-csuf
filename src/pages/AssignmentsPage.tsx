import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, RefreshCw, Clock, CheckCircle, AlertTriangle, Circle, Loader2, Trash2, BookOpen, ChevronDown, Paperclip } from "lucide-react";
import { AssignmentDocumentsDialog } from "@/components/AssignmentDocumentsDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Status = "pending" | "in-progress" | "completed" | "missed";


const statusConfig: Record<Status, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", icon: Circle, variant: "outline" },
  "in-progress": { label: "In Progress", icon: Clock, variant: "secondary" },
  completed: { label: "Completed", icon: CheckCircle, variant: "default" },
  missed: { label: "Missed", icon: AlertTriangle, variant: "destructive" },
};

export default function AssignmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  // null = not yet loaded from server; [] = explicitly no courses; otherwise array of course names to include
  const [selectedCourses, setSelectedCourses] = useState<string[] | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", due_date: "", assignment_type: "homework" as string });

  // Load saved course filter preference
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const prefs = (data?.preferences as any) || {};
        const saved = Array.isArray(prefs.assignmentCourseFilter) ? prefs.assignmentCourseFilter : null;
        setSelectedCourses(saved ?? []);
      });
  }, [user]);

  // Persist course filter preference (debounced)
  useEffect(() => {
    if (!user || selectedCourses === null) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      const prefs = { ...((data?.preferences as any) || {}), assignmentCourseFilter: selectedCourses };
      await supabase.from("profiles").update({ preferences: prefs }).eq("user_id", user.id);
    }, 500);
    return () => clearTimeout(t);
  }, [selectedCourses, user]);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["user-assignments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_assignments")
        .select(`
          id, status, progress, completed_at,
          assignment:assignments(id, title, description, due_date, assignment_type, canvas_assignment_id, max_points,
            course:courses(id, name, code, color)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("canvas-sync", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Canvas sync complete!", description: `Synced ${data.synced_courses} courses, ${data.synced_assignments} assignments.` });
      queryClient.invalidateQueries({ queryKey: ["user-assignments"] });
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err.message || "Check your Canvas token in Profile settings.", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, currentProgress }: { id: string; status: Status; currentProgress?: number }) => {
      const update: any = { status };
      if (status === "completed") {
        update.progress = 100;
        update.completed_at = new Date().toISOString();
      } else if (status === "missed") {
        update.completed_at = null;
      } else {
        // Preserve existing progress for pending/in-progress
        update.completed_at = null;
        if (status === "in-progress" && (currentProgress === undefined || currentProgress === 0)) {
          update.progress = 10;
        }
      }
      const { error } = await supabase.from("user_assignments").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["stats-user-assignments"] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const update: any = { progress };
      if (progress === 100) {
        update.status = "completed";
        update.completed_at = new Date().toISOString();
      } else if (progress > 0) {
        update.status = "in-progress";
        update.completed_at = null;
      }
      const { error } = await supabase.from("user_assignments").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["stats-user-assignments"] });
    },
    onError: (err: any) => {
      toast({ title: "Progress update failed", description: err.message, variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data: assignment, error: aErr } = await supabase
        .from("assignments")
        .insert({
          title: newTask.title,
          description: newTask.description || null,
          due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null,
          assignment_type: newTask.assignment_type as any,
          created_by: user.id,
        })
        .select()
        .single();
      if (aErr) throw aErr;
      const { error: uaErr } = await supabase
        .from("user_assignments")
        .insert({ user_id: user.id, assignment_id: assignment.id, status: "pending", progress: 0 });
      if (uaErr) throw uaErr;
      return assignment;
    },
    onSuccess: () => {
      toast({ title: "Task created!" });
      setShowNewTask(false);
      setNewTask({ title: "", description: "", due_date: "", assignment_type: "homework" });
      queryClient.invalidateQueries({ queryKey: ["user-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["stats-user-assignments"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create task", description: err.message, variant: "destructive" });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (userAssignmentId: string) => {
      const { error } = await supabase.from("user_assignments").delete().eq("id", userAssignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Assignment removed" });
      queryClient.invalidateQueries({ queryKey: ["user-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["stats-user-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-assignments"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const courses = useMemo(
    () => [...new Set(assignments.map((a: any) => a.assignment?.course?.name).filter(Boolean))] as string[],
    [assignments]
  );

  // Empty selection means "show all" so a fresh user isn't filtered to nothing
  const courseFilterActive = (selectedCourses?.length ?? 0) > 0;

  const filtered = assignments.filter((a: any) => {
    const assign = a.assignment;
    if (!assign) return false;
    if (search && !assign.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (courseFilterActive && !selectedCourses!.includes(assign.course?.name)) return false;
    return true;
  });

  const toggleCourse = (name: string, checked: boolean) => {
    setSelectedCourses((prev) => {
      const cur = prev ?? [];
      if (checked) return cur.includes(name) ? cur : [...cur, name];
      return cur.filter((c) => c !== name);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assignments</h1>
          <p className="text-muted-foreground mt-1">Track and manage all your coursework</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Canvas
          </Button>
          <Button className="gap-2" onClick={() => setShowNewTask(true)}>
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search assignments..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-between gap-2 font-normal">
              <span className="flex items-center gap-2 truncate">
                <BookOpen className="h-4 w-4" />
                {courseFilterActive
                  ? selectedCourses!.length === 1
                    ? selectedCourses![0]
                    : `${selectedCourses!.length} courses`
                  : "All Courses"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px] max-h-[320px] overflow-y-auto">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Filter by course</span>
              {courseFilterActive && (
                <button
                  type="button"
                  onClick={() => setSelectedCourses([])}
                  className="text-xs text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {courses.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">No courses yet</div>
            ) : (
              courses.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={selectedCourses?.includes(c) ?? false}
                  onCheckedChange={(checked) => toggleCourse(c, !!checked)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No assignments found. Click "Sync Canvas" to pull your coursework, or create a manual task.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a: any) => {
            const assign = a.assignment;
            if (!assign) return null;
            const status = (a.status || "pending") as Status;
            const sc = statusConfig[status];
            const dueDate = assign.due_date ? new Date(assign.due_date).toLocaleDateString() : "No due date";
            const isCanvas = !!assign.canvas_assignment_id;

            return (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1">
                        {assign.course?.color && (
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: assign.course.color }} />
                        )}
                        <h3 className="font-medium text-foreground">{assign.title}</h3>
                        {isCanvas && <Badge variant="outline" className="text-[10px]">Canvas</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{assign.course?.name || "No course"}</span>
                        <span>•</span>
                        <span>Due {dueDate}</span>
                        <span>•</span>
                        <span className="capitalize">{assign.assignment_type}</span>
                        {assign.max_points && <><span>•</span><span>{assign.max_points} pts</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-36">
                        <Slider
                          value={[a.progress || 0]}
                          min={0}
                          max={100}
                          step={5}
                          onValueCommit={(val) => updateProgressMutation.mutate({ id: a.id, progress: val[0] })}
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-right">{a.progress || 0}%</p>
                      </div>
                      <Select value={status} onValueChange={(v) => updateStatusMutation.mutate({ id: a.id, status: v as Status, currentProgress: a.progress || 0 })}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <div className="flex items-center gap-1">
                            <sc.icon className="h-3 w-3" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(statusConfig) as [Status, typeof sc][]).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-1.5">
                                <cfg.icon className="h-3 w-3" />
                                {cfg.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove assignment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove "{assign.title}" from your tracking list. The assignment itself won't be deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAssignmentMutation.mutate(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" placeholder="e.g. Chapter 5 Reading" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="task-desc">Description (optional)</Label>
              <Textarea id="task-desc" placeholder="Details about this task..." value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="task-due">Due Date</Label>
              <Input id="task-due" type="datetime-local" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newTask.assignment_type} onValueChange={(v) => setNewTask({ ...newTask, assignment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["homework", "quiz", "project", "essay", "lab", "exam", "other"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>Cancel</Button>
            <Button onClick={() => createTaskMutation.mutate()} disabled={!newTask.title || createTaskMutation.isPending}>
              {createTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
