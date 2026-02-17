import { supabase } from "@/lib/supabaseClient";

const STORAGE_KEY = "bacancy_current_organization_id";

export function setCurrentOrganizationId(organizationId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, organizationId);
}

export function getStoredOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

/**
 * Resolves the current organization ID for the signed-in user:
 * uses the stored value if it's in the user's memberships, otherwise the first membership.
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("organization_users")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!memberships?.length) return null;

  const stored = getStoredOrganizationId();
  if (stored && memberships.some((m) => m.organization_id === stored)) {
    return stored;
  }
  const first = memberships[0].organization_id;
  setCurrentOrganizationId(first);
  return first;
}
