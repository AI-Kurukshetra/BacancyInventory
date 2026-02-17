"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import { Warehouse as WarehouseIcon, PlusCircle, MapPin, Trash2 } from "lucide-react";

type WarehouseRow = {
  id: string;
  name: string;
  code: string | null;
  is_default: boolean;
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  async function loadWarehouses() {
    const orgId = await getCurrentOrganizationId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("warehouses")
      .select("id, name, code, is_default")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (!error && data) {
      setWarehouses(data as WarehouseRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(userError?.message ?? "You must be signed in.");
      setSaving(false);
      return;
    }

    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) {
      setError("No organization linked. Complete onboarding first.");
      setSaving(false);
      return;
    }

    // When setting as default, clear default from all other warehouses first (only one default per org)
    if (isDefault) {
      await supabase
        .from("warehouses")
        .update({ is_default: false })
        .eq("organization_id", organizationId);
    }

    const { error: insertError } = await supabase.from("warehouses").insert({
      organization_id: organizationId,
      name,
      code: code || null,
      is_default: isDefault,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName("");
    setCode("");
    setIsDefault(false);
    setLoading(true);
    await loadWarehouses();
  }

  async function handleSetDefault(warehouse: WarehouseRow) {
    if (warehouse.is_default) return;
    setError(null);
    setSettingDefaultId(warehouse.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSettingDefaultId(null);
      return;
    }
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) {
      setSettingDefaultId(null);
      return;
    }
    await supabase
      .from("warehouses")
      .update({ is_default: false })
      .eq("organization_id", organizationId);
    await supabase
      .from("warehouses")
      .update({ is_default: true })
      .eq("id", warehouse.id);
    setSettingDefaultId(null);
    await loadWarehouses();
  }

  async function handleDelete(warehouse: WarehouseRow) {
    if (!confirm(`Delete "${warehouse.name}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(warehouse.id);
    const { error: deleteError } = await supabase
      .from("warehouses")
      .delete()
      .eq("id", warehouse.id);
    setDeletingId(null);
    if (deleteError) {
      setError(
        deleteError.code === "23503"
          ? "Cannot delete: this warehouse has stock or is used in transactions. Remove stock first."
          : deleteError.message
      );
      return;
    }
    await loadWarehouses();
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <WarehouseIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              Warehouses
            </h1>
            <p className="text-sm text-neutral-500">
              Manage where your stock is stored and track movement by location.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Existing warehouses */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <MapPin className="h-5 w-5 text-neutral-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Existing warehouses
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3 text-right">Default</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-neutral-500">
                      Loading warehouses…
                    </td>
                  </tr>
                ) : warehouses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                          <WarehouseIcon className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-neutral-600">No warehouses yet</p>
                        <p className="text-xs text-neutral-500">
                          Add your first location using the form on the right.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  warehouses.map((warehouse) => (
                    <tr
                      key={warehouse.id}
                      className="transition hover:bg-neutral-50/50"
                    >
                      <td className="px-6 py-3.5 font-medium text-neutral-900">
                        {warehouse.name}
                      </td>
                      <td className="px-6 py-3.5 text-neutral-600">
                        {warehouse.code ?? "—"}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {warehouse.is_default ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Default
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(warehouse)}
                            disabled={!!settingDefaultId}
                            className="text-xs font-medium text-neutral-500 hover:text-red-600 disabled:opacity-50"
                          >
                            {settingDefaultId === warehouse.id ? "…" : "Set as default"}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(warehouse)}
                          disabled={!!deletingId}
                          className="inline-flex items-center gap-1 rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Delete warehouse"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add warehouse form */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <PlusCircle className="h-5 w-5 text-red-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Add warehouse
            </h2>
          </div>
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-xs font-medium uppercase tracking-wide text-neutral-600"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                placeholder="e.g. Main Warehouse"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="code"
                className="text-xs font-medium uppercase tracking-wide text-neutral-600"
              >
                Code <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                placeholder="e.g. MAIN"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 transition hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-neutral-700">
                Make this the default warehouse
              </span>
            </label>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save warehouse"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
