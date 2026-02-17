"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function ensureSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/auth/login");
      }
    }
    ensureSession();
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Password updated successfully. Redirecting to dashboard...");
    setTimeout(() => router.replace("/dashboard"), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Set a new password
          </h1>
          <p className="text-sm text-slate-500">
            Choose a strong password to protect your inventory account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="text-sm text-emerald-600" role="status">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Updating password..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

