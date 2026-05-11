import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SharedNotePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<{ title: string; content: any; updated_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase.rpc("get_shared_note", { _token: token });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      const row = (data as any[])?.[0];
      if (!row) {
        setError("This link is invalid or sharing has been disabled.");
        return;
      }
      setNote({ title: row.title, content: row.content, updated_at: row.updated_at });
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">S</span>
            </div>
            <span className="font-bold text-foreground">StudySync</span>
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{error}</p>
          </div>
        ) : note ? (
          <>
            <h1 className="text-3xl font-bold text-foreground mb-1">{note.title || "Untitled"}</h1>
            <p className="text-xs text-muted-foreground mb-6">
              Read-only · Last updated {new Date(note.updated_at).toLocaleString()}
            </p>
            <NoteEditor content={note.content} editable={false} />
          </>
        ) : null}
      </main>
    </div>
  );
}
