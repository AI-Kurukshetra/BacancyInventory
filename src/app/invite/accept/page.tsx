"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function InviteAcceptInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "expired" | "invalid" | "already">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setMessage("Missing invite token.");
      return;
    }

    async function accept() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please sign in first, then use the invite link again.");
        setStatus("invalid");
        return;
      }

      const { data: inv, error: fetchErr } = await supabase
        .from("organization_invitations")
        .select("id, organization_id, email, role, expires_at")
        .eq("token", token)
        .single();

      if (fetchErr || !inv) {
        setStatus("invalid");
        setMessage("Invite not found or link is invalid.");
        return;
      }

      if (new Date(inv.expires_at) < new Date()) {
        setStatus("expired");
        setMessage("This invite has expired.");
        return;
      }

      const { data: existing } = await supabase
        .from("organization_users")
        .select("id")
        .eq("organization_id", inv.organization_id)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        setStatus("already");
        setMessage("You are already a member of this organization.");
        return;
      }

      const { error: insertErr } = await supabase.from("organization_users").insert({
        organization_id: inv.organization_id,
        user_id: user.id,
        role: inv.role,
        status: "active",
      });

      if (insertErr) {
        setStatus("invalid");
        setMessage(insertErr.message);
        return;
      }

      await supabase
        .from("organization_invitations")
        .delete()
        .eq("id", inv.id);

      setStatus("success");
      setMessage("You have joined the organization. Redirecting to dashboard…");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    }

    accept();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        {status === "loading" && <p className="text-slate-600">Accepting invite…</p>}
        {status === "success" && (
          <p className="text-emerald-700 font-medium">{message}</p>
        )}
        {(status === "expired" || status === "invalid" || status === "already") && (
          <>
            <p className="text-slate-700">{message}</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Go to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <p className="text-slate-600">Loading invite…</p>
          </div>
        </div>
      }
    >
      <InviteAcceptInner />
    </Suspense>
  );
}
