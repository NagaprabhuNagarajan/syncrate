/**
 * GST Engine — pure utility, no side effects.
 *
 * India GST rules:
 *   - Valid rates: 0, 5, 12, 18, 28 (percent)
 *   - Intra-state (orgState === supplyState): CGST = rate/2, SGST = rate/2
 *   - Inter-state (orgState !== supplyState): IGST = full rate
 *   - If either state is empty/null → treat as inter-state
 *   - Rate 0 → all tax amounts are 0
 */

const VALID_GST_RATES = new Set([0, 5, 12, 18, 28]);

/** Rounds to 2 decimal places, avoiding binary float drift. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface GSTInput {
  taxableAmount: number;
  gstRate: number;
  orgState: string | null | undefined;
  supplyState: string | null | undefined;
}

export interface GSTComputation {
  isInterstate: boolean;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  /** Total GST (CGST+SGST or IGST). */
  taxAmount: number;
}

export function isValidGSTRate(rate: number): boolean {
  return VALID_GST_RATES.has(rate);
}

export function computeGST(input: GSTInput): GSTComputation {
  const { taxableAmount, gstRate, orgState, supplyState } = input;

  const hasOrgState =
    typeof orgState === "string" && orgState.trim() !== "";
  const hasSupplyState =
    typeof supplyState === "string" && supplyState.trim() !== "";

  // If either state is absent or they differ → inter-state
  const isInterstate =
    !hasOrgState ||
    !hasSupplyState ||
    (orgState as string).trim().toLowerCase() !==
      (supplyState as string).trim().toLowerCase();

  // GST-exempt product
  if (gstRate === 0) {
    return {
      isInterstate,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxAmount: 0,
    };
  }

  if (isInterstate) {
    const igstAmount = round2(taxableAmount * (gstRate / 100));
    return {
      isInterstate: true,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: gstRate,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
      taxAmount: igstAmount,
    };
  }

  // Intra-state: split equally between CGST and SGST
  const halfRate = gstRate / 2;
  const cgstAmount = round2(taxableAmount * (halfRate / 100));
  const sgstAmount = round2(taxableAmount * (halfRate / 100));
  const taxAmount = round2(cgstAmount + sgstAmount);

  return {
    isInterstate: false,
    cgstRate: halfRate,
    sgstRate: halfRate,
    igstRate: 0,
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
    taxAmount,
  };
}
