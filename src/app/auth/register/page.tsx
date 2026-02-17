"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [gstin, setGstin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          pending_org_name: organizationName,
          pending_org_gstin: gstin,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.replace("/onboarding");
      return;
    }

    setMessage(
      "Account created. Please check your email inbox to confirm your address, then sign in to continue onboarding."
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Create your inventory workspace
          </h1>
          <p className="text-sm text-slate-500">
            Sign up and set up your organization to start managing stock,
            sales, and purchases.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="fullName"
                className="text-sm font-medium text-slate-700"
              >
                Your name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                placeholder="Priya Sharma"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="organizationName"
                className="text-sm font-medium text-slate-700"
              >
                Organization name
              </label>
              <input
                id="organizationName"
                type="text"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                placeholder="Zylker Fashions Pvt Ltd"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Work email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-700"
              >
                Password
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="gstin"
                className="text-sm font-medium text-slate-700"
              >
                GSTIN (optional)
              </label>
              <input
                id="gstin"
                type="text"
                value={gstin}
                onChange={(event) => setGstin(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                placeholder="27ABCDE1234F1Z5"
              />
            </div>
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-red-600 hover:text-red-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

