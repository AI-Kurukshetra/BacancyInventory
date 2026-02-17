"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function NewVendorPage() {
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

    const { error: insertError } = await supabase.from("vendors").insert({
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

    router.replace("/purchases/vendors");
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">New vendor</h1>
          <p className="text-xs text-slate-500">
            Capture basic supplier details for purchases.
          </p>
        </div>
        <Link
          href="/purchases/vendors"
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Vendor name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="ABC Fabrics"
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
              onChange={(event) => setGstin(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="27ABCDE1234F1Z5"
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
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="vendor@example.com"
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
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="+91 9876543210"
            />
          </div>
        </section>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-full bg-red-600 px-5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save vendor"}
          </button>
        </div>
      </form>
    </div>
  );
}

