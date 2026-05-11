import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { ShareNoteDialog } from "@/components/notes/ShareNoteDialog";
import { ShareManagerDialog } from "@/components/notes/ShareManagerDialog";
import { exportNoteToPdf } from "@/lib/exportNotePdf";
import { NotePresence } from "@/components/notes/NotePresence";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Trash2, Share2, Upload, Users, Loader2, Link as LinkIcon, Download, Search, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import mammoth from "mammoth/mammoth.browser";
import { formatDistanceToNow } from "date-fns";

interface Note {
  id: string;
  user_id: string;
  title: string;
  content: any;
  share_enabled: boolean;
  share_token: string;
  updated_at: string;
}

export default function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [manageSharesOpen, setManageSharesOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collabIds, setCollabIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "shared" | "public">("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const typingPingRef = useRef<(() => void) | null>(null);

  const active = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);
  const isOwner = active && user && active.user_id === user.id;

  // Extract plain text from a TipTap JSON doc for full-text search
  const extractText = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join(" ");
    let out = "";
    if (typeof node.text === "string") out += node.text + " ";
    if (node.content) out += extractText(node.content);
    return out;
  };

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      // Filter by ownership/sharing
      if (filter === "mine" && (!user || n.user_id !== user.id)) return false;
      if (filter === "shared" && (!user || n.user_id === user.id)) return false;
      if (filter === "public" && !n.share_enabled) return false;
      if (!q) return true;
      const title = (n.title || "").toLowerCase();
      if (title.includes(q)) return true;
      const body = extractText(n.content).toLowerCase();
      return body.includes(q);
    });
  }, [notes, search, filter, user?.id]);

  const loadNotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load notes", description: error.message, variant: "destructive" });
      return;
    }
    setNotes((data as Note[]) || []);
    setCollabIds(new Set((data || []).filter((n: any) => n.user_id !== user.id).map((n: any) => n.id)));
    if (!activeId && data && data.length > 0) setActiveId(data[0].id);
  };

  useEffect(() => {
    loadNotes();
  }, [user?.id]);

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notes-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => {
        loadNotes();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "note_collaborators" }, () => {
        loadNotes();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const createNote = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Untitled note" })
      .select()
      .single();
    if (error) {
      toast({ title: "Failed to create note", description: error.message, variant: "destructive" });
      return;
    }
    setNotes((prev) => [data as Note, ...prev]);
    setActiveId((data as Note).id);
  };

  const persistChanges = (id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("notes").update(patch).eq("id", id);
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }, 500);
  };

  const deleteNote = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("notes").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Note deleted" });
      setNotes((prev) => prev.filter((n) => n.id !== deleteId));
      if (activeId === deleteId) setActiveId(null);
    }
    setDeleteId(null);
  };

  const importDocx = async (file: File) => {
    if (!user) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;
      const title = file.name.replace(/\.docx$/i, "") || "Imported note";
      const { data, error } = await supabase
        .from("notes")
        .insert({ user_id: user.id, title })
        .select()
        .single();
      if (error || !data) throw error;
      // Convert HTML to TipTap-compatible content via a temp editor write
      const noteId = (data as Note).id;
      // Store raw HTML temporarily; NoteEditor reads JSON only, so convert via DOMParser → simple doc.
      // Easier: set content as plain doc + use editor.commands.setContent(html) on first load.
      // We stash HTML in a "doc" with html marker and let editor parse it.
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      // Use TipTap's static generateJSON would need extensions; instead use a one-off editor.
      const { Editor } = await import("@tiptap/react");
      const StarterKit = (await import("@tiptap/starter-kit")).default;
      const Underline = (await import("@tiptap/extension-underline")).default;
      const Link = (await import("@tiptap/extension-link")).default;
      const tmp = new Editor({ extensions: [StarterKit, Underline, Link], content: html });
      const json = tmp.getJSON();
      tmp.destroy();
      const { error: upErr } = await supabase.from("notes").update({ content: json }).eq("id", noteId);
      if (upErr) throw upErr;
      toast({ title: "Imported", description: `"${title}" added to your notes.` });
      await loadNotes();
      setActiveId(noteId);
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Could not parse DOCX", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Sidebar list */}
      <div className="w-72 shrink-0 flex flex-col rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Notes
            </h2>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setManageSharesOpen(true)}
              title="Manage public links"
            >
              <LinkIcon className="h-3.5 w-3.5 mr-1" /> Links
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={createNote}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} title="Import .docx">
              <Upload className="h-4 w-4" />
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importDocx(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="h-8 pl-7 pr-7 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="grid grid-cols-4 h-8">
              <TabsTrigger value="all" className="text-xs px-1">All</TabsTrigger>
              <TabsTrigger value="mine" className="text-xs px-1">Mine</TabsTrigger>
              <TabsTrigger value="shared" className="text-xs px-1">Shared</TabsTrigger>
              <TabsTrigger value="public" className="text-xs px-1">Public</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-6">
              No notes yet. Create one to get started.
            </p>
          ) : filteredNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-6">
              No notes match your search.
            </p>
          ) : (
            <ul className="p-2 space-y-1">
              {filteredNotes.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => setActiveId(n.id)}
                    className={`w-full text-left rounded-md px-3 py-2 hover:bg-muted/50 transition-colors ${
                      activeId === n.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate flex-1 text-foreground">{n.title || "Untitled"}</p>
                      {n.share_enabled && <LinkIcon className="h-3 w-3 text-primary" />}
                      {collabIds.has(n.id) && <Users className="h-3 w-3 text-secondary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Editor pane */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select or create a note to start writing.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Input
                value={active.title}
                onChange={(e) => persistChanges(active.id, { title: e.target.value })}
                placeholder="Note title"
                className="text-lg font-semibold border-none bg-transparent focus-visible:ring-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportNoteToPdf(active.title, active.content)}
                title="Export as PDF"
              >
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
              {isOwner && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                    <Share2 className="h-4 w-4 mr-1" /> Share
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteId(active.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              {!isOwner && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2">
                  <Users className="h-3 w-3" /> Shared with you
                </span>
              )}
            </div>
            <NotePresence noteId={active.id} pingRef={typingPingRef} />
            <div className="flex-1 overflow-auto">
              <NoteEditor
                key={active.id}
                content={active.content}
                onChange={(json) => persistChanges(active.id, { content: json })}
                onTyping={() => typingPingRef.current?.()}
              />
            </div>
          </>
        )}
      </div>

      {active && isOwner && (
        <ShareNoteDialog
          note={active}
          open={shareOpen}
          onOpenChange={setShareOpen}
          onChanged={loadNotes}
        />
      )}

      <ShareManagerDialog
        open={manageSharesOpen}
        onOpenChange={setManageSharesOpen}
        onChanged={loadNotes}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteNote} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
