import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the current operator session. Writes to the database (incidents,
 * evidence, frame metrics, cameras, operator actions) are restricted to
 * signed-in operators by row-level security, so the UI uses this to gate
 * write actions and show a sign-in prompt.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return {
    session,
    user: (session?.user ?? null) as User | null,
    isAuthenticated: Boolean(session),
    loading,
    signOut: () => supabase.auth.signOut(),
  };
}
