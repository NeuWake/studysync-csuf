import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, Download, Trash2, Paperclip } from "lucide-react";

interface Props {
  userAssignmentId: string;
  assignmentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AssignmentDocumentsDialog({ userAssignmentId, assignmentTitle, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["assignment-documents", userAssignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_documents")
        .select("*")
        .eq("user_assignment_id", userAssignmentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!userAssignmentId,
  });

  const uploadFile = async (file: File) => {
    if (!user) return;
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Max size is 25MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${userAssignmentId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("task-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("task-attachments")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      const { error: insErr } = await supabase.from("assignment_documents").insert({
        user_assignment_id: userAssignmentId,
        user_id: user.id,
        file_name: file.name,
        file_url: signed.signedUrl,
        storage_path: path,
        file_size: file.size,
        file_type: file.type || null,
      });
      if (insErr) throw insErr;
      toast({ title: "Document linked", description: file.name });
      qc.invalidateQueries({ queryKey: ["assignment-documents", userAssignmentId] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("task-attachments").remove([doc.storage_path]);
      const { error } = await supabase.from("assignment_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Document removed" });
      qc.invalidateQueries({ queryKey: ["assignment-documents", userAssignmentId] });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const downloadDoc = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(doc.storage_path, 60);
    if (error) {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Documents
          </DialogTitle>
          <DialogDescription className="truncate">For: {assignmentTitle}</DialogDescription>
        </DialogHeader>

        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading..." : "Upload Document"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">Max 25MB. Files are private to you.</p>
        </div>

        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No documents yet.</p>
          ) : (
            docs.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.file_name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(d.file_size)}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadDoc(d)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(d)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
