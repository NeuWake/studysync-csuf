import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ExternalLink, Key, ShieldCheck } from "lucide-react";

const DISMISS_KEY_PREFIX = "canvas_onboarding_dismissed_";

export function CanvasOnboardingDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("user_canvas_credentials")
        .select("canvas_access_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const hasToken = !!data?.canvas_access_token?.trim();
      const dismissed = sessionStorage.getItem(DISMISS_KEY_PREFIX + user.id);

      if (!hasToken && !dismissed) {
        setOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleDismiss = () => {
    if (user) {
      sessionStorage.setItem(DISMISS_KEY_PREFIX + user.id, "1");
    }
    setOpen(false);
  };

  const handleGoToProfile = () => {
    handleDismiss();
    navigate("/profile");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Key className="h-6 w-6 text-primary" />
            Connect Your Canvas Account
          </DialogTitle>
          <DialogDescription>
            To sync your courses, assignments, and due dates automatically, StudySync needs a Canvas access token.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              Generate your Canvas token
            </h3>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-8">
              <li>
                Log in to Canvas at{" "}
                <a
                  href="https://csufullerton.instructure.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  csufullerton.instructure.com <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Click <strong className="text-foreground">Account</strong> (left sidebar) →{" "}
                <strong className="text-foreground">Settings</strong>
              </li>
              <li>
                Scroll to <strong className="text-foreground">Approved Integrations</strong>
              </li>
              <li>
                Click <strong className="text-foreground">+ New Access Token</strong>
              </li>
              <li>
                Set the purpose to <em>"StudySync"</em>, leave the expiration blank, then click{" "}
                <strong className="text-foreground">Generate Token</strong>
              </li>
              <li>
                <strong className="text-foreground">Copy the token immediately</strong> — Canvas will only show it
                once.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </span>
              Paste it into StudySync
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              Go to <strong className="text-foreground">Profile & Settings → Canvas Integration</strong>, paste the
              token into the <em>Access Token</em> field, and click{" "}
              <strong className="text-foreground">Validate & Save</strong>.
            </p>
          </section>

          <Alert className="border-secondary/50 bg-secondary/5">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            <AlertTitle className="text-foreground">Your token is private</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Tokens are stored securely in your account and are never shared with other users. Only you can read or
              update your Canvas credentials.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Disclaimer — handle with care</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p>
                Your Canvas access token grants the same permissions as your Canvas login. Treat it like a password.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Never share your token with anyone, on any platform.</li>
                <li>Do not paste it into screenshots, support chats, or public forums.</li>
                <li>
                  If you suspect it was exposed, delete it from{" "}
                  <em>Canvas → Settings → Approved Integrations</em> immediately.
                </li>
              </ul>
              <p className="pt-1">
                StudySync is not responsible for misuse, account actions, or data loss caused by improper handling,
                sharing, or storage of your Canvas token outside this application.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Remind me later
          </Button>
          <Button onClick={handleGoToProfile} className="gap-2">
            <Key className="h-4 w-4" />
            Go to Canvas Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
