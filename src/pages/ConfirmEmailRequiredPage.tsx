import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MailCheck } from "lucide-react";

export default function ConfirmEmailRequiredPage() {
  const { pendingEmail, pendingProvider, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!pendingEmail) return <Navigate to="/auth" replace />;

  const isOAuth = pendingProvider && pendingProvider !== "email";

  const handleResend = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      toast({ title: "Could not resend", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Confirmation sent", description: "Check your inbox for the new link." });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Confirm your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <span className="font-medium text-foreground">{pendingEmail}</span>.
            You need to verify your email before accessing the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {isOAuth ? (
            <p>
              Your {pendingProvider} account hasn't returned a verified email yet. Please check your inbox
              (and spam folder) for the confirmation link, or sign in with a different account.
            </p>
          ) : (
            <p>Click the link in the email to activate your account, then sign in again.</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {!isOAuth && (
            <Button className="w-full" onClick={handleResend} disabled={loading}>
              {loading ? "Sending..." : "Resend confirmation email"}
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            Back to sign in
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
