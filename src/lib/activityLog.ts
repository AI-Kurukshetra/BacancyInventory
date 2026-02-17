import { supabase } from "@/lib/supabaseClient";

export async function logActivity(params: {
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { organizationId, userId, action, entityType, entityId, metadata } =
    params;

  await supabase.from("activity_logs").insert({
    organization_id: organizationId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: metadata ?? null,
  });
}

