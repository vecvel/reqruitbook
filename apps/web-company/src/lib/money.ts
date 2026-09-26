/**
 * Exact decimal arithmetic for money and salary figures.
 */

const SCALE = 4;
const FACTOR = 10n ** BigInt(SCALE);

export type Decimal = string;

export function toUnits(value: Decimal | number | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;

  const s = typeof value === "number" ? value.toFixed(SCALE) : value.trim();
  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;

  const [whole = "0", frac = ""] = body.split(".");
  const fracPadded = (frac + "0".repeat(SCALE)).slice(0, SCALE);

  const digits = `${whole || "0"}${fracPadded}`.replace(/\D/g, "") || "0";
  const units = BigInt(digits);
  return negative ? -units : units;
}

export function fromUnits(units: bigint): Decimal {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / FACTOR;
  const frac = (abs % FACTOR).toString().padStart(SCALE, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function dec(value: Decimal | number | null | undefined): Decimal {
  return fromUnits(toUnits(value));
}

export function add(...values: (Decimal | number)[]): Decimal {
  return fromUnits(values.reduce((acc, v) => acc + toUnits(v), 0n));
}

export function sub(a: Decimal | number, b: Decimal | number): Decimal {
  return fromUnits(toUnits(a) - toUnits(b));
}

export function mul(a: Decimal | number, b: Decimal | number): Decimal {
  return fromUnits((toUnits(a) * toUnits(b)) / FACTOR);
}

export function div(a: Decimal | number, b: Decimal | number): Decimal {
  const divisor = toUnits(b);
  if (divisor === 0n) return "0.0000";
  return fromUnits((toUnits(a) * FACTOR) / divisor);
}

export function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
