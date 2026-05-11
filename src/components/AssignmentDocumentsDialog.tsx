import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, Download, Trash2, Paperclip, Eye, X, Image as ImageIcon } from "lucide-react";

function isImage(type?: string | null, name?: string) {
  if (type?.startsWith("image/")) return true;
  return !!name && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
}
function isPdf(type?: string | null, name?: string) {
  if (type === "application/pdf") return true;
  return !!name && /\.pdf$/i.test(name);
}
function isPreviewable(type?: string | null, name?: string) {
  return isImage(type, name) || isPdf(type, name);
}

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
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const openPreview = async (doc: any) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setPreviewLoading(true);
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(doc.storage_path, 60 * 10);
    setPreviewLoading(false);
    if (error || !data) {
      toast({ title: "Preview failed", description: error?.message, variant: "destructive" });
      setPreviewDoc(null);
      return;
    }
    setPreviewUrl(data.signedUrl);
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
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
            docs.map((d: any) => {
              const previewable = isPreviewable(d.file_type, d.file_name);
              const Icon = isImage(d.file_type, d.file_name) ? ImageIcon : FileText;
              return (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <button
                    type="button"
                    onClick={() => previewable ? openPreview(d) : downloadDoc(d)}
                    className="flex-1 min-w-0 text-left hover:underline"
                  >
                    <p className="text-sm font-medium truncate">{d.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(d.file_size)}</p>
                  </button>
                  {previewable && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPreview(d)} title="Preview">
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadDoc(d)} title="Download">
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
              );
            })
          )}
        </div>

        {/* Inline preview dialog */}
        <Dialog open={!!previewDoc} onOpenChange={(o) => !o && closePreview()}>
          <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-4">
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="truncate text-base">{previewDoc?.file_name}</DialogTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => previewDoc && downloadDoc(previewDoc)} title="Download">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closePreview} title="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 min-h-0 rounded-md overflow-hidden bg-muted/40 flex items-center justify-center">
              {previewLoading || !previewUrl ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : isImage(previewDoc?.file_type, previewDoc?.file_name) ? (
                <img src={previewUrl} alt={previewDoc?.file_name} className="max-h-full max-w-full object-contain" />
              ) : isPdf(previewDoc?.file_type, previewDoc?.file_name) ? (
                <iframe src={previewUrl} title={previewDoc?.file_name} className="w-full h-full border-0" />
              ) : (
                <p className="text-sm text-muted-foreground">Preview not supported.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
