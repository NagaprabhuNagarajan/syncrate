"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  Warehouse,
  ShoppingCart,
  FileText,
  CreditCard,
  BarChart2,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Building2,
  Bell,
  Sparkles,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { signOutAction } from "@/features/identity/actions/auth.actions";

// ─────────────────────────────────────────────────────────────
// Navigation definition
// ─────────────────────────────────────────────────────────────

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly badge?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Products", href: "/products", icon: Package },
  { label: "Inventory", href: "/inventory", icon: Warehouse },
  { label: "Purchases", href: "/purchases", icon: ShoppingCart },
  { label: "Sales", href: "/sales", icon: FileText },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Reports", href: "/reports", icon: BarChart2 },
  { label: "AI Insights", href: "/ai", icon: Sparkles, badge: "Beta" },
];

const NAV_FOOTER: readonly NavItem[] = [
  { label: "Team", href: "/settings/team", icon: Users },
  { label: "Branches", href: "/settings/branches", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

// ─────────────────────────────────────────────────────────────
// Nav Link
// ─────────────────────────────────────────────────────────────

function NavLink({
  item,
  collapsed,
}: {
  readonly item: NavItem;
  readonly collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
        )}
        aria-hidden="true"
      />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && item.badge && (
        <span className="ml-auto rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────

function Sidebar({
  collapsed,
  onToggle,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center border-b border-slate-100 px-3 py-4",
          collapsed ? "justify-center" : "justify-between gap-2"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="text-base font-semibold text-slate-900">
              Syncrate
            </span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
            <span className="text-sm font-bold text-white">S</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 rotate-90" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Org selector (placeholder) */}
      {!collapsed && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2">
          <Building2
            className="h-4 w-4 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <span className="flex-1 truncate text-xs font-medium text-slate-600">
            My Organization
          </span>
          <ChevronDown
            className="h-3 w-3 shrink-0 text-slate-400"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Main nav */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-3"
        aria-label="Main navigation"
      >
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer nav */}
      <div className="border-t border-slate-100 px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_FOOTER.map((item) => (
            <li key={item.href}>
              <NavLink item={item} collapsed={collapsed} />
            </li>
          ))}
          <li>
            <form action={signOutAction}>
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600",
                  "transition-colors hover:bg-slate-100 hover:text-slate-900",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? "Sign out" : undefined}
              >
                <LogOut
                  className="h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                {!collapsed && <span>Sign out</span>}
              </button>
            </form>
          </li>
        </ul>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────

function TopBar({
  onMobileMenuOpen,
}: {
  readonly onMobileMenuOpen: () => void;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        onClick={onMobileMenuOpen}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button
          className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {/* Unread dot */}
          <span
            className="bg-error-500 absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
            aria-hidden="true"
          />
        </button>

        {/* User avatar (placeholder) */}
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
          U
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile drawer
// ─────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600">
                  <span className="text-sm font-bold text-white">S</span>
                </div>
                <span className="text-base font-semibold text-slate-900">
                  Syncrate
                </span>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav
              className="overflow-y-auto px-3 py-3"
              aria-label="Mobile navigation"
            >
              <ul className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} collapsed={false} />
                  </li>
                ))}
              </ul>
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// App Shell — exported
// ─────────────────────────────────────────────────────────────

export function AppShell({
  children,
  userId: _userId,
}: {
  readonly children: React.ReactNode;
  readonly userId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMobileMenuOpen={() => setMobileOpen(true)} />
        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
