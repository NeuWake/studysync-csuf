import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Copy, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import UserSearchSelect from "@/components/chat/UserSearchSelect";

interface NoteRow {
  id: string;
  share_enabled: boolean;
  share_token: string;
}

interface Collaborator {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
}

export function ShareNoteDialog({
  note,
  open,
  onOpenChange,
  onChanged,
}: {
  note: NoteRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [enabled, setEnabled] = useState(note.share_enabled);
  const [copied, setCopied] = useState(false);
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const shareUrl = `${window.location.origin}/notes/shared/${note.share_token}`;

  useEffect(() => {
    setEnabled(note.share_enabled);
  }, [note.share_enabled, note.id]);

  const loadCollabs = async () => {
    const { data, error } = await supabase
      .from("note_collaborators")
      .select("id, user_id")
      .eq("note_id", note.id);
    if (error) {
      console.error("loadCollabs note_collaborators error", error);
      return;
    }
    if (!data) return;
    const ids = data.map((d) => d.user_id);
    if (ids.length === 0) {
      setCollabs([]);
      return;
    }
    const { data: profs, error: profErr } = await supabase
      .from("public_profiles")
      .select("user_id, full_name, username")
      .in("user_id", ids);
    if (profErr) console.error("loadCollabs profiles error", profErr);
    setCollabs(
      data.map((d) => {
        const p = profs?.find((x: any) => x.user_id === d.user_id);
        return {
          id: d.id,
          user_id: d.user_id,
          full_name: p?.full_name ?? null,
          username: p?.username ?? null,
        };
      }),
    );
  };

  useEffect(() => {
    if (open) loadCollabs();
  }, [open, note.id]);

  const toggleShare = async (v: boolean) => {
    setEnabled(v);
    const { error } = await supabase.from("notes").update({ share_enabled: v }).eq("id", note.id);
    if (error) {
      toast({ title: "Failed to update share setting", description: error.message, variant: "destructive" });
      setEnabled(!v);
    } else {
      onChanged();
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const addCollaborator = async (u: { user_id: string }) => {
    setLoading(true);
    const { error } = await supabase.from("note_collaborators").insert({ note_id: note.id, user_id: u.user_id });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to add collaborator", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Collaborator added" });
      loadCollabs();
    }
  };

  const removeCollaborator = async (id: string) => {
    const { error } = await supabase.from("note_collaborators").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    } else {
      loadCollabs();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share note</DialogTitle>
          <DialogDescription>
            Share a read-only link or invite people to edit together in real time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label className="font-medium">Public read-only link</Label>
              <p className="text-xs text-muted-foreground">Anyone with the link can view this note.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleShare} />
          </div>

          {enabled && (
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="text-xs" />
              <Button size="icon" variant="outline" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-border">
            <Label>Invite editors</Label>
            <UserSearchSelect
              selectedUsers={[]}
              onSelect={(u) => addCollaborator(u)}
              onRemove={() => {}}
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {collabs.length > 0 && (
              <div className="space-y-1 pt-2">
                {collabs.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {(c.full_name || c.username || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.full_name || c.username || "Unknown"}</p>
                      {c.username && <p className="text-xs text-muted-foreground truncate">@{c.username}</p>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeCollaborator(c.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
