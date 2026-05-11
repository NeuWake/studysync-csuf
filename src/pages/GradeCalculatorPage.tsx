import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Calculator, Target, TrendingUp, Sparkles } from "lucide-react";

type Item = {
  id: string;
  name: string;
  weight: number; // percent of course
  score?: number; // 0-100, completed only
  whatIf?: number; // 0-100 projected score for upcoming
};

type Course = {
  id: string;
  name: string;
  target: number;
  completed: Item[];
  upcoming: Item[];
};

const STORAGE_KEY = "studysync_grade_calculator_v1";

const newId = () => Math.random().toString(36).slice(2, 10);

function emptyCourse(name = "My Course"): Course {
  return {
    id: newId(),
    name,
    target: 90,
    completed: [
      { id: newId(), name: "Homework 1", weight: 10, score: 92 },
      { id: newId(), name: "Midterm", weight: 25, score: 85 },
    ],
    upcoming: [
      { id: newId(), name: "Final Exam", weight: 30 },
      { id: newId(), name: "Project", weight: 20 },
    ],
  };
}

function load(): Course[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [emptyCourse()];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}
  return [emptyCourse()];
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");

const gradeLetter = (g: number) => {
  if (!Number.isFinite(g)) return "—";
  if (g >= 93) return "A";
  if (g >= 90) return "A-";
  if (g >= 87) return "B+";
  if (g >= 83) return "B";
  if (g >= 80) return "B-";
  if (g >= 77) return "C+";
  if (g >= 73) return "C";
  if (g >= 70) return "C-";
  if (g >= 67) return "D+";
  if (g >= 63) return "D";
  if (g >= 60) return "D-";
  return "F";
};

export default function GradeCalculatorPage() {
  const [courses, setCourses] = useState<Course[]>(() => load());
  const [activeId, setActiveId] = useState<string>(() => load()[0]?.id ?? "");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  }, [courses]);

  const active = courses.find((c) => c.id === activeId) ?? courses[0];

  const updateCourse = (patch: Partial<Course>) => {
    setCourses((cs) => cs.map((c) => (c.id === active.id ? { ...c, ...patch } : c)));
  };

  const updateItem = (group: "completed" | "upcoming", id: string, patch: Partial<Item>) => {
    updateCourse({
      [group]: active[group].map((it) => (it.id === id ? { ...it, ...patch } : it)),
    } as any);
  };

  const addItem = (group: "completed" | "upcoming") => {
    const item: Item = { id: newId(), name: "", weight: 10, ...(group === "completed" ? { score: 0 } : {}) };
    updateCourse({ [group]: [...active[group], item] } as any);
  };

  const removeItem = (group: "completed" | "upcoming", id: string) => {
    updateCourse({ [group]: active[group].filter((i) => i.id !== id) } as any);
  };

  const addCourse = () => {
    const c = emptyCourse(`Course ${courses.length + 1}`);
    setCourses((cs) => [...cs, c]);
    setActiveId(c.id);
  };

  const removeCourse = () => {
    if (courses.length === 1) return;
    setCourses((cs) => cs.filter((c) => c.id !== active.id));
    const next = courses.find((c) => c.id !== active.id);
    if (next) setActiveId(next.id);
  };

  const stats = useMemo(() => {
    const completedWeight = active.completed.reduce((s, i) => s + (Number(i.weight) || 0), 0);
    const upcomingWeight = active.upcoming.reduce((s, i) => s + (Number(i.weight) || 0), 0);
    const totalWeight = completedWeight + upcomingWeight;

    const earnedPoints = active.completed.reduce(
      (s, i) => s + ((Number(i.score) || 0) / 100) * (Number(i.weight) || 0),
      0
    );

    // current grade based on completed work only (out of completed weight)
    const currentGrade = completedWeight > 0 ? (earnedPoints / completedWeight) * 100 : NaN;

    // required average on remaining to hit target (assuming totalWeight is the full course weight)
    const targetPoints = (active.target / 100) * totalWeight;
    const neededPoints = targetPoints - earnedPoints;
    const requiredAvg = upcomingWeight > 0 ? (neededPoints / upcomingWeight) * 100 : NaN;

    // what-if projected final
    const whatIfPoints = active.upcoming.reduce(
      (s, i) => s + ((Number(i.whatIf) || 0) / 100) * (Number(i.weight) || 0),
      0
    );
    const projectedFinal = totalWeight > 0 ? ((earnedPoints + whatIfPoints) / totalWeight) * 100 : NaN;

    return {
      completedWeight,
      upcomingWeight,
      totalWeight,
      currentGrade,
      requiredAvg,
      projectedFinal,
    };
  }, [active]);

  const requiredBadge = (() => {
    const r = stats.requiredAvg;
    if (!Number.isFinite(r)) return { label: "—", tone: "secondary" as const };
    if (r <= 0) return { label: "Already achieved!", tone: "success" as const };
    if (r > 100) return { label: "Not achievable", tone: "destructive" as const };
    if (r >= 90) return { label: "Tough", tone: "warning" as const };
    return { label: "Achievable", tone: "success" as const };
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-7 w-7 text-primary" /> Grade Calculator
          </h1>
          <p className="text-muted-foreground mt-1">
            Track current grades, plan upcoming work, and run what-if scenarios.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addCourse} className="gap-2">
            <Plus className="h-4 w-4" /> New Course
          </Button>
        </div>
      </div>

      {/* Course tabs */}
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              c.id === active.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 hover:bg-muted border-border"
            }`}
          >
            {c.name || "Untitled"}
          </button>
        ))}
      </div>

      {/* Course header / target */}
      <Card>
        <CardContent className="p-4 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <Label htmlFor="course-name">Course name</Label>
            <Input
              id="course-name"
              value={active.name}
              onChange={(e) => updateCourse({ name: e.target.value })}
              placeholder="e.g. CPSC 121"
            />
          </div>
          <div>
            <Label htmlFor="target">Target grade (%)</Label>
            <Input
              id="target"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={active.target}
              onChange={(e) => updateCourse({ target: Number(e.target.value) })}
              className="w-32"
            />
          </div>
          <Button variant="outline" onClick={removeCourse} disabled={courses.length === 1} className="gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Current Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{fmt(stats.currentGrade)}%</span>
              <Badge variant="outline">{gradeLetter(stats.currentGrade)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From {stats.completedWeight}% of total course weight completed
            </p>
            {Number.isFinite(stats.currentGrade) && (
              <Progress value={Math.min(100, Math.max(0, stats.currentGrade))} className="mt-3 h-2" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-secondary" /> Need on Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{fmt(stats.requiredAvg)}%</span>
              <Badge
                className={
                  requiredBadge.tone === "success"
                    ? "bg-green-500/15 text-green-600 hover:bg-green-500/15"
                    : requiredBadge.tone === "warning"
                    ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/15"
                    : requiredBadge.tone === "destructive"
                    ? "bg-destructive/15 text-destructive hover:bg-destructive/15"
                    : ""
                }
                variant="secondary"
              >
                {requiredBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average score across {stats.upcomingWeight}% of remaining weight to reach {active.target}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> What-If Final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{fmt(stats.projectedFinal)}%</span>
              <Badge variant="outline">{gradeLetter(stats.projectedFinal)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on your projected scores for upcoming work
            </p>
          </CardContent>
        </Card>
      </div>

      {stats.totalWeight !== 100 && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Total weight is {stats.totalWeight}% (typical courses sum to 100%). Calculations still use this total.
        </p>
      )}

      {/* Completed work */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Completed Work</CardTitle>
          <Button size="sm" variant="outline" onClick={() => addItem("completed")} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          <ItemTable
            items={active.completed}
            mode="completed"
            onChange={(id, patch) => updateItem("completed", id, patch)}
            onRemove={(id) => removeItem("completed", id)}
          />
          {active.completed.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No completed assignments yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Upcoming work */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Upcoming Work (What-If)</CardTitle>
          <Button size="sm" variant="outline" onClick={() => addItem("upcoming")} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          <ItemTable
            items={active.upcoming}
            mode="upcoming"
            onChange={(id, patch) => updateItem("upcoming", id, patch)}
            onRemove={(id) => removeItem("upcoming", id)}
            requiredAvg={stats.requiredAvg}
          />
          {active.upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No upcoming assignments yet.</p>
          )}
          {active.upcoming.length > 0 && Number.isFinite(stats.requiredAvg) && (
            <>
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground">
                Tip: click <span className="font-medium">Fill required</span> to populate the projected scores
                with the average required to hit your target.
                <Button
                  variant="link"
                  size="sm"
                  className="px-1 h-auto"
                  onClick={() =>
                    updateCourse({
                      upcoming: active.upcoming.map((i) => ({
                        ...i,
                        whatIf: Math.max(0, Math.min(100, Number(stats.requiredAvg.toFixed(2)))),
                      })),
                    })
                  }
                >
                  Fill required
                </Button>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemTable({
  items,
  mode,
  onChange,
  onRemove,
  requiredAvg,
}: {
  items: Item[];
  mode: "completed" | "upcoming";
  onChange: (id: string, patch: Partial<Item>) => void;
  onRemove: (id: string) => void;
  requiredAvg?: number;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="hidden md:grid grid-cols-[1fr_120px_120px_40px] gap-2 px-2 text-xs text-muted-foreground">
        <span>Name</span>
        <span>Weight (%)</span>
        <span>{mode === "completed" ? "Score (%)" : "What-If (%)"}</span>
        <span></span>
      </div>
      {items.map((it) => (
        <div
          key={it.id}
          className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_40px] gap-2 items-center"
        >
          <Input
            placeholder={mode === "completed" ? "e.g. Homework 1" : "e.g. Final Exam"}
            value={it.name}
            onChange={(e) => onChange(it.id, { name: e.target.value })}
          />
          <Input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={it.weight}
            onChange={(e) => onChange(it.id, { weight: Number(e.target.value) })}
          />
          {mode === "completed" ? (
            <Input
              type="number"
              min={0}
              max={150}
              step="0.5"
              value={it.score ?? 0}
              onChange={(e) => onChange(it.id, { score: Number(e.target.value) })}
            />
          ) : (
            <Input
              type="number"
              min={0}
              max={150}
              step="0.5"
              placeholder={Number.isFinite(requiredAvg ?? NaN) ? String(requiredAvg!.toFixed(1)) : "—"}
              value={it.whatIf ?? ""}
              onChange={(e) =>
                onChange(it.id, {
                  whatIf: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(it.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
