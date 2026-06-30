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
  TrendingUp,
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
  Network,
  Store,
  Search,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { signOutAction } from "@/features/identity/actions/auth.actions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandMark } from "@/components/shared/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ─────────────────────────────────────────────────────────────
// Navigation definition
// ─────────────────────────────────────────────────────────────

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly badge?: string;
  /** Override the prefix used for active detection (e.g. "/sales" matches all sales sub-routes). */
  readonly activePrefix?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Products", href: "/products", icon: Package },
  { label: "Inventory", href: "/inventory", icon: Warehouse },
  { label: "Purchases", href: "/purchases", icon: ShoppingCart },
  { label: "Sales", href: "/sales/orders", icon: TrendingUp, activePrefix: "/sales" },
  { label: "Invoices", href: "/sales/invoices", icon: FileText },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Network", href: "/cbn", icon: Network, activePrefix: "/cbn" },
  { label: "Marketplace", href: "/marketplace", icon: Store, activePrefix: "/marketplace" },
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
  const prefix = item.activePrefix ?? item.href;
  const isActive =
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.activePrefix !== undefined && pathname.startsWith(`${prefix}/`)) ||
    pathname === prefix;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-gradient-brand text-white shadow-glow-primary"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive
            ? "text-white"
            : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
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
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            isActive
              ? "bg-white/20 text-white"
              : "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300"
          )}
        >
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
        "flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-900",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center border-b border-slate-100 px-3 py-3.5 dark:border-slate-800",
          collapsed ? "justify-center" : "justify-between gap-2"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <BrandMark size={26} priority />
            <span className="text-gradient-brand text-base font-bold tracking-tight">
              Syncrate
            </span>
          </div>
        )}
        {collapsed && <BrandMark size={26} priority />}
        <button
          onClick={onToggle}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
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
        <button className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700 dark:hover:bg-slate-800">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-brand text-[11px] font-bold text-white">
            M
          </span>
          <span className="flex-1 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
            My Organization
          </span>
          <ChevronDown
            className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          />
        </button>
      )}

      {/* Main nav */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin"
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
      <div className="border-t border-slate-100 px-2 py-3 dark:border-slate-800">
        <ul className="space-y-0.5">
          {NAV_FOOTER.map((item) => (
            <li key={item.href}>
              <NavLink item={item} collapsed={collapsed} />
            </li>
          ))}
          {/* <li>
            <form action={signOutAction}>
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300",
                  "transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? "Sign out" : undefined}
              >
                <LogOut
                  className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                  aria-hidden="true"
                />
                {!collapsed && <span>Sign out</span>}
              </button>
            </form>
          </li> */}
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
    <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/70 px-4 dark:border-slate-800/70 sm:px-6">
      <div className="flex items-center gap-2">
        <button
          onClick={onMobileMenuOpen}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Search trigger */}
        <button
          className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white/60 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-500 dark:hover:border-slate-700 md:flex"
          aria-label="Search"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>Search…</span>
          <kbd className="ml-6 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gradient-error"
                aria-hidden="true"
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="text-sm font-semibold">Notifications</span>
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                1 new
              </span>
            </div>
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          </PopoverContent>
        </Popover>

        {/* Account menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-0.5 rounded-full outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              aria-label="Account menu"
            >
              <Avatar className="h-7 w-7 ring-2 ring-white/60 dark:ring-slate-800">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" align="end">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild destructive>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl dark:bg-slate-900 lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BrandMark size={26} />
                <span className="text-gradient-brand text-base font-bold tracking-tight">
                  Syncrate
                </span>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav
              className="overflow-y-auto px-3 py-3 scrollbar-thin"
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
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
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
          className="app-backdrop flex-1 overflow-y-auto scrollbar-thin"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
