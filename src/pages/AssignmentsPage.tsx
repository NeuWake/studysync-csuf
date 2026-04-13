import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, RefreshCw, Upload, Clock, CheckCircle, AlertTriangle, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Status = "pending" | "in-progress" | "completed" | "missed";

interface Assignment {
  id: number;
  title: string;
  course: string;
  dueDate: string;
  status: Status;
  type: string;
  progress: number;
  isCanvas: boolean;
}

const mockAssignments: Assignment[] = [
  { id: 1, title: "Final Project Submission", course: "CS 301", dueDate: "2025-04-15", status: "in-progress", type: "project", progress: 65, isCanvas: true },
  { id: 2, title: "Problem Set 8", course: "MATH 250", dueDate: "2025-04-16", status: "pending", type: "homework", progress: 0, isCanvas: true },
  { id: 3, title: "Analytical Essay Draft", course: "ENG 102", dueDate: "2025-04-17", status: "in-progress", type: "essay", progress: 40, isCanvas: true },
  { id: 4, title: "Lab Report #6", course: "PHYS 201", dueDate: "2025-04-19", status: "pending", type: "lab", progress: 0, isCanvas: false },
  { id: 5, title: "Chapter Review Quiz", course: "CS 301", dueDate: "2025-04-12", status: "completed", type: "quiz", progress: 100, isCanvas: true },
  { id: 6, title: "Study Group Notes", course: "MATH 250", dueDate: "2025-04-10", status: "missed", type: "homework", progress: 0, isCanvas: false },
];

const statusConfig: Record<Status, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", icon: Circle, variant: "outline" },
  "in-progress": { label: "In Progress", icon: Clock, variant: "secondary" },
  completed: { label: "Completed", icon: CheckCircle, variant: "default" },
  missed: { label: "Missed", icon: AlertTriangle, variant: "destructive" },
};

export default function AssignmentsPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");

  const filtered = mockAssignments.filter((a) => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterCourse !== "all" && a.course !== filterCourse) return false;
    return true;
  });

  const courses = [...new Set(mockAssignments.map((a) => a.course))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assignments</h1>
          <p className="text-muted-foreground mt-1">Track and manage all your coursework</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Sync Canvas
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search assignments..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Assignment list */}
      <div className="space-y-3">
        {filtered.map((a) => {
          const sc = statusConfig[a.status];
          return (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{a.title}</h3>
                      {a.isCanvas && <Badge variant="outline" className="text-[10px]">Canvas</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{a.course}</span>
                      <span>•</span>
                      <span>Due {a.dueDate}</span>
                      <span>•</span>
                      <span className="capitalize">{a.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <Progress value={a.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1 text-right">{a.progress}%</p>
                    </div>
                    <Badge variant={sc.variant} className="gap-1">
                      <sc.icon className="h-3 w-3" />
                      {sc.label}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
