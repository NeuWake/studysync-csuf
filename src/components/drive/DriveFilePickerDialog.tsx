import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_DRIVE_SCOPE, GOOGLE_OAUTH_CLIENT_ID } from "@/config/google";
import { ArrowLeft, FolderOpen, FileText, Search, Loader2, LogIn, ExternalLink } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string; expires_in?: number }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

const TOKEN_KEY = "studysync_gdrive_token";
const TOKEN_EXP_KEY = "studysync_gdrive_token_exp";

export interface PickedDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (file: PickedDriveFile) => void;
}

export function DriveFilePickerDialog({ open, onOpenChange, onPick }: Props) {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const [files, setFiles] = useState<PickedDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [stack, setStack] = useState<{ id: string; name: string }[]>([{ id: "root", name: "My Drive" }]);
  const [preview, setPreview] = useState<PickedDriveFile | null>(null);
  const tokenClientRef = useRef<ReturnType<NonNullable<Window["google"]>["accounts"]["oauth2"]["initTokenClient"]> | null>(null);
  const current = stack[stack.length - 1];
  const configured = GOOGLE_OAUTH_CLIENT_ID && !GOOGLE_OAUTH_CLIENT_ID.startsWith("PASTE_");

  useEffect(() => {
    if (window.google?.accounts?.oauth2) { setGisReady(true); return; }
    const existing = document.querySelector<HTMLScriptElement>("script[data-gis]");
    if (existing) { existing.addEventListener("load", () => setGisReady(true)); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.dataset.gis = "1";
    s.onload = () => setGisReady(true);
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    if (!open) return;
    const cached = sessionStorage.getItem(TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || 0);
    if (cached && exp > Date.now() + 30_000) setToken(cached);
  }, [open]);

  const connect = () => {
    if (!gisReady || !window.google || !configured) {
      toast({ title: "Google sign-in not ready", variant: "destructive" });
      return;
    }
    if (!tokenClientRef.current) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            toast({ title: "Drive sign-in failed", description: resp.error, variant: "destructive" });
            return;
          }
          const expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000;
          sessionStorage.setItem(TOKEN_KEY, resp.access_token);
          sessionStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
          setToken(resp.access_token);
        },
      });
    }
    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  };

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const fields = "files(id,name,mimeType,size,webViewLink)";
      const q = search.trim()
        ? `name contains '${search.trim().replace(/'/g, "\\'")}' and trashed = false`
        : `'${current.id}' in parents and trashed = false`;
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("q", q);
      url.searchParams.set("fields", fields);
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("orderBy", "folder,modifiedTime desc");
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_EXP_KEY);
        setToken(null);
        toast({ title: "Drive session expired", description: "Please reconnect.", variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      toast({ title: "Couldn't load Drive", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [token, current.id, search, toast]);

  useEffect(() => { if (open && token) void fetchFiles(); }, [open, token, fetchFiles]);

  const handleClick = (f: PickedDriveFile) => {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      setSearch("");
      setStack((s) => [...s, { id: f.id, name: f.name }]);
    } else {
      setPreview(f);
    }
  };

  const confirmAttach = () => {
    if (!preview) return;
    onPick(preview);
    setPreview(null);
    onOpenChange(false);
  };

  // Drive's /preview endpoint embeds PDFs, Docs, Sheets, Slides, images, video, and most common doc types.
  const previewSrc = preview ? `https://drive.google.com/file/d/${preview.id}/preview` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach from Google Drive</DialogTitle>
          <DialogDescription>Pick a file from your personal Drive to attach.</DialogDescription>
        </DialogHeader>

        {!configured ? (
          <p className="text-sm text-muted-foreground">Google Drive isn't configured. Set <code>GOOGLE_OAUTH_CLIENT_ID</code> in <code>src/config/google.ts</code>.</p>
        ) : !token ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Connect Google Drive to browse your files.</p>
            <Button onClick={connect} disabled={!gisReady}>
              <LogIn className="h-4 w-4 mr-1" /> Connect Google Drive
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
                    return (
                      <li key={f.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/40 cursor-pointer" onClick={() => handleClick(f)}>
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1 truncate text-sm">{f.name}</div>
                        {!isFolder && <span className="text-xs text-muted-foreground">Select</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
