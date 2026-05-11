import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_DRIVE_SCOPE, GOOGLE_OAUTH_CLIENT_ID } from "@/config/google";
import {
  FolderOpen,
  FileText,
  FileImage,
  FileVideo,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  ArrowLeft,
  RefreshCw,
  Search,
  ExternalLink,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

// Google Identity Services types (kept inline — minimal surface we need).
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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

const TOKEN_KEY = "studysync_gdrive_token";
const TOKEN_EXP_KEY = "studysync_gdrive_token_exp";

const iconForMime = (mime: string) => {
  if (mime === "application/vnd.google-apps.folder") return FolderOpen;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.includes("spreadsheet")) return FileSpreadsheet;
  if (mime.includes("presentation")) return Presentation;
  if (mime.includes("document") || mime === "application/pdf" || mime.startsWith("text/")) return FileText;
  return FileIcon;
};

const formatBytes = (bytes?: string) => {
  if (!bytes) return "—";
  const n = Number(bytes);
  if (!Number.isFinite(n) || n === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

export default function DrivePage() {
  const { toast } = useToast();
  const [gisReady, setGisReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([
    { id: "root", name: "My Drive" },
  ]);
  const tokenClientRef = useRef<ReturnType<NonNullable<Window["google"]>["accounts"]["oauth2"]["initTokenClient"]> | null>(null);

  const currentFolder = folderStack[folderStack.length - 1];
  const clientIdConfigured = useMemo(
    () => GOOGLE_OAUTH_CLIENT_ID && !GOOGLE_OAUTH_CLIENT_ID.startsWith("PASTE_"),
    []
  );

  // Load Google Identity Services script.
  useEffect(() => {
    if (window.google?.accounts?.oauth2) { setGisReady(true); return; }
    const existing = document.querySelector<HTMLScriptElement>("script[data-gis]");
    if (existing) {
      existing.addEventListener("load", () => setGisReady(true));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.gis = "1";
    s.onload = () => setGisReady(true);
    document.body.appendChild(s);
  }, []);

  // Restore cached token if still valid.
  useEffect(() => {
    const cached = sessionStorage.getItem(TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || 0);
    if (cached && exp > Date.now() + 30_000) setToken(cached);
  }, []);

  const initTokenClient = useCallback(() => {
    if (!gisReady || !window.google || !clientIdConfigured) return null;
    if (tokenClientRef.current) return tokenClientRef.current;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          toast({ title: "Drive sign-in failed", description: resp.error || "No access token returned", variant: "destructive" });
          return;
        }
        const expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000;
        sessionStorage.setItem(TOKEN_KEY, resp.access_token);
        sessionStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
        setToken(resp.access_token);
      },
    });
    return tokenClientRef.current;
  }, [gisReady, clientIdConfigured, toast]);

  const connectDrive = () => {
    const client = initTokenClient();
    if (!client) {
      toast({ title: "Not ready", description: "Google sign-in is still loading or not configured.", variant: "destructive" });
      return;
    }
    client.requestAccessToken({ prompt: "consent" });
  };

  const disconnectDrive = () => {
    const t = token;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
    setToken(null);
    setFiles([]);
    setFolderStack([{ id: "root", name: "My Drive" }]);
    if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t);
  };

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const fields = "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)";
      let q: string;
      if (search.trim()) {
        const safe = search.trim().replace(/'/g, "\\'");
        q = `name contains '${safe}' and trashed = false`;
      } else {
        q = `'${currentFolder.id}' in parents and trashed = false`;
      }
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("q", q);
      url.searchParams.set("fields", fields);
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("orderBy", "folder,modifiedTime desc");
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        disconnectDrive();
        toast({ title: "Session expired", description: "Please reconnect Google Drive.", variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      toast({ title: "Couldn't load Drive", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentFolder.id, search]);

  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  const openItem = (f: DriveFile) => {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      setSearch("");
      setFolderStack((s) => [...s, { id: f.id, name: f.name }]);
    } else if (f.webViewLink) {
      window.open(f.webViewLink, "_blank", "noopener,noreferrer");
    }
  };

  const goBack = () => setFolderStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  if (!clientIdConfigured) {
    return (
      <div className="container max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Google Drive isn't configured yet</CardTitle>
            <CardDescription>
              Add your Google OAuth Web Client ID in <code className="px-1 rounded bg-muted">src/config/google.ts</code> to enable per-user Drive access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Open Google Cloud Console → APIs &amp; Services → Credentials.</p>
            <p>2. Create an OAuth client ID (Web application).</p>
            <p>3. Add this site's origin to <em>Authorized JavaScript origins</em>.</p>
            <p>4. Enable the <strong>Google Drive API</strong>.</p>
            <p>5. Paste the Client ID into the config file. No client secret needed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Google Drive</h1>
          <p className="text-sm text-muted-foreground">Browse files from your personal Drive.</p>
        </div>
        <div className="flex items-center gap-2">
          {token ? (
            <Button variant="outline" size="sm" onClick={disconnectDrive}>
              <LogOut className="h-4 w-4 mr-1" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={connectDrive} disabled={!gisReady}>
              <LogIn className="h-4 w-4 mr-1" /> Connect Google Drive
            </Button>
          )}
        </div>
      </div>

      {!token ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect to view your files</CardTitle>
            <CardDescription>Read-only access. The token lives only in this browser session.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={goBack} disabled={folderStack.length <= 1 || loading}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
              {folderStack.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1">
                  {i > 0 && <span>/</span>}
                  <button
                    className="hover:text-foreground truncate max-w-[180px]"
                    onClick={() => setFolderStack((s) => s.slice(0, i + 1))}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Drive…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-56"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => void fetchFiles()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading && files.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
              ) : files.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">No files here.</div>
              ) : (
                <ul className="divide-y">
                  {files.map((f) => {
                    const Icon = iconForMime(f.mimeType);
                    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
                    return (
                      <li
                        key={f.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 cursor-pointer"
                        onClick={() => openItem(f)}
                      >
                        <Icon className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{f.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {isFolder ? "Folder" : f.mimeType.replace("application/vnd.google-apps.", "Google ")}
                            {!isFolder && ` · ${formatBytes(f.size)}`}
                            {f.modifiedTime && ` · ${new Date(f.modifiedTime).toLocaleDateString()}`}
                          </div>
                        </div>
                        {!isFolder && f.webViewLink && (
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
