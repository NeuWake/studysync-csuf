import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const isEmailConfirmed = (u: User | null | undefined) => {
  if (!u) return false;
  // Email/password users must have email_confirmed_at. OAuth users (Google, etc.)
  // are inherently verified by the provider — allow them through.
  if (u.app_metadata?.provider && u.app_metadata.provider !== "email") return true;
  return Boolean(u.email_confirmed_at || (u as any).confirmed_at);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleSession = async (incoming: Session | null) => {
      if (incoming?.user && !isEmailConfirmed(incoming.user)) {
        // Block any unconfirmed session from being used anywhere in the app.
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        toast({
          title: "Email not confirmed",
          description: "Please verify your email address before signing in. Check your inbox for the confirmation link.",
          variant: "destructive",
        });
        return;
      }
      setSession(incoming);
      setUser(incoming?.user ?? null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, incoming) => {
      // Defer async work to avoid deadlocks per Supabase guidance
      setTimeout(() => { void handleSession(incoming); }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: incoming } }) => {
      void handleSession(incoming);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
