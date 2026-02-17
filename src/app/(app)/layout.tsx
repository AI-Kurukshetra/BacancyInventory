"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Briefcase,
  Building2,
  Building,
  Warehouse,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Bell,
  Settings,
  HelpCircle,
  User,
  LogOut,
  PlusCircle,
  MessageCircle,
} from "lucide-react";
import { setCurrentOrganizationId, getStoredOrganizationId } from "@/lib/currentOrganization";

type NavItem = {
  label: string;
  href: string;
  section: "main" | "reports" | "settings";
  adminOnly?: boolean;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", section: "main", icon: <LayoutDashboard className="h-5 w-5 shrink-0" /> },
  { label: "Inventory", href: "/inventory/products", section: "main", icon: <Package className="h-5 w-5 shrink-0" /> },
  { label: "Sales", href: "/sales/invoices", section: "main", icon: <ShoppingCart className="h-5 w-5 shrink-0" /> },
  { label: "Customers", href: "/sales/customers", section: "main", icon: <Users className="h-5 w-5 shrink-0" /> },
  { label: "Purchases", href: "/purchases/bills", section: "main", icon: <Briefcase className="h-5 w-5 shrink-0" /> },
  { label: "Vendors", href: "/purchases/vendors", section: "main", icon: <Building2 className="h-5 w-5 shrink-0" /> },
  { label: "Warehouses", href: "/warehouses", section: "main", icon: <Warehouse className="h-5 w-5 shrink-0" /> },
  { label: "Reports", href: "/reports", section: "reports", icon: <BarChart3 className="h-5 w-5 shrink-0" /> },
  { label: "Team", href: "/settings/team", section: "settings", adminOnly: true, icon: <Users className="h-5 w-5 shrink-0" /> },
  { label: "Organizations", href: "/settings/organizations", section: "settings", adminOnly: true, icon: <Building className="h-5 w-5 shrink-0" /> },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setOrgDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [profileOpen, orgDropdownOpen]);

  useEffect(() => {
    async function initialise() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      setUserEmail(session.user.email ?? null);

      const { data: memberships } = await supabase
        .from("organization_users")
        .select("organization_id, role, organization:organizations(name)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!memberships || memberships.length === 0) {
        router.replace("/onboarding");
        return;
      }

      const orgList = memberships.map((m) => {
        const row = m as { organization_id: string; role: string; organization?: { name?: string } };
        return { id: row.organization_id, name: row.organization?.name ?? "Organization" };
      });
      // Dedupe by id (same org could appear if multiple rows)
      const seen = new Set<string>();
      const uniqueOrgs = orgList.filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      });
      setOrganizations(uniqueOrgs);

      const storedId = getStoredOrganizationId();
      const current = uniqueOrgs.find((o) => o.id === storedId) ?? uniqueOrgs[0];
      setCurrentOrgId(current.id);
      setOrgName(current.name);

      const currentMembership = memberships.find((m) => (m as { organization_id: string }).organization_id === current.id) as { role?: string } | undefined;
      setUserRole(currentMembership?.role ?? null);

      setCurrentOrganizationId(current.id);

      const { syncProfile } = await import("@/lib/syncProfile");
      syncProfile(session.user).catch(() => {});
    }

    initialise();
  }, [router]);

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/" || pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  function switchOrganization(orgId: string) {
    const org = organizations.find((o) => o.id === orgId);
    if (!org) return;
    setCurrentOrganizationId(orgId);
    setCurrentOrgId(orgId);
    setOrgName(org.name);
    setOrgDropdownOpen(false);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-neutral-100 text-neutral-900">
      <aside className="hidden w-60 flex-col bg-neutral-900 text-white md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-neutral-800 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-red-600 text-white">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">Bacancy Inventory</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3 text-sm">
          {navItems
            .filter((item) => item.section === "main")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 font-medium transition ${
                  isActive(item.href)
                    ? "bg-red-600 text-white"
                    : "text-neutral-200 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {(item.label === "Sales" || item.label === "Purchases") && (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                )}
              </Link>
            ))}

          <div className="my-2 border-t border-neutral-800 pt-2">
            {navItems
              .filter((item) => item.section === "reports")
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 font-medium transition ${
                    isActive(item.href)
                      ? "bg-red-600 text-white"
                      : "text-neutral-200 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                </Link>
              ))}
          </div>

          {userRole === "admin" &&
            navItems
              .filter((item) => item.section === "settings")
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 font-medium transition ${
                    isActive(item.href)
                      ? "bg-red-600 text-white"
                      : "text-neutral-200 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                </Link>
              ))}
        </nav>

        <div className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-400">
          <p className="truncate font-medium text-neutral-200">{orgName ?? "Your organization"}</p>
          <p className="truncate">{userEmail ?? "Signed in"}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-2 text-neutral-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-2">
            <Link
              href="/sales/invoices/new"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
            >
              <Plus className="h-5 w-5" />
            </Link>
            <div className="hidden sm:block relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                placeholder="Search"
                className="h-9 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-4 text-sm text-neutral-700 outline-none placeholder:text-neutral-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 md:w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block" ref={orgDropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOrgDropdownOpen((v) => !v);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-red-200 hover:bg-red-50/50"
                aria-expanded={orgDropdownOpen}
                aria-haspopup="true"
              >
                <span className="truncate max-w-[140px]">{orgName ?? "Organization"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
              </button>
              {orgDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[220px] rounded-xl border border-neutral-200 bg-white py-1 shadow-xl">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => switchOrganization(org.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                        currentOrgId === org.id ? "bg-red-50 font-medium text-red-700" : "text-neutral-700"
                      }`}
                    >
                      {org.name}
                      {currentOrgId === org.id && <span className="text-xs">Active</span>}
                    </button>
                  ))}
                  <div className="my-1 border-t border-neutral-100" />
                  <Link
                    href="/onboarding?new=1"
                    onClick={() => setOrgDropdownOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Create organization
                  </Link>
                  <Link
                    href="/settings/organizations"
                    onClick={() => setOrgDropdownOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <Building className="h-4 w-4" />
                    Manage / remove organizations
                  </Link>
                </div>
              )}
            </div>
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotificationsOpen((v) => !v);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="h-5 w-5" />
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-neutral-200 bg-white py-2 shadow-xl">
                  <div className="border-b border-neutral-100 px-4 py-2">
                    <p className="text-sm font-semibold text-neutral-900">Notifications</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto px-4 py-3">
                    <p className="text-sm text-neutral-500">No new notifications.</p>
                  </div>
                </div>
              )}
            </div>
            <Link href="/settings/team" className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </Link>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Help">
              <HelpCircle className="h-5 w-5" />
            </button>
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileOpen((v) => !v);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-label="Profile menu"
              >
                <User className="h-5 w-5" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-neutral-100 px-3 py-2">
                    <p className="truncate text-sm font-medium text-neutral-900">{userEmail ?? "Signed in"}</p>
                    <p className="truncate text-xs text-neutral-500">{orgName ?? "Your organization"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      handleSignOut();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-neutral-100 px-3 py-4 md:px-6 md:py-5">
          {children}
        </main>

        {/* Floating chatbot pop in the corner (UI only) */}
        <div className="pointer-events-none fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
          <div className="pointer-events-auto flex flex-col items-end gap-3">
            {chatOpen && (
              <div className="w-[320px] max-w-[90vw] overflow-hidden rounded-3xl border border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-red-100 bg-gradient-to-r from-red-600 to-red-500 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                      <MessageCircle className="h-4 w-4 text-red-50" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Bacancy Assistant</p>
                      <p className="text-[11px] text-red-100">Instant help for your inventory</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-red-50 hover:bg-red-500/40"
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-col gap-3 px-4 py-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div className="max-w-[220px] rounded-2xl rounded-tl-sm bg-neutral-100 px-3 py-2 text-neutral-800 shadow-sm">
                      <p>Hi! I can help you explore your demo data and screens.</p>
                    </div>
                  </div>
                  <div className="ml-9 space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                      Quick questions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Show me sample invoices",
                        "Where can I add a new product?",
                        "How do I delete a customer?",
                      ].map((label) => (
                        <button
                          key={label}
                          type="button"
                          className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] text-neutral-700 shadow-sm hover:border-red-200 hover:text-red-700"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
                    This is a demo UI only. Wire this input to your real support bot or FAQ API when
                    you’re ready.
                  </div>
                </div>
                <div className="border-t border-neutral-100 bg-neutral-50/80 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type your message…"
                      className="h-9 flex-1 rounded-full border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    />
                    <button
                      type="button"
                      className="inline-flex h-9 items-center rounded-full bg-red-600 px-3 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-red-700"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_10px_30px_rgba(220,38,38,0.4)] transition hover:bg-red-700"
              aria-label="Open chat"
            >
              <MessageCircle className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

