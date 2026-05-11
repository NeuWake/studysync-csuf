import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Plus, Users, Loader2, Pencil, Square, Circle, Minus, Eraser, Trash2, StickyNote, Undo2, Type, MousePointer2, Triangle, Diamond, ArrowRight, Star, Hexagon, PaintBucket, UserPlus, Hand, ZoomIn, ZoomOut, Maximize2, Minimize2, Download } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { RealtimeChannel } from "@supabase/supabase-js";
import WhiteboardMembersDialog from "@/components/whiteboard/WhiteboardMembersDialog";

type Tool = "select" | "pen" | "rectangle" | "circle" | "line" | "eraser" | "text" | "triangle" | "diamond" | "arrow" | "star" | "hexagon" | "hand";

interface Stroke {
  id?: string;
  tool: Tool;
  points: number[][];
  color: string;
  fillColor?: string | null;
  strokeWidth: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  text?: string;
}

const toolIcons: Record<Tool, React.ElementType> = {
  select: MousePointer2,
  hand: Hand,
  pen: Pencil,
  line: Minus,
  arrow: ArrowRight,
  rectangle: Square,
  circle: Circle,
  triangle: Triangle,
  diamond: Diamond,
  hexagon: Hexagon,
  star: Star,
  eraser: Eraser,
  text: Type,
};

const fillColors = ["transparent", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#FFFFFF", "#000000"];
const colors = ["#000000", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#FFFFFF"];
const noteColorValues = ["#FEF3C7", "#DBEAFE", "#D1FAE5", "#FCE7F3", "#EDE9FE"];
const noteColorClasses: Record<string, string> = {
  "#FEF3C7": "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  "#DBEAFE": "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  "#D1FAE5": "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  "#FCE7F3": "bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700",
  "#EDE9FE": "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const MAX_EXPORT_BYTES = 20 * 1024 * 1024; // 20MB

function hitTestStroke(stroke: Stroke, px: number, py: number, threshold = 8): boolean {
  if (stroke.tool === "pen" || stroke.tool === "eraser") {
    for (const [sx, sy] of stroke.points) {
      if (Math.hypot(px - sx, py - sy) < threshold) return true;
    }
    return false;
  }
  if (stroke.tool === "line" || stroke.tool === "arrow") {
    return distToSegment(px, py, stroke.startX, stroke.startY, stroke.endX, stroke.endY) < threshold;
  }
  if (stroke.tool === "text" && stroke.text) {
    const w = stroke.text.length * Math.max(stroke.strokeWidth * 3, 10);
    const h = Math.max(stroke.strokeWidth * 5, 16) * 1.2;
    return px >= stroke.startX && px <= stroke.startX + w && py >= stroke.startY && py <= stroke.startY + h;
  }
  const minX = Math.min(stroke.startX, stroke.endX);
  const maxX = Math.max(stroke.startX, stroke.endX);
  const minY = Math.min(stroke.startY, stroke.endY);
  const maxY = Math.max(stroke.startY, stroke.endY);
  return px >= minX - threshold && px <= maxX + threshold && py >= minY - threshold && py <= maxY + threshold;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function getResizeHandle(stroke: Stroke, px: number, py: number, padding = 4, handleRadius = 8): string | null {
  if (stroke.tool === "pen" || stroke.tool === "eraser" || stroke.tool === "text") return null;
  const minX = Math.min(stroke.startX, stroke.endX) - padding;
  const maxX = Math.max(stroke.startX, stroke.endX) + padding;
  const minY = Math.min(stroke.startY, stroke.endY) - padding;
  const maxY = Math.max(stroke.startY, stroke.endY) + padding;
  if (Math.hypot(px - minX, py - minY) < handleRadius) return "tl";
  if (Math.hypot(px - maxX, py - minY) < handleRadius) return "tr";
  if (Math.hypot(px - minX, py - maxY) < handleRadius) return "bl";
  if (Math.hypot(px - maxX, py - maxY) < handleRadius) return "br";
  return null;
}

function getStrokesBounds(strokes: Stroke[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!strokes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    if (s.tool === "pen" || s.tool === "eraser") {
      for (const [x, y] of s.points) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    } else if (s.tool === "text" && s.text) {
      minX = Math.min(minX, s.startX);
      minY = Math.min(minY, s.startY);
      maxX = Math.max(maxX, s.startX + s.text.length * Math.max(s.strokeWidth * 3, 10));
      maxY = Math.max(maxY, s.startY + Math.max(s.strokeWidth * 5, 16) * 1.2);
    } else {
      minX = Math.min(minX, s.startX, s.endX);
      minY = Math.min(minY, s.startY, s.endY);
      maxX = Math.max(maxX, s.startX, s.endX);
      maxY = Math.max(maxY, s.startY, s.endY);
    }
  }
  return { minX: minX - 40, minY: minY - 40, maxX: maxX + 40, maxY: maxY + 40 };
}

export default function WhiteboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  // Drawing state
  const [activeTool, setActiveTool] = useState<Tool>("pen");
  const [activeColor, setActiveColor] = useState("#000000");
  const [activeFillColor, setActiveFillColor] = useState<string>("transparent");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);

  // Select tool state
  const [selectedStrokeIndex, setSelectedStrokeIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const suppressRefetchRef = useRef(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<{ fixedX: number; fixedY: number } | null>(null);

  // Pan/Zoom state (infinite canvas)
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const spaceDownRef = useRef(false);

  // Sticky notes
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState("");

  // Text tool state
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [textValue, setTextValue] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Coordinate conversion ---
  const screenToWorld = useCallback((sx: number, sy: number): [number, number] => {
    return [(sx - camera.x) / camera.scale, (sy - camera.y) / camera.scale];
  }, [camera]);

  const worldToScreen = useCallback((wx: number, wy: number): [number, number] => {
    return [wx * camera.scale + camera.x, wy * camera.scale + camera.y];
  }, [camera]);

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
        fillColor: s.fill_color || null,
        strokeWidth: s.stroke_width || 2,
        startX: Number(s.start_x) || 0,
        startY: Number(s.start_y) || 0,
        endX: Number(s.end_x) || 0,
        endY: Number(s.end_y) || 0,
        text: s.tool === "text" ? (Array.isArray(s.points) && typeof s.points[0] === "string" ? s.points[0] : "") : undefined,
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
        .from("public_profiles")
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
    if (suppressRefetchRef.current) return;
    setLocalStrokes(JSON.parse(dbStrokesJson));
    setSelectedStrokeIndex(null);
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

  // Space key for panning
  useEffect(() => {
    const isInputFocused = () => {
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || (active as HTMLElement).isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !textInput.visible && !isInputFocused()) {
        e.preventDefault();
        spaceDownRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDownRef.current = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [textInput.visible]);

  // --- Canvas rendering ---
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke, isSelected = false) => {
    ctx.strokeStyle = stroke.tool === "eraser" ? "#FFFFFF" : stroke.color;
    ctx.fillStyle = stroke.color;
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
    } else if (stroke.tool === "arrow") {
      ctx.beginPath();
      ctx.moveTo(stroke.startX, stroke.startY);
      ctx.lineTo(stroke.endX, stroke.endY);
      ctx.stroke();
      const angle = Math.atan2(stroke.endY - stroke.startY, stroke.endX - stroke.startX);
      const headLen = Math.max(stroke.strokeWidth * 4, 12);
      ctx.beginPath();
      ctx.moveTo(stroke.endX, stroke.endY);
      ctx.lineTo(stroke.endX - headLen * Math.cos(angle - Math.PI / 6), stroke.endY - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(stroke.endX, stroke.endY);
      ctx.lineTo(stroke.endX - headLen * Math.cos(angle + Math.PI / 6), stroke.endY - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (stroke.tool === "rectangle") {
      if (stroke.fillColor && stroke.fillColor !== "transparent") {
        ctx.fillStyle = stroke.fillColor;
        ctx.fillRect(stroke.startX, stroke.startY, stroke.endX - stroke.startX, stroke.endY - stroke.startY);
      }
      ctx.beginPath();
      ctx.strokeRect(stroke.startX, stroke.startY, stroke.endX - stroke.startX, stroke.endY - stroke.startY);
    } else if (stroke.tool === "circle") {
      const rx = Math.abs(stroke.endX - stroke.startX) / 2;
      const ry = Math.abs(stroke.endY - stroke.startY) / 2;
      const cx = stroke.startX + (stroke.endX - stroke.startX) / 2;
      const cy = stroke.startY + (stroke.endY - stroke.startY) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (stroke.fillColor && stroke.fillColor !== "transparent") {
        ctx.fillStyle = stroke.fillColor;
        ctx.fill();
      }
      ctx.stroke();
    } else if (stroke.tool === "triangle") {
      const midX = (stroke.startX + stroke.endX) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, stroke.startY);
      ctx.lineTo(stroke.startX, stroke.endY);
      ctx.lineTo(stroke.endX, stroke.endY);
      ctx.closePath();
      if (stroke.fillColor && stroke.fillColor !== "transparent") {
        ctx.fillStyle = stroke.fillColor;
        ctx.fill();
      }
      ctx.stroke();
    } else if (stroke.tool === "diamond") {
      const cx = (stroke.startX + stroke.endX) / 2;
      const cy = (stroke.startY + stroke.endY) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, stroke.startY);
      ctx.lineTo(stroke.endX, cy);
      ctx.lineTo(cx, stroke.endY);
      ctx.lineTo(stroke.startX, cy);
      ctx.closePath();
      if (stroke.fillColor && stroke.fillColor !== "transparent") {
        ctx.fillStyle = stroke.fillColor;
        ctx.fill();
      }
      ctx.stroke();
    } else if (stroke.tool === "hexagon") {
      const cx = (stroke.startX + stroke.endX) / 2;
      const cy = (stroke.startY + stroke.endY) / 2;
      const rx = Math.abs(stroke.endX - stroke.startX) / 2;
      const ry = Math.abs(stroke.endY - stroke.startY) / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (stroke.fillColor && stroke.fillColor !== "transparent") {
        ctx.fillStyle = stroke.fillColor;
        ctx.fill();
      }
      ctx.stroke();
    } else if (stroke.tool === "star") {
      const cx = (stroke.startX + stroke.endX) / 2;
      const cy = (stroke.startY + stroke.endY) / 2;
      const outerR = Math.max(Math.abs(stroke.endX - stroke.startX), Math.abs(stroke.endY - stroke.startY)) / 2;
      const innerR = outerR * 0.4;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (stroke.fillColor && stroke.fillColor !== "transparent") {
        ctx.fillStyle = stroke.fillColor;
        ctx.fill();
      }
      ctx.stroke();
    } else if (stroke.tool === "text" && stroke.text) {
      const fontSize = Math.max(stroke.strokeWidth * 5, 16);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = stroke.color;
      ctx.textBaseline = "top";
      ctx.fillText(stroke.text, stroke.startX, stroke.startY);
    }

    // Draw selection indicator
    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = "#3B82F6";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      let bx: number, by: number, bw: number, bh: number;
      if (stroke.tool === "pen" || stroke.tool === "eraser") {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [sx, sy] of stroke.points) {
          minX = Math.min(minX, sx); minY = Math.min(minY, sy);
          maxX = Math.max(maxX, sx); maxY = Math.max(maxY, sy);
        }
        bx = minX - 4; by = minY - 4; bw = maxX - minX + 8; bh = maxY - minY + 8;
      } else {
        bx = Math.min(stroke.startX, stroke.endX) - 4;
        by = Math.min(stroke.startY, stroke.endY) - 4;
        bw = Math.abs(stroke.endX - stroke.startX) + 8;
        bh = Math.abs(stroke.endY - stroke.startY) + 8;
      }
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#3B82F6";
      ctx.lineWidth = 2;
      const handleSize = 8;
      const corners = [
        [bx, by], [bx + bw, by],
        [bx, by + bh], [bx + bw, by + bh],
      ];
      for (const [cx, cy] of corners) {
        ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
      }
      ctx.restore();
    }
  }, []);

  // Draw infinite dot grid
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 30;
    const dotRadius = 1;

    // World coords of canvas corners
    const [wx0, wy0] = [(0 - camera.x) / camera.scale, (0 - camera.y) / camera.scale];
    const [wx1, wy1] = [(width - camera.x) / camera.scale, (height - camera.y) / camera.scale];

    const startX = Math.floor(wx0 / gridSize) * gridSize;
    const startY = Math.floor(wy0 / gridSize) * gridSize;

    ctx.fillStyle = "#d4d4d8";
    for (let wx = startX; wx <= wx1; wx += gridSize) {
      for (let wy = startY; wy <= wy1; wy += gridSize) {
        ctx.beginPath();
        ctx.arc(wx, wy, dotRadius / camera.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [camera]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear with identity transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply camera transform
    ctx.setTransform(camera.scale, 0, 0, camera.scale, camera.x, camera.y);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw strokes in world space
    localStrokes.forEach((s, i) => drawStroke(ctx, s, i === selectedStrokeIndex));
    if (currentStroke) drawStroke(ctx, currentStroke);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [localStrokes, currentStroke, drawStroke, selectedStrokeIndex, camera, drawGrid]);

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

  // --- Wheel zoom ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setCamera((prev) => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * zoomFactor));
        const ratio = newScale / prev.scale;
        return {
          scale: newScale,
          x: mx - ratio * (mx - prev.x),
          y: my - ratio * (my - prev.y),
        };
      });
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  // --- Drawing handlers ---
  const getWorldPos = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return screenToWorld(sx, sy);
  };

  const getScreenPos = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const textJustOpenedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan with middle mouse, space key, or hand tool
    if (e.button === 1 || spaceDownRef.current || activeTool === "hand") {
      e.preventDefault();
      const [sx, sy] = getScreenPos(e);
      setIsPanning(true);
      setPanStart({ x: sx, y: sy, cx: camera.x, cy: camera.y });
      return;
    }

    const [x, y] = getWorldPos(e);

    if (activeTool === "select") {
      if (selectedStrokeIndex !== null) {
        const s = localStrokes[selectedStrokeIndex];
        const handle = getResizeHandle(s, x, y);
        if (handle) {
          setResizeHandle(handle);
          const minX = Math.min(s.startX, s.endX);
          const maxX = Math.max(s.startX, s.endX);
          const minY = Math.min(s.startY, s.endY);
          const maxY = Math.max(s.startY, s.endY);
          const fixedX = handle.includes("r") ? minX : maxX;
          const fixedY = handle.includes("b") ? minY : maxY;
          setResizeOrigin({ fixedX, fixedY });
          return;
        }
      }
      for (let i = localStrokes.length - 1; i >= 0; i--) {
        if (hitTestStroke(localStrokes[i], x, y)) {
          setSelectedStrokeIndex(i);
          const s = localStrokes[i];
          if (s.tool === "pen" || s.tool === "eraser") {
            let minX = Infinity, minY = Infinity;
            for (const [sx, sy] of s.points) { minX = Math.min(minX, sx); minY = Math.min(minY, sy); }
            setDragOffset({ x: x - minX, y: y - minY });
          } else {
            setDragOffset({ x: x - s.startX, y: y - s.startY });
          }
          setIsDragging(true);
          return;
        }
      }
      setSelectedStrokeIndex(null);
      return;
    }

    if (activeTool === "text") {
      e.preventDefault();
      e.stopPropagation();
      textJustOpenedRef.current = true;
      const [sx, sy] = worldToScreen(x, y);
      setTextInput({ x: sx, y: sy, visible: true });
      setTextValue("");
      setTimeout(() => {
        textInputRef.current?.focus();
        textJustOpenedRef.current = false;
      }, 100);
      return;
    }

    setIsDrawing(true);
    if (activeTool === "pen" || activeTool === "eraser") {
      setCurrentStroke({ tool: activeTool, points: [[x, y]], color: activeColor, fillColor: null, strokeWidth, startX: 0, startY: 0, endX: 0, endY: 0 });
    } else {
      setCurrentStroke({ tool: activeTool, points: [], color: activeColor, fillColor: activeFillColor === "transparent" ? null : activeFillColor, strokeWidth, startX: x, startY: y, endX: x, endY: y });
    }
  };

  const commitText = async () => {
    if (!textValue.trim() || !user || !selectedBoard) {
      setTextInput({ x: 0, y: 0, visible: false });
      setTextValue("");
      return;
    }
    // Convert screen position back to world coords for storage
    const [wx, wy] = screenToWorld(textInput.x, textInput.y);
    const textStroke: Stroke = {
      tool: "text",
      points: [],
      color: activeColor,
      strokeWidth,
      startX: wx,
      startY: wy,
      endX: 0,
      endY: 0,
      text: textValue.trim(),
    };
    setLocalStrokes((prev) => [...prev, textStroke]);
    setTextInput({ x: 0, y: 0, visible: false });
    setTextValue("");

    await supabase.from("whiteboard_strokes").insert({
      whiteboard_id: selectedBoard,
      user_id: user.id,
      tool: "text",
      points: [textValue.trim()] as any,
      color: activeColor,
      stroke_width: strokeWidth,
      start_x: wx,
      start_y: wy,
      end_x: 0,
      end_y: 0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle panning
    if (isPanning && panStart) {
      const [sx, sy] = getScreenPos(e);
      setCamera((prev) => ({
        ...prev,
        x: panStart.cx + (sx - panStart.x),
        y: panStart.cy + (sy - panStart.y),
      }));
      return;
    }

    const [x, y] = getWorldPos(e);

    // Handle resizing selected stroke
    if (activeTool === "select" && resizeHandle && resizeOrigin && selectedStrokeIndex !== null) {
      setLocalStrokes((prev) => {
        const updated = [...prev];
        const s = { ...updated[selectedStrokeIndex] };
        s.startX = resizeOrigin.fixedX;
        s.startY = resizeOrigin.fixedY;
        s.endX = x;
        s.endY = y;
        updated[selectedStrokeIndex] = s;
        return updated;
      });
      return;
    }

    // Handle dragging selected stroke
    if (activeTool === "select" && isDragging && selectedStrokeIndex !== null && dragOffset) {
      setLocalStrokes((prev) => {
        const updated = [...prev];
        const s = { ...updated[selectedStrokeIndex] };
        if (s.tool === "pen" || s.tool === "eraser") {
          let minX = Infinity, minY = Infinity;
          for (const [sx, sy] of s.points) { minX = Math.min(minX, sx); minY = Math.min(minY, sy); }
          const dx = (x - dragOffset.x) - minX;
          const dy = (y - dragOffset.y) - minY;
          s.points = s.points.map(([px, py]) => [px + dx, py + dy]);
        } else {
          const w = s.endX - s.startX;
          const h = s.endY - s.startY;
          s.startX = x - dragOffset.x;
          s.startY = y - dragOffset.y;
          s.endX = s.startX + w;
          s.endY = s.startY + h;
        }
        updated[selectedStrokeIndex] = s;
        return updated;
      });
      return;
    }

    if (!isDrawing || !currentStroke) return;
    if (currentStroke.tool === "pen" || currentStroke.tool === "eraser") {
      setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, [x, y]] });
    } else {
      setCurrentStroke({ ...currentStroke, endX: x, endY: y });
    }
  };

  const handleMouseUp = async () => {
    // End panning
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // Handle resize end
    if (activeTool === "select" && resizeHandle && selectedStrokeIndex !== null) {
      setResizeHandle(null);
      setResizeOrigin(null);
      const s = localStrokes[selectedStrokeIndex];
      if (s.id) {
        suppressRefetchRef.current = true;
        await supabase.from("whiteboard_strokes").update({
          start_x: s.startX, start_y: s.startY,
          end_x: s.endX, end_y: s.endY,
        }).eq("id", s.id);
        setTimeout(() => {
          suppressRefetchRef.current = false;
          queryClient.invalidateQueries({ queryKey: ["whiteboard-strokes", selectedBoard] });
        }, 500);
      }
      return;
    }

    // Handle select tool drop
    if (activeTool === "select" && isDragging && selectedStrokeIndex !== null) {
      setIsDragging(false);
      setDragOffset(null);
      const s = localStrokes[selectedStrokeIndex];
      if (s.id) {
        suppressRefetchRef.current = true;
        const updateData: any = {
          start_x: s.startX, start_y: s.startY,
          end_x: s.endX, end_y: s.endY,
        };
        if (s.tool === "pen" || s.tool === "eraser") {
          updateData.points = s.points as any;
        }
        await supabase.from("whiteboard_strokes").update(updateData).eq("id", s.id);
        setTimeout(() => {
          suppressRefetchRef.current = false;
          queryClient.invalidateQueries({ queryKey: ["whiteboard-strokes", selectedBoard] });
        }, 500);
      }
      return;
    }

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
      fill_color: finished.fillColor || null,
      stroke_width: finished.strokeWidth,
      start_x: finished.startX,
      start_y: finished.startY,
      end_x: finished.endX,
      end_y: finished.endY,
    } as any);
  };

  // Clear board
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedBoard) return;
      await supabase.from("whiteboard_strokes").delete().eq("whiteboard_id", selectedBoard).eq("user_id", user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whiteboard-strokes", selectedBoard] }),
  });

  // Undo
  const undoMutation = useMutation({
    mutationFn: async () => {
      if (!user || !localStrokes.length) return;
      const { data } = await supabase
        .from("whiteboard_strokes")
        .select("id")
        .eq("whiteboard_id", selectedBoard!)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) await supabase.from("whiteboard_strokes").delete().eq("id", data[0].id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whiteboard-strokes", selectedBoard] }),
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
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Delete board
  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      if (!user) throw new Error("Not authenticated");
      // Delete all strokes, notes, and members first, then the board
      await supabase.from("whiteboard_strokes").delete().eq("whiteboard_id", boardId);
      await supabase.from("whiteboard_notes").delete().eq("whiteboard_id", boardId);
      await supabase.from("whiteboard_members").delete().eq("whiteboard_id", boardId);
      const { error } = await supabase.from("whiteboards").delete().eq("id", boardId);
      if (error) throw error;
    },
    onSuccess: (_, boardId) => {
      queryClient.invalidateQueries({ queryKey: ["whiteboards"] });
      if (selectedBoard === boardId) {
        setSelectedBoard(null);
        setLocalStrokes([]);
      }
      toast({ title: "Board deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whiteboard-notes", selectedBoard] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Delete selected stroke
  const deleteSelectedStroke = async () => {
    if (selectedStrokeIndex === null) return;
    const s = localStrokes[selectedStrokeIndex];
    setLocalStrokes((prev) => prev.filter((_, i) => i !== selectedStrokeIndex));
    setSelectedStrokeIndex(null);
    if (s.id) await supabase.from("whiteboard_strokes").delete().eq("id", s.id);
  };

  // Keyboard handler for delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedStrokeIndex !== null && activeTool === "select" && !textInput.visible) {
        e.preventDefault();
        deleteSelectedStroke();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // --- Zoom controls ---
  const zoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    setCamera((prev) => {
      const newScale = Math.min(MAX_SCALE, prev.scale * 1.25);
      const ratio = newScale / prev.scale;
      return { scale: newScale, x: cx - ratio * (cx - prev.x), y: cy - ratio * (cy - prev.y) };
    });
  };

  const zoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    setCamera((prev) => {
      const newScale = Math.max(MIN_SCALE, prev.scale * 0.8);
      const ratio = newScale / prev.scale;
      return { scale: newScale, x: cx - ratio * (cx - prev.x), y: cy - ratio * (cy - prev.y) };
    });
  };

  const fitToContent = () => {
    const canvas = canvasRef.current;
    if (!canvas || !localStrokes.length) {
      setCamera({ x: 0, y: 0, scale: 1 });
      return;
    }
    const bounds = getStrokesBounds(localStrokes);
    if (!bounds) { setCamera({ x: 0, y: 0, scale: 1 }); return; }
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const scale = Math.min(canvas.width / bw, canvas.height / bh, 2);
    const x = (canvas.width - bw * scale) / 2 - bounds.minX * scale;
    const y = (canvas.height - bh * scale) / 2 - bounds.minY * scale;
    setCamera({ x, y, scale });
  };

  // --- Export ---
  const handleExport = () => {
    if (!localStrokes.length) {
      toast({ title: "Nothing to export", description: "Draw something first!" });
      return;
    }
    const bounds = getStrokesBounds(localStrokes);
    if (!bounds) return;

    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;

    // Try full resolution first, then scale down if too large
    let scale = 2; // 2x for retina quality
    let attempts = 0;
    let dataUrl = "";

    while (attempts < 5) {
      const w = Math.ceil(bw * scale);
      const h = Math.ceil(bh * scale);

      // Safety: cap at 8192px
      if (w > 8192 || h > 8192) { scale *= 0.7; attempts++; continue; }

      const offscreen = document.createElement("canvas");
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.setTransform(scale, 0, 0, scale, -bounds.minX * scale, -bounds.minY * scale);
      localStrokes.forEach((s) => drawStroke(ctx, s));

      dataUrl = offscreen.toDataURL("image/png");
      const sizeBytes = Math.ceil((dataUrl.length - 22) * 3 / 4);

      if (sizeBytes <= MAX_EXPORT_BYTES) break;

      // Too large - reduce scale
      scale *= 0.7;
      attempts++;
    }

    if (!dataUrl) {
      toast({ title: "Export failed", description: "Content is too large to export within 20MB.", variant: "destructive" });
      return;
    }

    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast({ title: "Exported!", description: "Whiteboard saved as PNG." });
  };

  const selectedBoardData = boards.find((b: any) => b.id === selectedBoard);

  const getCursor = () => {
    if (isPanning || activeTool === "hand" || spaceDownRef.current) return "cursor-grab";
    if (activeTool === "select") {
      if (resizeHandle) return "cursor-nwse-resize";
      return "cursor-default";
    }
    if (activeTool === "eraser") return "cursor-cell";
    if (activeTool === "text") return "cursor-text";
    return "cursor-crosshair";
  };

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
            <div
              key={board.id}
              className={`flex-shrink-0 p-3 rounded-lg border transition-colors relative group ${
                selectedBoard === board.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
              }`}
            >
              <button
                onClick={() => { setSelectedBoard(board.id); setCamera({ x: 0, y: 0, scale: 1 }); }}
                className="text-left w-full"
              >
                <p className="text-sm font-medium text-foreground pr-6">{board.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{board.whiteboard_members?.length || 0}/{board.max_users || 5}</span>
                </div>
              </button>
              {board.created_by === user?.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${board.name}"? This cannot be undone.`)) {
                      deleteBoardMutation.mutate(board.id);
                    }
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-destructive"
                  title="Delete board"
                  disabled={deleteBoardMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
                <div className="flex items-center gap-1 border-r border-border pr-4 flex-wrap">
                  {(Object.keys(toolIcons) as Tool[]).map((tool) => {
                    const Icon = toolIcons[tool];
                    return (
                      <Button
                        key={tool}
                        variant={activeTool === tool ? "default" : "ghost"}
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => { setActiveTool(tool); if (tool !== "select") setSelectedStrokeIndex(null); }}
                        title={tool.charAt(0).toUpperCase() + tool.slice(1)}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    );
                  })}
                </div>

                {/* Stroke Colors */}
                <div className="flex items-center gap-1 border-r border-border pr-4">
                  <span className="text-xs text-muted-foreground mr-1">Stroke</span>
                  {colors.map((c) => (
                    <button
                      key={c}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${activeColor === c ? "border-primary scale-110" : "border-border"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setActiveColor(c)}
                    />
                  ))}
                </div>

                {/* Fill Colors */}
                <div className="flex items-center gap-1 border-r border-border pr-4">
                  <PaintBucket className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <span className="text-xs text-muted-foreground mr-1">Fill</span>
                  {fillColors.map((c) => (
                    <button
                      key={c}
                      className={`h-6 w-6 rounded border-2 transition-transform ${activeFillColor === c ? "border-primary scale-110" : "border-border"} ${c === "transparent" ? "bg-white" : ""}`}
                      style={c !== "transparent" ? { backgroundColor: c } : {
                        backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                        backgroundSize: "8px 8px",
                        backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px"
                      }}
                      onClick={() => setActiveFillColor(c)}
                      title={c === "transparent" ? "No fill" : c}
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
                  {selectedStrokeIndex !== null && activeTool === "select" && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={deleteSelectedStroke} title="Delete selected">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleExport} title="Export as PNG (max 20MB)">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>

                {/* Board info */}
                <div className="ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setMembersDialogOpen(true)}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {selectedBoardData?.whiteboard_members?.length || 0} members
                  </Button>
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
                  className="relative w-full rounded-lg overflow-hidden"
                  style={{ height: "calc(100vh - 320px)", minHeight: "400px", backgroundColor: "#FAFAFA" }}
                >
                  {strokesLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <canvas
                      ref={canvasRef}
                      className={`w-full h-full ${getCursor()}`}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    />
                  )}
                  {textInput.visible && (
                    <div
                      className="absolute z-10"
                      style={{ left: textInput.x, top: textInput.y }}
                    >
                      <input
                        ref={textInputRef}
                        type="text"
                        value={textValue}
                        onChange={(e) => setTextValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitText();
                          if (e.key === "Escape") { setTextInput({ x: 0, y: 0, visible: false }); setTextValue(""); }
                        }}
                        onBlur={() => { if (!textJustOpenedRef.current) commitText(); }}
                        className="bg-transparent border-b-2 border-primary outline-none text-foreground px-1"
                        style={{ fontSize: `${Math.max(strokeWidth * 5, 16) * camera.scale}px`, color: activeColor, minWidth: "100px" }}
                        placeholder="Type here..."
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Zoom controls overlay */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg border border-border p-1 shadow-sm">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} title="Zoom out">
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground w-12 text-center font-mono">
                      {Math.round(camera.scale * 100)}%
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} title="Zoom in">
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-5 bg-border" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fitToContent} title="Fit to content">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
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

      {selectedBoard && selectedBoardData && (
        <WhiteboardMembersDialog
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          whiteboardId={selectedBoard}
          createdBy={selectedBoardData.created_by}
          onLeft={() => setSelectedBoard(null)}
        />
      )}
    </div>
  );
}
