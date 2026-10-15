// Country and currency reference data. FX mid-rates are sandbox values for the
// simulation, not live market data.

export type CurrencyCode =
  | "USD" | "CNY" | "THB" | "JPY" | "KRW" | "SGD" | "MYR" | "VND" | "IDR" | "PHP"
  | "INR" | "GBP" | "EUR" | "AUD" | "CAD" | "HKD" | "BRL" | "NGN" | "PKR" | "BDT"
  | "LAK" | "KHR" | "NZD";

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  /** Units of this currency per 1 USD (sandbox mid-rate). */
  perUsd: number;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  USD: { code: "USD", symbol: "$", perUsd: 1, decimals: 2 },
  CNY: { code: "CNY", symbol: "¥", perUsd: 7.15, decimals: 2 },
  THB: { code: "THB", symbol: "฿", perUsd: 33.5, decimals: 2 },
  JPY: { code: "JPY", symbol: "¥", perUsd: 150, decimals: 0 },
  KRW: { code: "KRW", symbol: "₩", perUsd: 1380, decimals: 0 },
  SGD: { code: "SGD", symbol: "S$", perUsd: 1.32, decimals: 2 },
  MYR: { code: "MYR", symbol: "RM", perUsd: 4.4, decimals: 2 },
  VND: { code: "VND", symbol: "₫", perUsd: 25500, decimals: 0 },
  IDR: { code: "IDR", symbol: "Rp", perUsd: 16200, decimals: 0 },
  PHP: { code: "PHP", symbol: "₱", perUsd: 57, decimals: 2 },
  INR: { code: "INR", symbol: "₹", perUsd: 85, decimals: 2 },
  GBP: { code: "GBP", symbol: "£", perUsd: 0.77, decimals: 2 },
  EUR: { code: "EUR", symbol: "€", perUsd: 0.88, decimals: 2 },
  AUD: { code: "AUD", symbol: "A$", perUsd: 1.52, decimals: 2 },
  CAD: { code: "CAD", symbol: "C$", perUsd: 1.37, decimals: 2 },
  HKD: { code: "HKD", symbol: "HK$", perUsd: 7.8, decimals: 2 },
  BRL: { code: "BRL", symbol: "R$", perUsd: 5.5, decimals: 2 },
  NGN: { code: "NGN", symbol: "₦", perUsd: 1550, decimals: 2 },
  PKR: { code: "PKR", symbol: "Rs", perUsd: 280, decimals: 2 },
  BDT: { code: "BDT", symbol: "৳", perUsd: 120, decimals: 2 },
  LAK: { code: "LAK", symbol: "₭", perUsd: 21800, decimals: 0 },
  KHR: { code: "KHR", symbol: "៛", perUsd: 4050, decimals: 0 },
  NZD: { code: "NZD", symbol: "NZ$", perUsd: 1.68, decimals: 2 },
};

export interface StudyGuide {
  /** Typical monthly living cost for a student, in local currency. */
  monthlyLivingCost: number;
  /** Typical annual tuition range for international undergraduates, local currency. */
  tuitionRange: [number, number];
  bankAccount: string[];
  payments: string[];
  tuition: string[];
  arrival: string[];
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: CurrencyCode;
  guide?: StudyGuide;
}

const GENERIC_GUIDE: StudyGuide = {
  monthlyLivingCost: 0,
  tuitionRange: [0, 0],
  bankAccount: [
    "Bring your passport, student visa or residence permit, and university admission or enrolment letter.",
    "Many banks also ask for a local address and a local phone number.",
  ],
  payments: ["Ask your university's international office which local payment apps and cards work for students."],
  tuition: [
    "Pay only to the bank account printed on the official invoice or university portal.",
    "Confirm account details by phone with the university finance office before the first payment.",
  ],
  arrival: [
    "Carry enough cash or a multi-currency card for the first two weeks.",
    "Register your address with local authorities if required.",
  ],
};

export const COUNTRIES: Country[] = [
  {
    code: "CN", name: "China", flag: "🇨🇳", currency: "CNY",
    guide: {
      monthlyLivingCost: 3500,
      tuitionRange: [20000, 45000],
      bankAccount: [
        "Open a student account at a major bank branch near campus with passport, X1/X2 student visa or residence permit, admission letter, and a Chinese mobile number.",
        "Some branches require the residence permit first, which usually takes up to 30 days after arrival — plan to rely on your home card and cash until then.",
        "Ask for a UnionPay debit card; it links to Alipay and WeChat Pay.",
      ],
      payments: [
        "Alipay and WeChat Pay accept foreign Visa/Mastercard for visitors, with a small fee on larger payments and transaction caps.",
        "After you open a local bank account, link it to Alipay/WeChat Pay for fee-free daily payments.",
        "Many places do not accept physical foreign cards — always keep a mobile payment option.",
      ],
      tuition: [
        "Universities usually accept an international wire (SWIFT) to the university's bank account or a university-approved international payment platform.",
        "Put your full name and student ID in the payment reference so the finance office can match it.",
        "Keep the transfer receipt; you may need it for residence-permit or scholarship paperwork.",
      ],
      arrival: [
        "Register your accommodation with the local police within 24 hours (the dorm often does this for you).",
        "Do your health check and apply for the residence permit within 30 days of arrival.",
        "Get a local SIM card with your passport — needed for bank and payment apps.",
      ],
    },
  },
  {
    code: "JP", name: "Japan", flag: "🇯🇵", currency: "JPY",
    guide: {
      monthlyLivingCost: 120000,
      tuitionRange: [535800, 1500000],
      bankAccount: [
        "Register your address at the city office first; banks require a residence card with address.",
        "Japan Post Bank is commonly used by new students; some banks require 6 months of residence.",
      ],
      payments: ["IC transit cards (Suica/PASMO) work in many shops; cash is still common.", "QR payments like PayPay are widely accepted."],
      tuition: ["Pay by bank transfer using the university's payment slip, or the international payment option on the portal."],
      arrival: ["Register at the city office within 14 days.", "Enrol in National Health Insurance at the same time."],
    },
  },
  {
    code: "KR", name: "South Korea", flag: "🇰🇷", currency: "KRW",
    guide: {
      monthlyLivingCost: 1100000,
      tuitionRange: [4000000, 12000000],
      bankAccount: ["Open an account near campus with passport and certificate of enrolment; full features often need the Alien Registration Card."],
      payments: ["Cards are accepted almost everywhere; KakaoPay and NaverPay need a local account and phone."],
      tuition: ["Pay to the virtual account on the tuition bill or by international wire."],
      arrival: ["Apply for the Alien Registration Card within 90 days.", "National Health Insurance enrolment is automatic after 6 months."],
    },
  },
  {
    code: "SG", name: "Singapore", flag: "🇸🇬", currency: "SGD",
    guide: {
      monthlyLivingCost: 1800,
      tuitionRange: [17000, 40000],
      bankAccount: ["Student accounts can be opened with passport, Student's Pass (or IPA letter) and proof of enrolment."],
      payments: ["Contactless cards and PayNow are standard."],
      tuition: ["Pay via the university portal (GIRO, PayNow or card) or international wire."],
      arrival: ["Complete Student's Pass formalities at ICA."],
    },
  },
  {
    code: "MY", name: "Malaysia", flag: "🇲🇾", currency: "MYR",
    guide: {
      monthlyLivingCost: 2000,
      tuitionRange: [15000, 45000],
      bankAccount: ["Bring passport with student pass and a university confirmation letter."],
      payments: ["Touch 'n Go eWallet and DuitNow QR are widely used."],
      tuition: ["Pay via international wire or the university's payment portal."],
      arrival: ["Complete the medical screening required for the student pass."],
    },
  },
  {
    code: "TH", name: "Thailand", flag: "🇹🇭", currency: "THB",
    guide: {
      monthlyLivingCost: 15000,
      tuitionRange: [60000, 300000],
      bankAccount: ["Bring passport with Non-ED visa and a letter from your university; some banks require a work/study letter."],
      payments: ["PromptPay QR is everywhere and links to a Thai bank account."],
      tuition: ["Pay via the university's bank account, QR bill payment, or international wire."],
      arrival: ["Report your address (TM.30 is filed by your landlord) and do 90-day reports with immigration."],
    },
  },
  {
    code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP",
    guide: {
      monthlyLivingCost: 1300,
      tuitionRange: [15000, 38000],
      bankAccount: ["Bring passport, BRP or eVisa share code, and a bank letter from your university."],
      payments: ["Contactless cards and mobile wallets are standard."],
      tuition: ["Pay through the university's approved international payment platform or bank transfer; deposits are often required before CAS."],
      arrival: ["Register with a GP (doctor).", "Check your eVisa status."],
    },
  },
  {
    code: "US", name: "United States", flag: "🇺🇸", currency: "USD",
    guide: {
      monthlyLivingCost: 1800,
      tuitionRange: [25000, 60000],
      bankAccount: ["Bring passport, I-20, visa and proof of address; an SSN is usually not required for a student checking account."],
      payments: ["Cards are standard; Zelle and Venmo need a US bank account."],
      tuition: ["Pay via the student portal (international payment option) or wire transfer."],
      arrival: ["Check in with your international student office to activate your SEVIS record."],
    },
  },
  {
    code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD",
    guide: {
      monthlyLivingCost: 2500,
      tuitionRange: [30000, 50000],
      bankAccount: ["Several banks let you open an account online before arrival and verify in branch."],
      payments: ["Contactless cards and PayID are standard."],
      tuition: ["Pay via the university portal, BPAY, or international payment platform."],
      arrival: ["Make sure your Overseas Student Health Cover is active."],
    },
  },
  {
    code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR",
    guide: {
      monthlyLivingCost: 992,
      tuitionRange: [0, 3000],
      bankAccount: ["A blocked account (Sperrkonto) is usually required for the visa.", "Register your address (Anmeldung) before opening a normal current account."],
      payments: ["Cash and Girocard are still common; check card acceptance."],
      tuition: ["Pay the semester contribution by SEPA transfer with the reference on your enrolment letter."],
      arrival: ["Anmeldung within 14 days of moving in.", "Get statutory health insurance before enrolment."],
    },
  },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", currency: "VND" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP" },
  { code: "IN", name: "India", flag: "🇮🇳", currency: "INR" },
  { code: "LA", name: "Laos", flag: "🇱🇦", currency: "LAK" },
  { code: "KH", name: "Cambodia", flag: "🇰🇭", currency: "KHR" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", currency: "PKR" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", currency: "BDT" },
  { code: "HK", name: "Hong Kong SAR", flag: "🇭🇰", currency: "HKD" },
  { code: "FR", name: "France", flag: "🇫🇷", currency: "EUR" },
  { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", currency: "NZD" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN" },
];

export function getCountry(code: string): Country {
  const c = COUNTRIES.find((x) => x.code === code);
  if (!c) throw new Error(`Unknown country: ${code}`);
  return c;
}

export function guideFor(code: string): StudyGuide {
  return getCountry(code).guide ?? GENERIC_GUIDE;
}

export function isCurrency(code: string): code is CurrencyCode {
  return code in CURRENCIES;
}

/** Round an amount to the currency's minor units. */
export function roundTo(code: CurrencyCode, amount: number): number {
  const f = 10 ** CURRENCIES[code].decimals;
  return Math.round(amount * f) / f;
}

export function formatMoney(code: CurrencyCode, amount: number, locale = "en"): string {
  const c = CURRENCIES[code];
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency: code,
      minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals,
    }).format(amount);
  } catch {
    return `${c.symbol}${amount.toFixed(c.decimals)}`;
  }
}
