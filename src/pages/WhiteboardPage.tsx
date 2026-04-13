import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Plus, Users, Loader2, Pencil, Square, Circle, Minus, Eraser, Trash2, StickyNote, Undo2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Tool = "pen" | "rectangle" | "circle" | "line" | "eraser";

interface Stroke {
  id?: string;
  tool: Tool;
  points: number[][];
  color: string;
  strokeWidth: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const toolIcons: Record<Tool, React.ElementType> = {
  pen: Pencil,
  rectangle: Square,
  circle: Circle,
  line: Minus,
  eraser: Eraser,
};

const colors = ["#000000", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#FFFFFF"];

const noteColorValues = ["#FEF3C7", "#DBEAFE", "#D1FAE5", "#FCE7F3", "#EDE9FE"];
const noteColorClasses: Record<string, string> = {
  "#FEF3C7": "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  "#DBEAFE": "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  "#D1FAE5": "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  "#FCE7F3": "bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700",
  "#EDE9FE": "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
};

export default function WhiteboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  // Drawing state
  const [activeTool, setActiveTool] = useState<Tool>("pen");
  const [activeColor, setActiveColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);

  // Sticky notes
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch boards
  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["whiteboards", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: memberships } = await supabase
        .from("whiteboard_members")
        .select("whiteboard_id")
        .eq("user_id", user.id);
      if (!memberships?.length) return [];
      const ids = memberships.map((m) => m.whiteboard_id);
      const { data, error } = await supabase
        .from("whiteboards")
        .select("*, whiteboard_members(user_id)")
        .in("id", ids);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch strokes for selected board
  const { data: dbStrokes = [], isLoading: strokesLoading } = useQuery({
    queryKey: ["whiteboard-strokes", selectedBoard],
    queryFn: async () => {
      if (!selectedBoard) return [];
      const { data, error } = await supabase
        .from("whiteboard_strokes")
        .select("*")
        .eq("whiteboard_id", selectedBoard)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        tool: s.tool as Tool,
        points: (s.points as number[][]) || [],
        color: s.color || "#000000",
        strokeWidth: s.stroke_width || 2,
        startX: Number(s.start_x) || 0,
        startY: Number(s.start_y) || 0,
        endX: Number(s.end_x) || 0,
        endY: Number(s.end_y) || 0,
      }));
    },
    enabled: !!selectedBoard,
  });

  // Fetch sticky notes
  const { data: notes = [] } = useQuery({
    queryKey: ["whiteboard-notes", selectedBoard],
    queryFn: async () => {
      if (!selectedBoard) return [];
      const { data, error } = await supabase
        .from("whiteboard_notes")
        .select("*")
        .eq("whiteboard_id", selectedBoard)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const userIds = [...new Set((data || []).map((n) => n.user_id))];
      if (!userIds.length) return data || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
      return (data || []).map((n) => ({ ...n, author_name: profileMap.get(n.user_id) || "Unknown" }));
    },
    enabled: !!selectedBoard,
  });

  // Sync local strokes with DB strokes
  const dbStrokesJson = JSON.stringify(dbStrokes);
  useEffect(() => {
    setLocalStrokes(JSON.parse(dbStrokesJson));
  }, [dbStrokesJson]);

  // Realtime for strokes and notes
  useEffect(() => {
    if (!selectedBoard) return;
    const channel: RealtimeChannel = supabase
      .channel(`wb:${selectedBoard}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whiteboard_strokes", filter: `whiteboard_id=eq.${selectedBoard}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["whiteboard-strokes", selectedBoard] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whiteboard_notes", filter: `whiteboard_id=eq.${selectedBoard}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["whiteboard-notes", selectedBoard] });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [selectedBoard, queryClient]);

  // --- Canvas rendering ---
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    ctx.strokeStyle = stroke.tool === "eraser" ? "#FFFFFF" : stroke.color;
    ctx.lineWidth = stroke.tool === "eraser" ? stroke.strokeWidth * 3 : stroke.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "pen" || stroke.tool === "eraser") {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
      }
      ctx.stroke();
    } else if (stroke.tool === "line") {
      ctx.beginPath();
      ctx.moveTo(stroke.startX, stroke.startY);
      ctx.lineTo(stroke.endX, stroke.endY);
      ctx.stroke();
    } else if (stroke.tool === "rectangle") {
      ctx.beginPath();
      ctx.strokeRect(stroke.startX, stroke.startY, stroke.endX - stroke.startX, stroke.endY - stroke.startY);
    } else if (stroke.tool === "circle") {
      const rx = Math.abs(stroke.endX - stroke.startX) / 2;
      const ry = Math.abs(stroke.endY - stroke.startY) / 2;
      const cx = stroke.startX + (stroke.endX - stroke.startX) / 2;
      const cy = stroke.startY + (stroke.endY - stroke.startY) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    localStrokes.forEach((s) => drawStroke(ctx, s));
    if (currentStroke) drawStroke(ctx, currentStroke);
  }, [localStrokes, currentStroke, drawStroke]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [selectedBoard, redrawCanvas]);

  // --- Drawing handlers ---
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const [x, y] = getPos(e);
    setIsDrawing(true);
    if (activeTool === "pen" || activeTool === "eraser") {
      setCurrentStroke({ tool: activeTool, points: [[x, y]], color: activeColor, strokeWidth, startX: 0, startY: 0, endX: 0, endY: 0 });
    } else {
      setCurrentStroke({ tool: activeTool, points: [], color: activeColor, strokeWidth, startX: x, startY: y, endX: x, endY: y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke) return;
    const [x, y] = getPos(e);
    if (currentStroke.tool === "pen" || currentStroke.tool === "eraser") {
      setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, [x, y]] });
    } else {
      setCurrentStroke({ ...currentStroke, endX: x, endY: y });
    }
  };

  const handleMouseUp = async () => {
    if (!isDrawing || !currentStroke || !user || !selectedBoard) {
      setIsDrawing(false);
      setCurrentStroke(null);
      return;
    }
    setIsDrawing(false);

    const finished = { ...currentStroke };
    setLocalStrokes((prev) => [...prev, finished]);
    setCurrentStroke(null);

    // Persist to DB
    await supabase.from("whiteboard_strokes").insert({
      whiteboard_id: selectedBoard,
      user_id: user.id,
      tool: finished.tool,
      points: finished.points as any,
      color: finished.color,
      stroke_width: finished.strokeWidth,
      start_x: finished.startX,
      start_y: finished.startY,
      end_x: finished.endX,
      end_y: finished.endY,
    });
  };

  // Clear board (delete all user's strokes)
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedBoard) return;
      await supabase.from("whiteboard_strokes").delete().eq("whiteboard_id", selectedBoard).eq("user_id", user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whiteboard-strokes", selectedBoard] });
    },
  });

  // Undo last stroke
  const undoMutation = useMutation({
    mutationFn: async () => {
      if (!user || !localStrokes.length) return;
      const myStrokes = localStrokes.filter((s) => s.id);
      // Find last stroke by this user in DB
      const { data } = await supabase
        .from("whiteboard_strokes")
        .select("id")
        .eq("whiteboard_id", selectedBoard!)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) {
        await supabase.from("whiteboard_strokes").delete().eq("id", data[0].id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whiteboard-strokes", selectedBoard] });
    },
  });

  // Create board
  const createBoardMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newBoardName.trim()) throw new Error("Missing data");
      const { data: board, error } = await supabase
        .from("whiteboards")
        .insert({ name: newBoardName.trim(), created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;
      const { error: memErr } = await supabase
        .from("whiteboard_members")
        .insert({ whiteboard_id: board.id, user_id: user.id });
      if (memErr) throw memErr;
      return board;
    },
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["whiteboards"] });
      setSelectedBoard(board.id);
      setNewBoardName("");
      setBoardDialogOpen(false);
      toast({ title: "Board created!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Add sticky note
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedBoard || !newNote.trim()) throw new Error("Missing data");
      const color = noteColorValues[Math.floor(Math.random() * noteColorValues.length)];
      const { error } = await supabase.from("whiteboard_notes").insert({
        whiteboard_id: selectedBoard,
        user_id: user.id,
        content: newNote.trim(),
        color,
      });
      if (error) throw error;
    },
    onSuccess: () => setNewNote(""),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("whiteboard_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
  });

  const selectedBoardData = boards.find((b: any) => b.id === selectedBoard);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Whiteboard</h1>
          <p className="text-muted-foreground mt-1">Sketch, draw, and collaborate in real-time</p>
        </div>
        <Dialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Board</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Whiteboard</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Board Name</Label>
                <Input placeholder="e.g. PHYS 201 Study Session" value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => createBoardMutation.mutate()} disabled={createBoardMutation.isPending || !newBoardName.trim()}>
                {createBoardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Board
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Board selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {boardsLoading ? (
          <div className="flex justify-center py-4 w-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No boards yet. Create one to get started!</p>
        ) : (
          boards.map((board: any) => (
            <button
              key={board.id}
              onClick={() => setSelectedBoard(board.id)}
              className={`flex-shrink-0 p-3 rounded-lg border transition-colors ${
                selectedBoard === board.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
              }`}
            >
              <p className="text-sm font-medium text-foreground">{board.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{board.whiteboard_members?.length || 0}/{board.max_users || 5}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedBoard ? (
        <div className="space-y-2">
          {/* Toolbar */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Tools */}
                <div className="flex items-center gap-1 border-r border-border pr-4">
                  {(Object.keys(toolIcons) as Tool[]).map((tool) => {
                    const Icon = toolIcons[tool];
                    return (
                      <Button
                        key={tool}
                        variant={activeTool === tool ? "default" : "ghost"}
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setActiveTool(tool)}
                        title={tool.charAt(0).toUpperCase() + tool.slice(1)}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    );
                  })}
                </div>

                {/* Colors */}
                <div className="flex items-center gap-1 border-r border-border pr-4">
                  {colors.map((c) => (
                    <button
                      key={c}
                      className={`h-7 w-7 rounded-full border-2 transition-transform ${activeColor === c ? "border-primary scale-110" : "border-border"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setActiveColor(c)}
                    />
                  ))}
                </div>

                {/* Stroke width */}
                <div className="flex items-center gap-2 border-r border-border pr-4 min-w-[120px]">
                  <span className="text-xs text-muted-foreground">Size</span>
                  <Slider
                    value={[strokeWidth]}
                    onValueChange={(v) => setStrokeWidth(v[0])}
                    min={1}
                    max={20}
                    step={1}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground w-4">{strokeWidth}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => undoMutation.mutate()} title="Undo">
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => clearMutation.mutate()} title="Clear my strokes">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={showNotes ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setShowNotes(!showNotes)}
                    title="Sticky notes"
                  >
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </div>

                {/* Board info */}
                <div className="ml-auto">
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {selectedBoardData?.whiteboard_members?.length || 0} members
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            {/* Canvas */}
            <Card className="flex-1">
              <CardContent className="p-0">
                <div
                  ref={containerRef}
                  className="relative w-full bg-white rounded-lg overflow-hidden"
                  style={{ height: "calc(100vh - 320px)", minHeight: "400px" }}
                >
                  {strokesLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <canvas
                      ref={canvasRef}
                      className={`w-full h-full ${
                        activeTool === "eraser" ? "cursor-cell" : "cursor-crosshair"
                      }`}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sticky notes sidebar */}
            {showNotes && (
              <Card className="w-72 shrink-0 flex flex-col" style={{ maxHeight: "calc(100vh - 320px)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sticky Notes</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto space-y-2 pb-2">
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No notes yet</p>
                  ) : (
                    notes.map((note: any) => {
                      const colorClass = noteColorClasses[note.color] || noteColorClasses["#FEF3C7"];
                      return (
                        <div key={note.id} className={`p-3 rounded-lg border ${colorClass} relative group`}>
                          <p className="text-xs text-foreground whitespace-pre-line">{note.content}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground">{note.author_name}</span>
                            {note.user_id === user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
                <div className="p-3 border-t border-border">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                    className="text-xs mb-2"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => addNoteMutation.mutate()}
                    disabled={addNoteMutation.isPending || !newNote.trim()}
                  >
                    Add Note
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Pencil className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Select a board or create a new one</p>
            <p className="text-sm">to start drawing and collaborating</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
