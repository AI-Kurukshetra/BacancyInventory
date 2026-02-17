"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";

export default function NewCustomerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(userError?.message ?? "You must be signed in.");
      setLoading(false);
      return;
    }

    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) {
      setError("No organization linked. Complete onboarding first.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("customers").insert({
      organization_id: organizationId,
      name,
      email: email || null,
      phone: phone || null,
      gstin: gstin || null,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.replace("/sales/customers");
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            New customer
          </h1>
          <p className="text-xs text-slate-500">
            Add a customer for invoicing and sales orders.
          </p>
        </div>
        <Link
          href="/sales/customers"
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </header>

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Customer name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="ABC Retailers"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="gstin"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              GSTIN (optional)
            </label>
            <input
              id="gstin"
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="24ABCDEF1234G1Z5"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Email (optional)
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="sales@customer.com"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Phone (optional)
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="+91 98765 43210"
            />
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-red-600 px-5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save customer"}
          </button>
        </div>
      </form>
    </div>
  );
}
