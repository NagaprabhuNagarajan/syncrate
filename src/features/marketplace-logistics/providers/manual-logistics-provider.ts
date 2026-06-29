import "server-only";

import type {
  CreateShipmentRequest,
  LogisticsProvider,
  ProviderShipmentDraft,
  ProviderStatusResult,
} from "@/features/marketplace-logistics/types/logistics.types";

/**
 * The honest, offline default logistics provider.
 *
 * It performs NO external HTTP calls. The user enters the carrier and tracking
 * number by hand and advances the shipment status manually. A real carrier
 * integration (e.g. an API-backed adapter) implements the same
 * {@link LogisticsProvider} interface and can be swapped in transparently.
 *
 * SECURITY/HONESTY: this module is `server-only` for consistency with future
 * providers that will hold carrier API credentials and make outbound requests.
 * The manual provider has no secrets and no network access — nothing here is
 * faked or simulated.
 */
export class ManualLogisticsProvider implements LogisticsProvider {
  public readonly key = "manual" as const;

  /**
   * Seeds a new shipment from the manually-entered details. The shipment always
   * starts in `pending`; the shipper advances it by hand once dispatched.
   */
  async createShipment(
    input: CreateShipmentRequest
  ): Promise<ProviderShipmentDraft> {
    return {
      provider: this.key,
      carrier: normalize(input.carrier),
      trackingNumber: normalize(input.trackingNumber),
      status: "pending",
    };
  }

  /**
   * The manual provider has no external source of truth, so it cannot report a
   * live status. It returns `null` with an honest explanation — callers must
   * advance the status by hand.
   */
  async getStatus(
    _trackingNumber: string | null
  ): Promise<ProviderStatusResult> {
    return {
      status: null,
      detail:
        "Manual tracking — update the shipment status by hand as it progresses.",
    };
  }
}

/** Trims an optional carrier/tracking value and converts blank → null. */
function normalize(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
