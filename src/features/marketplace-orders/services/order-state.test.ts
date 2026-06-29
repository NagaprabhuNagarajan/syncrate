import { describe, expect, it } from "vitest";
import {
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  canPerformOrderAction,
  canPerformPaymentAction,
  getAvailableOrderActions,
  getAvailablePaymentActions,
  getOrderRole,
} from "./order-state";
import type {
  OrderStatus,
  PaymentStatus,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

const order = {
  organizationId: "buyer-org",
  sellerOrganizationId: "seller-org",
};

describe("getOrderRole", () => {
  it("identifies the buyer", () => {
    expect(getOrderRole(order, "buyer-org")).toBe("buyer");
  });
  it("identifies the seller", () => {
    expect(getOrderRole(order, "seller-org")).toBe("seller");
  });
  it("returns null for a non-participant", () => {
    expect(getOrderRole(order, "stranger-org")).toBeNull();
  });
});

describe("order transitions — valid paths", () => {
  it("seller confirms a pending order", () => {
    expect(canPerformOrderAction("confirm", "pending", "seller")).toBe(true);
  });
  it("seller fulfils a confirmed order", () => {
    expect(canPerformOrderAction("fulfil", "confirmed", "seller")).toBe(true);
  });
  it("buyer completes a fulfilled order", () => {
    expect(canPerformOrderAction("complete", "fulfilled", "buyer")).toBe(true);
  });
  it("buyer cancels a pending order", () => {
    expect(canPerformOrderAction("cancel", "pending", "buyer")).toBe(true);
  });
  it("seller cancels a confirmed order", () => {
    expect(canPerformOrderAction("cancel", "confirmed", "seller")).toBe(true);
  });
});

describe("order transitions — invalid by role", () => {
  it("buyer cannot confirm", () => {
    expect(canPerformOrderAction("confirm", "pending", "buyer")).toBe(false);
  });
  it("seller cannot complete", () => {
    expect(canPerformOrderAction("complete", "fulfilled", "seller")).toBe(false);
  });
  it("buyer cannot fulfil", () => {
    expect(canPerformOrderAction("fulfil", "confirmed", "buyer")).toBe(false);
  });
});

describe("order transitions — invalid by status", () => {
  it("cannot confirm a completed order", () => {
    expect(canPerformOrderAction("confirm", "completed", "seller")).toBe(false);
  });
  it("cannot fulfil a pending order", () => {
    expect(canPerformOrderAction("fulfil", "pending", "seller")).toBe(false);
  });
  it("cannot complete a confirmed order", () => {
    expect(canPerformOrderAction("complete", "confirmed", "buyer")).toBe(false);
  });
  it("cannot act on a cancelled order", () => {
    const statuses: OrderStatus[] = ["cancelled", "completed"];
    statuses.forEach((status) => {
      expect(getAvailableOrderActions(status, "buyer")).toEqual([]);
      expect(getAvailableOrderActions(status, "seller")).toEqual([]);
    });
  });
});

describe("getAvailableOrderActions", () => {
  it("offers confirm + cancel to the seller on a pending order", () => {
    expect(getAvailableOrderActions("pending", "seller").sort()).toEqual(
      ["cancel", "confirm"].sort()
    );
  });
  it("offers only cancel to the buyer on a pending order", () => {
    expect(getAvailableOrderActions("pending", "buyer")).toEqual(["cancel"]);
  });
  it("offers fulfil + cancel to the seller on a confirmed order", () => {
    expect(getAvailableOrderActions("confirmed", "seller").sort()).toEqual(
      ["cancel", "fulfil"].sort()
    );
  });
  it("offers complete to the buyer on a fulfilled order", () => {
    expect(getAvailableOrderActions("fulfilled", "buyer")).toEqual(["complete"]);
  });
});

describe("transition map integrity", () => {
  it("every order transition targets a different status than its sources", () => {
    Object.values(ORDER_TRANSITIONS).forEach((t) => {
      expect(t.from).not.toContain(t.to);
    });
  });
});

describe("payment transitions", () => {
  it("buyer can hold a pending payment", () => {
    expect(canPerformPaymentAction("hold", "pending", "buyer")).toBe(true);
  });
  it("seller cannot hold", () => {
    expect(canPerformPaymentAction("hold", "pending", "seller")).toBe(false);
  });
  it("buyer can release a held payment", () => {
    expect(canPerformPaymentAction("release", "held", "buyer")).toBe(true);
  });
  it("seller can refund a held payment", () => {
    expect(canPerformPaymentAction("refund", "held", "seller")).toBe(true);
  });
  it("cannot release a payment that is not held", () => {
    const statuses: PaymentStatus[] = [
      "pending",
      "released",
      "refunded",
      "failed",
    ];
    statuses.forEach((status) => {
      expect(canPerformPaymentAction("release", status, "buyer")).toBe(false);
    });
  });
  it("buyer cannot refund", () => {
    expect(canPerformPaymentAction("refund", "held", "buyer")).toBe(false);
  });
});

describe("getAvailablePaymentActions", () => {
  it("only the buyer may hold when no payment exists yet", () => {
    expect(getAvailablePaymentActions(null, "buyer")).toEqual(["hold"]);
    expect(getAvailablePaymentActions(null, "seller")).toEqual([]);
  });
  it("offers release to the buyer and refund to the seller on a held payment", () => {
    expect(getAvailablePaymentActions("held", "buyer")).toEqual(["release"]);
    expect(getAvailablePaymentActions("held", "seller")).toEqual(["refund"]);
  });
  it("offers nothing on a settled payment", () => {
    const settled: PaymentStatus[] = ["released", "refunded", "failed"];
    settled.forEach((status) => {
      expect(getAvailablePaymentActions(status, "buyer")).toEqual([]);
      expect(getAvailablePaymentActions(status, "seller")).toEqual([]);
    });
  });

  it("payment transition map never targets a source status", () => {
    Object.values(PAYMENT_TRANSITIONS).forEach((t) => {
      expect(t.from).not.toContain(t.to);
    });
  });
});
