import { type CurrencyCode, roundTo } from "./countries";
import { midRate, toUsd } from "./fx";

// Simulated cross-border payment rails. Provider names are generic on purpose:
// fees and speeds are representative of each rail type, not of any real company.

export type Purpose = "tuition" | "rent" | "living" | "family" | "other";

export interface RouteDef {
  id: string;
  name: string;
  description: string;
  flatFeeUsd: number;
  pctFee: number;
  fxMarginPct: number;
  etaHours: [number, number];
  maxUsd: number;
  purposes: Purpose[];
  /** Whether universities typically accept payments arriving via this rail. */
  tuitionAccepted: boolean;
  experimental?: boolean;
  notes: string;
}

export const ROUTES: RouteDef[] = [
  {
    id: "swift_wire",
    name: "Bank SWIFT wire",
    description: "Traditional international bank transfer from your home bank.",
    flatFeeUsd: 25, pctFee: 0, fxMarginPct: 1.5, etaHours: [48, 96], maxUsd: 100_000,
    purposes: ["tuition", "rent", "living", "family", "other"], tuitionAccepted: true,
    notes: "Accepted everywhere. Intermediary banks may deduct extra fees, so the university can receive slightly less.",
  },
  {
    id: "uni_platform",
    name: "University payment platform",
    description: "Payment platform the university contracts for international tuition.",
    flatFeeUsd: 0, pctFee: 0, fxMarginPct: 0.9, etaHours: [24, 72], maxUsd: 100_000,
    purposes: ["tuition"], tuitionAccepted: true,
    notes: "Best traceability: the payment is matched to your student ID automatically. Tuition only.",
  },
  {
    id: "online_remit",
    name: "Online remittance service",
    description: "Digital money-transfer service paying out to a local bank account.",
    flatFeeUsd: 3, pctFee: 0.45, fxMarginPct: 0.3, etaHours: [1, 24], maxUsd: 10_000,
    purposes: ["tuition", "rent", "living", "family", "other"], tuitionAccepted: true,
    notes: "Cheapest for most amounts. Some universities reject payments from third-party senders — include your student ID in the reference.",
  },
  {
    id: "wallet_topup",
    name: "Multi-currency wallet top-up",
    description: "Move money into your own destination-currency wallet in this app.",
    flatFeeUsd: 0, pctFee: 0, fxMarginPct: 0.35, etaHours: [0, 0], maxUsd: 5_000,
    purposes: ["living", "rent", "other"], tuitionAccepted: false,
    notes: "Instant. For day-to-day spending, not for paying the university.",
  },
  {
    id: "stablecoin_testnet",
    name: "Stablecoin rail (testnet, experimental)",
    description: "USD stablecoin transfer settled on a public testnet, off-ramped to local currency.",
    flatFeeUsd: 1, pctFee: 0.1, fxMarginPct: 0.2, etaHours: [0, 1], maxUsd: 2_000,
    purposes: ["family", "living", "other"], tuitionAccepted: false, experimental: true,
    notes: "Experimental and testnet-only. Not accepted for tuition; local rules on crypto off-ramps vary by country.",
  },
];

export function getRoute(id: string): RouteDef | undefined {
  return ROUTES.find((r) => r.id === id);
}

export interface RouteOption {
  routeId: string;
  name: string;
  /** Amount the sender pays, in `from` currency, including all fees. */
  totalCost: number;
  feeTotal: number;
  /** All-in cost vs. mid-market, as a percentage of the amount sent. */
  effectiveCostPct: number;
  receive: number;
  etaHours: [number, number];
  eligible: boolean;
  ineligibleReason?: string;
  experimental: boolean;
  notes: string;
}

/**
 * Cost for the recipient to receive exactly `receiveAmount` of `to` currency,
 * paid from `from` currency.
 */
export function priceRoute(
  route: RouteDef, from: CurrencyCode, to: CurrencyCode, receiveAmount: number, purpose: Purpose, date = new Date(),
): RouteOption {
  const mid = midRate(from, to, date);
  const rate = mid * (1 - route.fxMarginPct / 100);
  const principal = receiveAmount / rate; // in `from`
  const flatFee = route.flatFeeUsd * midRate("USD", from, date);
  const pctFee = principal * (route.pctFee / 100);
  const feeTotal = flatFee + pctFee;
  const totalCost = principal + feeTotal;
  const atMid = receiveAmount / mid;
  const usd = toUsd(from, totalCost, date);

  let ineligibleReason: string | undefined;
  if (!route.purposes.includes(purpose)) ineligibleReason = `Not available for ${purpose} payments`;
  else if (usd > route.maxUsd) ineligibleReason = `Exceeds route limit of USD ${route.maxUsd.toLocaleString("en")}`;

  return {
    routeId: route.id,
    name: route.name,
    totalCost: roundTo(from, totalCost),
    feeTotal: roundTo(from, feeTotal),
    effectiveCostPct: Math.round(((totalCost - atMid) / atMid) * 10_000) / 100,
    receive: roundTo(to, receiveAmount),
    etaHours: route.etaHours,
    eligible: !ineligibleReason,
    ineligibleReason,
    experimental: !!route.experimental,
    notes: route.notes,
  };
}

export function compareRoutes(
  from: CurrencyCode, to: CurrencyCode, receiveAmount: number, purpose: Purpose, date = new Date(),
): RouteOption[] {
  return ROUTES.map((r) => priceRoute(r, from, to, receiveAmount, purpose, date)).sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return a.totalCost - b.totalCost;
  });
}

/** How much the chosen option saves compared with a traditional bank wire (0 if none). */
export function savingVsWire(options: RouteOption[], chosen?: RouteOption): number {
  const wire = options.find((o) => o.routeId === "swift_wire" && o.eligible);
  const pick = chosen ?? options.find((o) => o.eligible);
  if (!wire || !pick || pick.routeId === wire.routeId) return 0;
  return Math.max(0, wire.totalCost - pick.totalCost);
}
