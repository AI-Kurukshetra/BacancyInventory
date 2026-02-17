import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export async function syncProfile(user: User) {
  const email = user.email ?? null;
  const fullName = (user.user_metadata?.full_name as string) ?? email ?? null;
  await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email, full_name: fullName, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
}
