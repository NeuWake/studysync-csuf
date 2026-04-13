import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Trash2, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  const [newNote, setNewNote] = useState("");
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  // Fetch boards user is a member of
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

  // Fetch notes for selected board
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["whiteboard-notes", selectedBoard],
    queryFn: async () => {
      if (!selectedBoard) return [];
      const { data, error } = await supabase
        .from("whiteboard_notes")
        .select("*")
        .eq("whiteboard_id", selectedBoard)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch author names
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

  // Realtime subscription for notes
  useEffect(() => {
    if (!selectedBoard) return;
    const channel: RealtimeChannel = supabase
      .channel(`whiteboard:${selectedBoard}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whiteboard_notes",
        filter: `whiteboard_id=eq.${selectedBoard}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["whiteboard-notes", selectedBoard] });
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [selectedBoard, queryClient]);

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

  // Add note
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
    onSuccess: () => {
      setNewNote("");
      // Realtime will handle the refresh
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete note
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("whiteboard_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const selectedBoardData = boards.find((b: any) => b.id === selectedBoard);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Whiteboard</h1>
          <p className="text-muted-foreground mt-1">Collaborate with shared notes in real-time</p>
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
              <Button
                className="w-full"
                onClick={() => createBoardMutation.mutate()}
                disabled={createBoardMutation.isPending || !newBoardName.trim()}
              >
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
                <span className="text-xs text-muted-foreground">
                  {board.whiteboard_members?.length || 0}/{board.max_users || 5}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Notes board */}
      {selectedBoard ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedBoardData?.name || "Board"}</CardTitle>
              <Badge variant="secondary">
                <Users className="h-3 w-3 mr-1" />
                {selectedBoardData?.whiteboard_members?.length || 0} members
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {notesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-8">No notes yet. Add one below!</p>
                ) : (
                  notes.map((note: any) => {
                    const colorClass = noteColorClasses[note.color] || noteColorClasses["#FEF3C7"];
                    const isOwner = note.user_id === user?.id;
                    return (
                      <div key={note.id} className={`p-4 rounded-lg border-2 ${colorClass} relative group`}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-[10px] text-muted-foreground font-medium">{note.author_name}</span>
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-line">{note.content}</p>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button
                onClick={() => addNoteMutation.mutate()}
                disabled={addNoteMutation.isPending || !newNote.trim()}
                className="self-end"
              >
                Add Note
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Select a board or create a new one to start collaborating.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
