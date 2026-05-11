import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, FolderOpen, FileText, Search, Loader2, LogIn, ExternalLink, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface PickedDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: string;
  modifiedTime?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (files: PickedDriveFile[]) => void;
}

/** Calls the google-drive-proxy edge function with a Drive API path. */
async function driveApi<T = any>(path: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke("google-drive-proxy", {
    body: { path, method: "GET" },
  });
  if (error) throw new Error(error.message);
  return data as T;
}

export function DriveFilePickerDialog({ open, onOpenChange, onPick }: Props) {
  const { toast } = useToast();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [files, setFiles] = useState<PickedDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [stack, setStack] = useState<{ id: string; name: string }[]>([{ id: "root", name: "My Drive" }]);
  const [preview, setPreview] = useState<PickedDriveFile | null>(null);
  const [selected, setSelected] = useState<Record<string, PickedDriveFile>>({});
  const [connecting, setConnecting] = useState(false);
  const current = stack[stack.length - 1];

  // Check connection by querying user_google_tokens row.
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setConnected(false); return; }
      const { data } = await supabase
        .from("user_google_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle();
      setConnected(!!data);
    })();
  }, [open]);

  const connect = async () => {
    setConnecting(true);
    try {
      const returnTo = window.location.href;
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: {},
        headers: {},
      });
      if (error) throw new Error(error.message);
      // We invoked POST; build URL with return_to via separate fetch instead.
      // Actually google-oauth-start reads return_to from query — re-call via fetch:
      const sess = (await supabase.auth.getSession()).data.session;
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-start`);
      url.searchParams.set("return_to", returnTo);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${sess?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Failed to start OAuth");
      // Break out of the Lovable preview iframe — Google blocks framing.
      try { (window.top ?? window).location.href = json.url; }
      catch { window.open(json.url, "_blank", "noopener,noreferrer"); }
      void data;
    } catch (e) {
      toast({ title: "Couldn't start Google sign-in", description: (e as Error).message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const fetchFiles = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const fields = "files(id,name,mimeType,size,webViewLink,modifiedTime,owners(displayName,emailAddress))";
      const q = search.trim()
        ? `name contains '${search.trim().replace(/'/g, "\\'")}' and trashed = false`
        : `'${current.id}' in parents and trashed = false`;
      const params = new URLSearchParams({
        q, fields, pageSize: "100", orderBy: "folder,modifiedTime desc",
      });
      const data = await driveApi<{ files?: PickedDriveFile[] }>(`/drive/v3/files?${params.toString()}`);
      setFiles(data.files || []);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("not_connected")) setConnected(false);
      toast({ title: "Couldn't load Drive", description: msg, variant: "destructive" });
    } finally { setLoading(false); }
  }, [connected, current.id, search, toast]);

  useEffect(() => { if (open && connected) void fetchFiles(); }, [open, connected, fetchFiles]);

  const openFolder = (f: PickedDriveFile) => {
    setSearch("");
    setStack((s) => [...s, { id: f.id, name: f.name }]);
  };

  const toggleSelect = (f: PickedDriveFile) => {
    setSelected((cur) => {
      const next = { ...cur };
      if (next[f.id]) delete next[f.id]; else next[f.id] = f;
      return next;
    });
  };

  const selectedList = Object.values(selected);

  const confirmAttachAll = () => {
    if (selectedList.length === 0) return;
    onPick(selectedList);
    setSelected({}); setPreview(null); onOpenChange(false);
  };

  const confirmAttachPreview = () => {
    if (!preview) return;
    onPick([preview]);
    setSelected({}); setPreview(null); onOpenChange(false);
  };

  useEffect(() => { if (!open) { setSelected({}); setPreview(null); } }, [open]);

  const previewSrc = preview ? `https://drive.google.com/file/d/${preview.id}/preview` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach from Google Drive</DialogTitle>
          <DialogDescription>Select one or more files from your personal Drive to attach.</DialogDescription>
        </DialogHeader>

        {connected === null ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Checking connection…
          </div>
        ) : !connected ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Connect Google Drive to browse your files.</p>
            <Button onClick={connect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LogIn className="h-4 w-4 mr-1" />}
              Connect Google Drive
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStack((s) => s.length > 1 ? s.slice(0, -1) : s)} disabled={stack.length <= 1 || loading}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="text-xs text-muted-foreground truncate flex-1">
                {stack.map((f) => f.name).join(" / ")}
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 w-48 h-9" />
              </div>
            </div>
            <div className="border rounded-md max-h-[420px] overflow-y-auto">
              {loading && files.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading…
                </div>
              ) : files.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No files here.</div>
              ) : (
                <ul className="divide-y">
                  {files.map((f) => {
                    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
                    const Icon = isFolder ? FolderOpen : FileText;
                    const isSelected = !!selected[f.id];
                    return (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-accent/40 cursor-pointer"
                        onClick={() => isFolder ? openFolder(f) : toggleSelect(f)}
                      >
                        {isFolder ? (
                          <span className="w-4 h-4 shrink-0" />
                        ) : (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(f)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1 truncate text-sm">{f.name}</div>
                        {!isFolder && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); setPreview(f); }}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground self-center">
            {selectedList.length > 0 ? `${selectedList.length} selected` : "No files selected"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={confirmAttachAll} disabled={selectedList.length === 0}>
              Attach {selectedList.length || ""} {selectedList.length === 1 ? "file" : "files"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog open={!!preview} onOpenChange={(v) => { if (!v) setPreview(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
            <DialogDescription>
              Preview before attaching. PDFs, Google Docs/Sheets/Slides, images, and video are supported.
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-[4/3] w-full bg-muted rounded-md overflow-hidden">
            {preview && (
              <iframe
                key={preview.id}
                src={previewSrc}
                title={preview.name}
                className="w-full h-full border-0"
                allow="autoplay"
              />
            )}
          </div>
          <DialogFooter className="gap-2">
            {preview?.webViewLink && (
              <Button
                variant="ghost"
                onClick={() => window.open(preview.webViewLink!, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4 mr-1" /> Open in Drive
              </Button>
            )}
            <Button variant="outline" onClick={() => setPreview(null)}>Back</Button>
            <Button onClick={confirmAttachPreview}>Attach this file</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
