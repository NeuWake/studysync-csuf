import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    // Listen for PASSWORD_RECOVERY (fired automatically when arriving from a recovery link)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });

    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code");
      const errDesc = url.searchParams.get("error_description") || hash.get("error_description");

      if (errDesc) {
        setError(errDesc);
        return;
      }

      // supabase-js may have already auto-exchanged the ?code= or parsed the
      // implicit #access_token= on client init. Check for an existing session first
      // to avoid "invalid/expired code" errors from re-exchanging a consumed code.
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (code || window.location.hash) {
          window.history.replaceState(null, "", "/reset-password");
        }
        setReady(true);
        return;
      }

      // PKCE recovery flow: exchange ?code= for a session if not yet exchanged.
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          // Race: the global client may have just consumed the code.
          const { data: after } = await supabase.auth.getSession();
          if (after.session) {
            window.history.replaceState(null, "", "/reset-password");
            setReady(true);
            return;
          }
          setError(exErr.message);
          return;
        }
        window.history.replaceState(null, "", "/reset-password");
        setReady(true);
        return;
      }

      // No code, no hash, no session — wait briefly for PASSWORD_RECOVERY event;
      // if it never arrives, surface a clear error.
      setTimeout(async () => {
        if (cancelled) return;
        const { data: late } = await supabase.auth.getSession();
        if (!late.session) {
          setError("This password reset link is invalid or has expired. Request a new one.");
        }
      }, 1500);
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    if (upErr) {
      toast({ title: "Couldn't update password", description: upErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    toast({ title: "Password updated", description: "Sign in with your new password." });
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            {error
              ? "We couldn't verify your reset link."
              : ready
                ? "Enter and confirm your new password."
                : "Verifying your reset link…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                Back to sign in
              </Button>
            </div>
          ) : !ready ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
