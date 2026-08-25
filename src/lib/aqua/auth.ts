import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/**
 * Database writes are restricted to accounts holding the operator (or admin)
 * role by row-level security. Call this before any write so the user gets a
 * clear prompt instead of a permission error from the backend.
 */
export async function ensureOperator(action = "do this"): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    toast.error(`Sign in as an operator to ${action}.`, {
      action: { label: "Sign in", onClick: () => window.location.assign("/auth") },
    });
    return false;
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .in("role", ["operator", "admin"])
    .limit(1);

  if (roles && roles.length > 0) return true;

  toast.error(`Your account is not approved as an operator, so you cannot ${action}.`);
  return false;
}
