"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function redirectBasedOnSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/dashboard");
      } else {
        router.replace("/auth/login");
      }
    }

    redirectBasedOnSession();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Redirecting you to your inventory dashboard...
        </p>
      </div>
    </div>
  );
}

