import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/**
 * Database writes are restricted to signed-in operators by row-level security.
 * Call this before any write so the user gets a clear prompt instead of a
 * permission error from the backend.
 */
export async function ensureOperator(action = "do this"): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  toast.error(`Sign in as an operator to ${action}.`, {
    action: { label: "Sign in", onClick: () => window.location.assign("/auth") },
  });
  return false;
}
