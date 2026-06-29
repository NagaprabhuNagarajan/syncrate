import "server-only";

import { ManualLogisticsProvider } from "@/features/marketplace-logistics/providers/manual-logistics-provider";
import type {
  LogisticsProvider,
  LogisticsProviderKey,
} from "@/features/marketplace-logistics/types/logistics.types";

export { ManualLogisticsProvider };

/** The provider used when none is specified — honest manual default. */
export const DEFAULT_LOGISTICS_PROVIDER_KEY: LogisticsProviderKey = "manual";

const manualProvider = new ManualLogisticsProvider();

/** Registry of available providers, keyed by their stable provider key. */
const PROVIDERS: Readonly<Record<LogisticsProviderKey, LogisticsProvider>> = {
  manual: manualProvider,
};

/**
 * Resolves a logistics provider by key, falling back to the manual provider.
 * Real carrier integrations register themselves here behind the same interface.
 */
export function getLogisticsProvider(
  key?: LogisticsProviderKey | string | null
): LogisticsProvider {
  if (key && key in PROVIDERS) {
    return PROVIDERS[key as LogisticsProviderKey];
  }
  return manualProvider;
}
