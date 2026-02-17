"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const redirectBase =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${redirectBase}/auth/update-password`,
      }
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Password reset link sent. Please check your email inbox.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Reset your password
          </h1>
          <p className="text-sm text-slate-500">
            Enter the email associated with your account and we&apos;ll send you
            a secure reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="you@example.com"
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
            {loading ? "Sending reset link..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Remembered your password?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-red-600 hover:text-red-700"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

