"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

interface MarketplaceTab {
  readonly label: string;
  readonly href: string;
  /** Exact-match only (so /marketplace doesn't stay active on sub-routes). */
  readonly exact?: boolean;
}

const TABS: readonly MarketplaceTab[] = [
  { label: "Browse", href: "/marketplace", exact: true },
  { label: "My Listings", href: "/marketplace/my-listings" },
  { label: "Orders", href: "/marketplace/orders" },
  { label: "Shipments", href: "/marketplace/shipments" },
  { label: "Reputation", href: "/marketplace/reputation" },
];

function isActive(pathname: string, tab: MarketplaceTab): boolean {
  return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
}

export default function MarketplaceLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <nav
        className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900"
        aria-label="Marketplace sections"
      >
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary-600 text-primary-700 dark:text-primary-300"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
