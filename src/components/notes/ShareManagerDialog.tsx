import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Link2Off, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface SharedNote {
  id: string;
  title: string;
  share_token: string;
  updated_at: string;
}

export function ShareManagerDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, share_token, updated_at")
      .eq("share_enabled", true)
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load shares", description: error.message, variant: "destructive" });
      return;
    }
    setNotes((data as SharedNote[]) || []);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const urlFor = (token: string) => `${window.location.origin}/notes/shared/${token}`;

  const copy = async (n: SharedNote) => {
    await navigator.clipboard.writeText(urlFor(n.share_token));
    setCopiedId(n.id);
    toast({ title: "Link copied" });
    setTimeout(() => setCopiedId(null), 1500);
  };

  const revoke = async (n: SharedNote) => {
    setRevokingId(n.id);
    const { error } = await supabase.from("notes").update({ share_enabled: false }).eq("id", n.id);
    setRevokingId(null);
    if (error) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Public link revoked" });
    setNotes((prev) => prev.filter((x) => x.id !== n.id));
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage public links</DialogTitle>
          <DialogDescription>
            View, copy, or revoke read-only links to your notes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] -mx-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              You don't have any active public links.
            </p>
          ) : (
            <ul className="space-y-2 px-1">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{n.title || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={urlFor(n.share_token)} className="text-xs h-8" />
                    <Button size="sm" variant="outline" onClick={() => copy(n)}>
                      {copiedId === n.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revoke(n)}
                      disabled={revokingId === n.id}
                      title="Revoke public link"
                    >
                      {revokingId === n.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2Off className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
