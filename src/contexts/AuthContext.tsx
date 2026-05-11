import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Email of a signed-in but unconfirmed user (any provider). */
  pendingEmail: string | null;
  /** Provider used by the unconfirmed session (e.g. "email", "google"). */
  pendingProvider: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  pendingEmail: null,
  pendingProvider: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const isEmailConfirmed = (u: User | null | undefined) => {
  if (!u) return false;
  // Uniform check across all providers (email/password AND OAuth like Google):
  // require an explicit email_confirmed_at timestamp from Supabase Auth.
  return Boolean(u.email_confirmed_at || (u as any).confirmed_at);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  useEffect(() => {
    const handleSession = async (incoming: Session | null) => {
      if (incoming?.user && !isEmailConfirmed(incoming.user)) {
        // Block any unconfirmed session — including OAuth providers that
        // didn't return a verified email — from being used in the app.
        const email = incoming.user.email ?? null;
        const provider = (incoming.user.app_metadata?.provider as string) ?? "email";
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setPendingEmail(email);
        setPendingProvider(provider);
        setLoading(false);
        return;
      }
      setSession(incoming);
      setUser(incoming?.user ?? null);
      if (incoming?.user) {
        setPendingEmail(null);
        setPendingProvider(null);
      }
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
    setPendingEmail(null);
    setPendingProvider(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, pendingEmail, pendingProvider, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
