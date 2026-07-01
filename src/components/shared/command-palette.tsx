"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  Warehouse,
  ShoppingCart,
  TrendingUp,
  FileText,
  CreditCard,
  Network,
  Store,
  BarChart2,
  Sparkles,
  Settings,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { globalSearchAction } from "@/features/search/actions/search.actions";
import {
  EMPTY_SEARCH_RESULTS,
  type SearchEntity,
  type SearchResultItem,
  type SearchResults,
} from "@/features/search/types/search.types";
import { MIN_QUERY_LENGTH } from "@/features/search/services/search.service";

// ─────────────────────────────────────────────────────────────
// Static commands (navigation + quick actions)
// ─────────────────────────────────────────────────────────────

interface StaticCommand {
  readonly label: string;
  readonly href: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly keywords?: string;
}

const NAV_COMMANDS: readonly StaticCommand[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Products", href: "/products", icon: Package },
  { label: "Inventory", href: "/inventory", icon: Warehouse },
  { label: "Purchase Orders", href: "/purchases", icon: ShoppingCart },
  { label: "Sales Orders", href: "/sales-orders", icon: TrendingUp },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Network", href: "/cbn", icon: Network, keywords: "cbn connections" },
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Reports", href: "/reports", icon: BarChart2 },
  { label: "AI Insights", href: "/ai", icon: Sparkles },
  { label: "Settings", href: "/settings", icon: Settings },
];

const QUICK_ACTIONS: readonly StaticCommand[] = [
  { label: "New customer", href: "/customers/new", icon: Plus },
  { label: "New supplier", href: "/suppliers/new", icon: Plus },
  { label: "New product", href: "/products/new", icon: Plus },
];

const ENTITY_ICON: Record<
  SearchEntity,
  React.ComponentType<{ className?: string }>
> = {
  customer: Users,
  supplier: Truck,
  product: Package,
  invoice: FileText,
};

const ENTITY_GROUPS: readonly {
  readonly key: keyof SearchResults;
  readonly heading: string;
}[] = [
  { key: "customers", heading: "Customers" },
  { key: "suppliers", heading: "Suppliers" },
  { key: "products", heading: "Products" },
  { key: "invoices", heading: "Invoices" },
];

// ─────────────────────────────────────────────────────────────
// Command palette
// ─────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_SEARCH_RESULTS);
  const [isSearching, startSearch] = useTransition();

  // Reset when the palette closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY_SEARCH_RESULTS);
    }
  }, [open]);

  // Debounced server-side entity search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY_SEARCH_RESULTS);
      return;
    }
    const timer = setTimeout(() => {
      startSearch(async () => {
        setResults(await globalSearchAction(q));
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const ql = query.trim().toLowerCase();
  const matchStatic = (cmd: StaticCommand) =>
    ql.length === 0 ||
    cmd.label.toLowerCase().includes(ql) ||
    (cmd.keywords?.includes(ql) ?? false);

  const navMatches = NAV_COMMANDS.filter(matchStatic);
  const actionMatches = QUICK_ACTIONS.filter(matchStatic);

  const entityGroups = ENTITY_GROUPS.map((g) => ({
    ...g,
    items: results[g.key],
  })).filter((g) => g.items.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search customers, invoices… or jump to a page"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? "Searching…" : "No results found."}
        </CommandEmpty>

        {entityGroups.map((group) => (
          <CommandGroup key={group.key} heading={group.heading}>
            {group.items.map((item: SearchResultItem) => {
              const Icon = ENTITY_ICON[item.entity];
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.id}-${item.title}`}
                  onSelect={() => navigate(item.href)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        {navMatches.length > 0 && (
          <CommandGroup heading="Go to">
            {navMatches.map((cmd) => (
              <CommandItem
                key={cmd.href}
                value={`nav-${cmd.label}`}
                onSelect={() => navigate(cmd.href)}
              >
                <cmd.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{cmd.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {actionMatches.length > 0 && (
          <CommandGroup heading="Actions">
            {actionMatches.map((cmd) => (
              <CommandItem
                key={cmd.href}
                value={`action-${cmd.label}`}
                onSelect={() => navigate(cmd.href)}
              >
                <cmd.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{cmd.label}</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
