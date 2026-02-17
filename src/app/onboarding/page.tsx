"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { setCurrentOrganizationId } from "@/lib/currentOrganization";

type Step = 1 | 2 | 3;

function OnboardingInner() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [gstin, setGstin] = useState("");
  const [country, setCountry] = useState("India");
  const [warehouseName, setWarehouseName] = useState("Main Warehouse");
  const [warehouseCode, setWarehouseCode] = useState("MAIN");

  const searchParams = useSearchParams();
  const isNewOrg = searchParams.get("new") === "1";

  useEffect(() => {
    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      const { data: memberships } = await supabase
        .from("organization_users")
        .select("id, organization_id")
        .eq("user_id", session.user.id)
        .limit(1);

      // If user already has an org and this is not "create another", go to dashboard
      if (memberships && memberships.length > 0 && !isNewOrg) {
        router.replace("/dashboard");
        return;
      }

      const { data: profile } = await supabase.auth.getUser();
      const user = profile.user;
      if (user?.user_metadata?.pending_org_name && !orgName) {
        setOrgName(user.user_metadata.pending_org_name as string);
      }
      if (user?.user_metadata?.pending_org_gstin && !gstin) {
        setGstin(user.user_metadata.pending_org_gstin as string);
      }
    }

    bootstrap();
  }, [router, orgName, gstin]);

  async function handleCreateWorkspace(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(userError?.message ?? "You must be signed in to continue.");
      setLoading(false);
      return;
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: orgName,
        gstin: gstin || null,
        country,
      })
      .select("id")
      .single();

    if (orgError || !org) {
      setError(orgError?.message ?? "Unable to create organization.");
      setLoading(false);
      return;
    }

    const { error: membershipError } = await supabase
      .from("organization_users")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "admin",
      });

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    const { error: warehouseError } = await supabase.from("warehouses").insert({
      organization_id: org.id,
      name: warehouseName || "Main Warehouse",
      code: warehouseCode || "MAIN",
      is_default: true,
    });

    if (warehouseError) {
      setError(warehouseError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setCurrentOrganizationId(org.id);
    router.replace("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Set up your inventory workspace
            </h1>
            <p className="text-sm text-slate-500">
              A quick guided setup so your dashboard and reports are accurate
              from day one.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                step >= 1 ? "bg-red-600 text-white" : "bg-slate-100"
              }`}
            >
              1
            </span>
            <span className="h-px w-6 bg-slate-200" />
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                step >= 2 ? "bg-red-600 text-white" : "bg-slate-100"
              }`}
            >
              2
            </span>
            <span className="h-px w-6 bg-slate-200" />
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                step >= 3 ? "bg-red-600 text-white" : "bg-slate-100"
              }`}
            >
              3
            </span>
          </div>
        </div>

        <form
          onSubmit={step === 3 ? handleCreateWorkspace : (event) => {
            event.preventDefault();
            setStep((prev) => (prev === 3 ? prev : ((prev + 1) as Step)));
          }}
          className="space-y-6"
        >
          {step === 1 ? (
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="orgName"
                  className="text-sm font-medium text-slate-700"
                >
                  Business / organization name
                </label>
                <input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  placeholder="Zylker Fashions Pvt Ltd"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="country"
                  className="text-sm font-medium text-slate-700"
                >
                  Country
                </label>
                <select
                  id="country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="India">India</option>
                  <option value="UAE">UAE</option>
                  <option value="USA">USA</option>
                  <option value="Other">Other</option>
                </select>
              </div>
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
            </section>
          ) : null}

          {step === 2 ? (
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="warehouseName"
                  className="text-sm font-medium text-slate-700"
                >
                  Primary warehouse name
                </label>
                <input
                  id="warehouseName"
                  type="text"
                  value={warehouseName}
                  onChange={(event) => setWarehouseName(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  placeholder="Main Warehouse"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="warehouseCode"
                  className="text-sm font-medium text-slate-700"
                >
                  Warehouse code
                </label>
                <input
                  id="warehouseCode"
                  type="text"
                  value={warehouseCode}
                  onChange={(event) => setWarehouseCode(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  placeholder="MAIN"
                />
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">
                Ready to create your workspace
              </p>
              <p>
                We&apos;ll create your organization, add you as an admin, and set
                up a primary warehouse. You can customize taxes, users, and more
                from Settings later.
              </p>
            </section>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))
              }
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
              disabled={step === 1 || loading}
            >
              Back
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Finishing setup..."
                : step === 3
                ? "Create workspace"
                : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-slate-600">Loading…</p>
          </div>
        </div>
      }
    >
      <OnboardingInner />
    </Suspense>
  );
}

