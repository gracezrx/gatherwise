export function createId(prefix: string) {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${id.slice(0, 8)}`;
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function roundScore(value: number) {
  return Math.round(value * 100);
}

export function toTitle(value: string) {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stableRatio(input: string) {
  return stableHash(input) / 0xffffffff;
}
